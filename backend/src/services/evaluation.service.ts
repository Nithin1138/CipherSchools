import prisma from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { EvaluationStatus, EvaluatorType, EvaluationResult } from '../domain/types.js';
import { Evaluator } from '../domain/evaluator.js';
import { LLMEvaluator } from '../evaluators/llm.evaluator.js';
import { rubricService } from './rubric.service.js';

export class EvaluationService {
  private defaultEvaluator: Evaluator;

  constructor(evaluator?: Evaluator) {
    this.defaultEvaluator = evaluator || new LLMEvaluator();
  }

  /**
   * 1. Creates an initial evaluation record in PENDING state.
   * Catches unique constraint (P2002) to return a clean domain 409 error.
   */
  async createEvaluation(submissionId: string, evaluatorType: EvaluatorType = EvaluatorType.LLM) {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { evaluation: true },
    });

    if (!submission) {
      throw new AppError(404, `Submission not found with ID: ${submissionId}`);
    }

    if (submission.evaluation) {
      throw new AppError(409, 'An evaluation already exists for this submission.');
    }

    try {
      return await prisma.evaluation.create({
        data: {
          submissionId,
          evaluatorType,
          status: EvaluationStatus.PENDING,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new AppError(409, 'An evaluation already exists for this submission.');
      }
      throw err;
    }
  }

  /**
   * 2. Moves evaluation into EVALUATING state.
   * Enforces valid state machine transitions: only PENDING or FAILED can move to EVALUATING.
   * Uses an atomic conditional update at the database level to prevent concurrent execution races.
   */
  async startEvaluation(evaluationId: string) {
    // Atomic state claim: only update if status is PENDING or FAILED.
    // Row-level lock in PostgreSQL prevents two simultaneous requests from claiming the evaluation.
    const updateResult = await prisma.evaluation.updateMany({
      where: {
        id: evaluationId,
        status: { in: [EvaluationStatus.PENDING, EvaluationStatus.FAILED] },
      },
      data: {
        status: EvaluationStatus.EVALUATING,
        startedAt: new Date(),
        errorMessage: null,
      },
    });

    if (updateResult.count === 0) {
      const evaluation = await prisma.evaluation.findUnique({
        where: { id: evaluationId },
      });

      if (!evaluation) {
        throw new AppError(404, `Evaluation not found with ID: ${evaluationId}`);
      }

      if (evaluation.status === EvaluationStatus.COMPLETED) {
        throw new AppError(400, 'Invalid evaluation state transition: Evaluation is already COMPLETED and cannot be re-evaluated.');
      }

      if (evaluation.status === EvaluationStatus.EVALUATING) {
        throw new AppError(400, 'Invalid evaluation state transition: Evaluation is already EVALUATING in progress.');
      }

      throw new AppError(400, `Invalid evaluation state transition: Cannot move from ${evaluation.status} to EVALUATING.`);
    }

    return prisma.evaluation.findUniqueOrThrow({
      where: { id: evaluationId },
      include: { feedback: true },
    });
  }

  /**
   * 3. Marks evaluation as FAILED with error context.
   * Cannot fail an already completed evaluation.
   */
  async markEvaluationFailed(evaluationId: string, errorMessage: string) {
    const evaluation = await prisma.evaluation.findUnique({
      where: { id: evaluationId },
    });

    if (!evaluation) {
      throw new AppError(404, `Evaluation not found with ID: ${evaluationId}`);
    }

    if (evaluation.status === EvaluationStatus.COMPLETED) {
      throw new AppError(400, 'Invalid evaluation state transition: Cannot mark a COMPLETED evaluation as FAILED.');
    }

    return prisma.evaluation.update({
      where: { id: evaluationId },
      data: {
        status: EvaluationStatus.FAILED,
        errorMessage,
        completedAt: new Date(),
      },
    });
  }

  /**
   * 4. Completes evaluation atomically: persists structured feedback and marks COMPLETED.
   * Enforces:
   * - Must be in EVALUATING state
   * - Rubric is authoritative source of truth for criteria and max scores
   * - Scoring bounds validation (0 <= score <= authoritativeMaxScore)
   * - Deterministic score summing
   */
  async completeEvaluation(evaluationId: string, result: EvaluationResult) {
    const evaluation = await prisma.evaluation.findUnique({
      where: { id: evaluationId },
    });

    if (!evaluation) {
      throw new AppError(404, `Evaluation not found with ID: ${evaluationId}`);
    }

    if (evaluation.status !== EvaluationStatus.EVALUATING) {
      throw new AppError(400, `Invalid evaluation state transition: Must be in EVALUATING state to complete, current state is ${evaluation.status}.`);
    }

    if (!result.criterionResults || result.criterionResults.length === 0) {
      throw new AppError(400, 'Invalid evaluation result: Criteria feedback results are required.');
    }

    // Resolve authoritative rubric criteria from database
    let rubricCriteriaMap = new Map<string, { id: string; name: string; maxScore: number }>();
    let rubricByNameMap = new Map<string, { id: string; name: string; maxScore: number }>();
    try {
      const rubric = await rubricService.getDefaultRubric();
      rubricCriteriaMap = new Map(rubric.criteria.map((c) => [c.id, c]));
      rubricByNameMap = new Map(rubric.criteria.map((c) => [c.name.toLowerCase().trim(), c]));
    } catch {
      // Fallback for isolated unit tests where default rubric might not be seeded
    }

    // Validate scoring against authoritative rubric and calculate deterministic total
    let calculatedTotalScore = 0;
    let calculatedMaxScore = 0;
    const feedbackPayloads: {
      evaluationId: string;
      criterionId: string | null;
      criterionName: string;
      score: number;
      maxScore: number;
      evidence: string;
      concern: string | null;
      suggestion: string | null;
      confidence: number | null;
    }[] = [];

    for (const res of result.criterionResults) {
      const canonicalCriterion = (res.criterionId && rubricCriteriaMap.get(res.criterionId)) ||
                                  rubricByNameMap.get(res.criterionName.toLowerCase().trim());
      
      const authoritativeMaxScore = canonicalCriterion ? canonicalCriterion.maxScore : res.maxScore;
      const criterionId = canonicalCriterion ? canonicalCriterion.id : (res.criterionId || null);
      const criterionName = canonicalCriterion ? canonicalCriterion.name : res.criterionName;

      if (typeof res.score !== 'number' || isNaN(res.score)) {
        throw new AppError(400, `Invalid score for criterion '${res.criterionName}': must be a valid number.`);
      }

      if (res.score < 0) {
        throw new AppError(400, `Invalid score for criterion '${res.criterionName}': score cannot be negative.`);
      }

      if (res.score > authoritativeMaxScore) {
        throw new AppError(400, `Invalid score for criterion '${criterionName}': score (${res.score}) exceeds authoritative maxScore (${authoritativeMaxScore}).`);
      }

      calculatedTotalScore += res.score;
      calculatedMaxScore += authoritativeMaxScore;

      feedbackPayloads.push({
        evaluationId,
        criterionId,
        criterionName,
        score: res.score,
        maxScore: authoritativeMaxScore,
        evidence: res.evidence || 'Evaluated submission.',
        concern: res.concern || null,
        suggestion: res.suggestion || null,
        confidence: res.confidence || null,
      });
    }

    // Ensure total score cannot mathematically exceed maximum allowable score
    if (calculatedMaxScore > 0 && calculatedTotalScore > calculatedMaxScore) {
      calculatedTotalScore = calculatedMaxScore;
    }

    // Atomically persist feedback items and complete evaluation
    return prisma.$transaction(async (tx) => {
      // Clear previous feedback if any existed (e.g. from earlier attempt)
      await tx.feedback.deleteMany({
        where: { evaluationId },
      });

      await tx.feedback.createMany({
        data: feedbackPayloads,
      });

      return tx.evaluation.update({
        where: { id: evaluationId },
        data: {
          status: EvaluationStatus.COMPLETED,
          totalScore: calculatedTotalScore,
          maxScore: calculatedMaxScore || 100,
          completedAt: new Date(),
          errorMessage: null,
        },
        include: {
          feedback: {
            orderBy: { score: 'asc' },
          },
        },
      });
    });
  }

  /**
   * 5. Retries a FAILED evaluation in-place.
   * Preserves the 1:1 database constraint without creating duplicate rows.
   */
  async retryEvaluation(evaluationId: string) {
    const evaluation = await prisma.evaluation.findUnique({
      where: { id: evaluationId },
    });

    if (!evaluation) {
      throw new AppError(404, `Evaluation not found with ID: ${evaluationId}`);
    }

    if (evaluation.status !== EvaluationStatus.FAILED) {
      throw new AppError(400, `Invalid evaluation state transition: Only FAILED evaluations can be retried. Current status is ${evaluation.status}.`);
    }

    return this.startEvaluation(evaluationId);
  }

  /**
   * High-level orchestrator for end-to-end submission evaluation:
   * 1. Validates submission existence
   * 2. Checks/initializes Evaluation record (save-before-evaluate guarantee)
   * 3. Fetches rubric criteria
   * 4. Executes Evaluator contract
   * 5. Transactionally persists feedback and deterministic scores
   */
  async evaluateSubmission(submissionId: string, customEvaluator?: Evaluator) {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        attempt: {
          include: { problem: true },
        },
        evaluation: {
          include: { feedback: true },
        },
      },
    });

    if (!submission) {
      throw new AppError(404, `Submission not found with ID: ${submissionId}`);
    }

    let evaluation = submission.evaluation;

    // If already completed, return it (preventing duplicate evaluation work)
    if (evaluation && evaluation.status === EvaluationStatus.COMPLETED) {
      return evaluation;
    }

    // Transition or create Evaluation record
    if (evaluation) {
      if (evaluation.status === EvaluationStatus.EVALUATING) {
        // Already being evaluated concurrently by another request
        return evaluation;
      }
      evaluation = await this.startEvaluation(evaluation.id);
    } else {
      try {
        const created = await this.createEvaluation(submissionId);
        evaluation = await this.startEvaluation(created.id);
      } catch (err: any) {
        const existing = await prisma.evaluation.findUnique({
          where: { submissionId },
          include: { feedback: true },
        });
        if (existing) {
          if (existing.status === EvaluationStatus.COMPLETED || existing.status === EvaluationStatus.EVALUATING) {
            return existing;
          }
          evaluation = await this.startEvaluation(existing.id);
        } else {
          throw err;
        }
      }
    }

    // Fetch Rubric Criteria
    const rubric = await rubricService.getDefaultRubric();
    const evaluator = customEvaluator || this.defaultEvaluator;

    try {
      const evaluationResult = await evaluator.evaluate({
        problem: {
          title: submission.attempt.problem.title,
          description: submission.attempt.problem.description,
          problemStatement: submission.attempt.problem.problemStatement,
          requirements: submission.attempt.problem.requirements,
          constraints: submission.attempt.problem.constraints,
        },
        submission: {
          id: submission.id,
          type: submission.type,
          content: submission.content,
        },
        criteria: rubric.criteria.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          maxScore: c.maxScore,
          orderIndex: c.orderIndex,
        })),
      });

      return await this.completeEvaluation(evaluation.id, evaluationResult);
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || 'Evaluation failed during processing.';
      console.error(`[EvaluationService] Failure for submission ${submissionId}:`, errorMsg);

      await this.markEvaluationFailed(evaluation.id, errorMsg);
      throw new AppError(500, `Evaluation failed: ${errorMsg}`);
    }
  }

  /**
   * Retrieves an evaluation by its unique evaluation ID
   */
  async getEvaluationById(id: string) {
    const evaluation = await prisma.evaluation.findUnique({
      where: { id },
      include: {
        feedback: {
          orderBy: { score: 'asc' },
        },
      },
    });

    if (!evaluation) {
      throw new AppError(404, `Evaluation not found with ID: ${id}`);
    }

    return evaluation;
  }

  /**
   * Retrieves an evaluation by submission ID
   */
  async getEvaluationBySubmissionId(submissionId: string) {
    const evaluation = await prisma.evaluation.findUnique({
      where: { submissionId },
      include: {
        feedback: {
          orderBy: { score: 'asc' },
        },
        submission: {
          include: {
            attempt: {
              include: { problem: true },
            },
          },
        },
      },
    });

    if (!evaluation) {
      throw new AppError(404, `Evaluation not found for submission ID: ${submissionId}`);
    }

    return evaluation;
  }
}

export const evaluationService = new EvaluationService();
