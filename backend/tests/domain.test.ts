import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/lib/prisma.js';
import { problemService } from '../src/services/problem.service.js';
import { attemptService } from '../src/services/attempt.service.js';
import { submissionService } from '../src/services/submission.service.js';
import { evaluationService } from '../src/services/evaluation.service.js';
import { Evaluator } from '../src/domain/evaluator.js';
import { EvaluationInput, EvaluationResult, EvaluatorType, EvaluationStatus, AttemptStatus } from '../src/domain/types.js';

describe('LLD Practice Platform - Domain & Service Behavior', () => {
  let testProblemId: string;

  beforeAll(async () => {
    // Locate or create seeded Parking Lot problem
    const problem = await prisma.problem.findFirst({
      where: { slug: 'parking-lot' },
    });
    if (!problem) {
      throw new Error('Seed data missing. Run npm run db:seed first.');
    }
    testProblemId = problem.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('1. Problem & Attempt Lifecycle', () => {
    it('retrieves all 4 seeded problems with correct structure', async () => {
      const problems = await problemService.getAllProblems();
      expect(problems.length).toBeGreaterThanOrEqual(4);
      const slugs = problems.map((p) => p.slug);
      expect(slugs).toContain('parking-lot');
      expect(slugs).toContain('elevator-system');
      expect(slugs).toContain('vending-machine');
      expect(slugs).toContain('food-delivery');
    });

    it('creates an attempt for a problem and preserves attempt history', async () => {
      const attempt1 = await attemptService.createAttempt(testProblemId);
      const attempt2 = await attemptService.createAttempt(testProblemId);

      expect(attempt1.id).toBeDefined();
      expect(attempt2.id).toBeDefined();
      expect(attempt1.id).not.toBe(attempt2.id);

      const history = await attemptService.getAttemptsByProblem(testProblemId);
      const historyIds = history.map((h) => h.id);
      expect(historyIds).toContain(attempt1.id);
      expect(historyIds).toContain(attempt2.id);

      // Clean up
      await prisma.attempt.deleteMany({
        where: { id: { in: [attempt1.id, attempt2.id] } },
      });
    });
  });

  describe('2. Submission Validation & Persistence', () => {
    it('rejects empty or whitespace submission', async () => {
      const attempt = await attemptService.createAttempt(testProblemId);
      await expect(submissionService.createSubmission(attempt.id, '   ')).rejects.toThrow(
        /cannot be empty/i
      );
      await prisma.attempt.delete({ where: { id: attempt.id } });
    });

    it('rejects submission shorter than 20 characters', async () => {
      const attempt = await attemptService.createAttempt(testProblemId);
      await expect(submissionService.createSubmission(attempt.id, 'too short')).rejects.toThrow(
        /too brief/i
      );
      await prisma.attempt.delete({ where: { id: attempt.id } });
    });

    it('persists valid submission and marks attempt completed', async () => {
      const attempt = await attemptService.createAttempt(testProblemId);
      const content = 'Comprehensive Parking Lot design with ParkingLot, Floors, Spots, and PricingStrategy.';
      const submission = await submissionService.createSubmission(attempt.id, content);

      expect(submission.id).toBeDefined();
      expect(submission.attemptId).toBe(attempt.id);
      expect(submission.content).toBe(content);

      const updatedAttempt = await attemptService.getAttemptById(attempt.id);
      expect(updatedAttempt.status).toBe('COMPLETED');
      expect(updatedAttempt.completedAt).not.toBeNull();

      // Clean up
      await prisma.submission.delete({ where: { id: submission.id } });
      await prisma.attempt.delete({ where: { id: attempt.id } });
    });

    it('prevents multiple submissions for the same attempt (1:1 Attempt to Submission)', async () => {
      const attempt = await attemptService.createAttempt(testProblemId);
      await submissionService.createSubmission(attempt.id, 'First valid design submission for parking lot.');

      await expect(
        submissionService.createSubmission(attempt.id, 'Second submission for the same attempt should fail.')
      ).rejects.toThrow(/already has a submission/i);

      // Clean up
      await prisma.submission.deleteMany({ where: { attemptId: attempt.id } });
      await prisma.attempt.delete({ where: { id: attempt.id } });
    });
  });

  describe('3. Evaluation & Duplicate Prevention', () => {
    it('evaluates submission, derives deterministic total score, and persists criterion feedback', async () => {
      const attempt = await attemptService.createAttempt(testProblemId);
      const submission = await submissionService.createSubmission(
        attempt.id,
        'Design with ParkingLot singleton, Vehicle hierarchy, Spot hierarchy, and ParkingStrategy pattern.'
      );

      const evaluation = await evaluationService.evaluateSubmission(submission.id);

      expect(evaluation.status).toBe(EvaluationStatus.COMPLETED);
      expect(evaluation.submissionId).toBe(submission.id);
      expect(evaluation.totalScore).toBeGreaterThan(0);
      expect(evaluation.maxScore).toBe(100);
      expect(evaluation.feedback.length).toBe(7);

      // Verify deterministic score calculation: totalScore must equal sum of criterion scores
      const sum = evaluation.feedback.reduce((acc, f) => acc + f.score, 0);
      expect(evaluation.totalScore).toBe(sum);

      // Clean up
      await prisma.feedback.deleteMany({ where: { evaluationId: evaluation.id } });
      await prisma.evaluation.delete({ where: { id: evaluation.id } });
      await prisma.submission.delete({ where: { id: submission.id } });
      await prisma.attempt.delete({ where: { id: attempt.id } });
    });

    it('enforces database-level unique constraint on submissionId', async () => {
      const attempt = await attemptService.createAttempt(testProblemId);
      const submission = await submissionService.createSubmission(
        attempt.id,
        'Design submission to test unique evaluation constraint.'
      );

      // Create first evaluation
      const eval1 = await prisma.evaluation.create({
        data: {
          submissionId: submission.id,
          evaluatorType: EvaluatorType.LLM,
          status: EvaluationStatus.COMPLETED,
          totalScore: 75,
        },
      });

      // Attempting to create a second evaluation row for the same submissionId must throw
      await expect(
        prisma.evaluation.create({
          data: {
            submissionId: submission.id,
            evaluatorType: EvaluatorType.LLM,
            status: EvaluationStatus.PENDING,
          },
        })
      ).rejects.toThrow();

      // Clean up
      await prisma.evaluation.delete({ where: { id: eval1.id } });
      await prisma.submission.delete({ where: { id: submission.id } });
      await prisma.attempt.delete({ where: { id: attempt.id } });
    });
  });

  describe('4. Failure Handling & In-Place Retry (Save-Before-Evaluate)', () => {
    class FailingEvaluator implements Evaluator {
      readonly name = 'FailingEvaluator';
      async evaluate(_input: EvaluationInput): Promise<EvaluationResult> {
        throw new Error('Simulated upstream LLM API rate-limit error.');
      }
    }

    class RecoveredEvaluator implements Evaluator {
      readonly name = 'RecoveredEvaluator';
      async evaluate(input: EvaluationInput): Promise<EvaluationResult> {
        return {
          evaluatorType: EvaluatorType.LLM,
          criterionResults: input.criteria.map((c) => ({
            criterionId: c.id,
            criterionName: c.name,
            score: Math.round(c.maxScore * 0.8),
            maxScore: c.maxScore,
            evidence: 'Verified recovery.',
          })),
        };
      }
    }

    it('marks evaluation FAILED on evaluator error without losing submission, then retries in-place', async () => {
      const attempt = await attemptService.createAttempt(testProblemId);
      const submission = await submissionService.createSubmission(
        attempt.id,
        'Valid candidate submission being evaluated with a failing evaluator.'
      );

      // Step 1: Run with failing evaluator
      await expect(
        evaluationService.evaluateSubmission(submission.id, new FailingEvaluator())
      ).rejects.toThrow(/Simulated upstream LLM/);

      // Step 2: Verify submission is safe and evaluation is marked FAILED
      const failedEval = await prisma.evaluation.findUnique({
        where: { submissionId: submission.id },
      });
      expect(failedEval).not.toBeNull();
      expect(failedEval?.status).toBe(EvaluationStatus.FAILED);
      expect(failedEval?.errorMessage).toContain('Simulated upstream LLM');

      // Step 3: Retry evaluation in-place with recovered evaluator
      const retriedEval = await evaluationService.evaluateSubmission(
        submission.id,
        new RecoveredEvaluator()
      );

      // Step 4: Verify it updated the SAME evaluation record (no duplicate rows created)
      expect(retriedEval.id).toBe(failedEval?.id);
      expect(retriedEval.status).toBe(EvaluationStatus.COMPLETED);
      expect(retriedEval.errorMessage).toBeNull();
      expect(retriedEval.totalScore).toBe(80);

      const allEvalsForSubmission = await prisma.evaluation.findMany({
        where: { submissionId: submission.id },
      });
      expect(allEvalsForSubmission.length).toBe(1);

      // Clean up
      await prisma.feedback.deleteMany({ where: { evaluationId: retriedEval.id } });
      await prisma.evaluation.delete({ where: { id: retriedEval.id } });
      await prisma.submission.delete({ where: { id: submission.id } });
      await prisma.attempt.delete({ where: { id: attempt.id } });
    });
  });

  describe('5. State Machine Transitions & Domain Rules', () => {
    it('rule 1 & 6: moves evaluation through valid states (PENDING -> EVALUATING -> COMPLETED) and rejects invalid transitions', async () => {
      const problem = await problemService.getProblemBySlug('parking-lot');
      expect(problem.id).toBe(testProblemId);

      const attempt = await attemptService.createAttempt(testProblemId);
      const submission = await submissionService.createSubmission(
        attempt.id,
        'Valid candidate design for state machine verification testing.'
      );

      // 1. Create in PENDING
      const pendingEval = await evaluationService.createEvaluation(submission.id);
      expect(pendingEval.status).toBe(EvaluationStatus.PENDING);

      // 2. Cannot duplicate evaluation (Rule 8)
      await expect(evaluationService.createEvaluation(submission.id)).rejects.toThrow(/already exists/i);

      // 3. Move PENDING -> EVALUATING
      const inProgressEval = await evaluationService.startEvaluation(pendingEval.id);
      expect(inProgressEval.status).toBe(EvaluationStatus.EVALUATING);

      // 4. Cannot restart an already EVALUATING evaluation
      await expect(evaluationService.startEvaluation(pendingEval.id)).rejects.toThrow(/already EVALUATING/i);

      // 5. Complete with valid canonical scores
      const completedEval = await evaluationService.completeEvaluation(pendingEval.id, {
        evaluatorType: EvaluatorType.LLM,
        evaluatorModel: 'test-evaluator',
        criterionResults: [
          { criterionName: 'Requirement Understanding', score: 15, maxScore: 15, evidence: 'Identified all requirements.' },
          { criterionName: 'Class Responsibilities', score: 18, maxScore: 20, evidence: 'Well modeled.' },
          { criterionName: 'Encapsulation & Interfaces', score: 14, maxScore: 15, evidence: 'Clean interfaces.' },
          { criterionName: 'Coupling & Cohesion', score: 13, maxScore: 15, evidence: 'Loose coupling.' },
          { criterionName: 'Abstraction / Design Patterns', score: 9, maxScore: 10, evidence: 'Solid patterns.' },
          { criterionName: 'Extensibility', score: 12, maxScore: 15, evidence: 'Open-closed principle.' },
          { criterionName: 'Edge Cases & Testability', score: 9, maxScore: 10, evidence: 'Handled race conditions.' },
        ],
      });

      expect(completedEval.status).toBe(EvaluationStatus.COMPLETED);
      expect(completedEval.totalScore).toBe(90);

      // 6. Cannot re-evaluate an already COMPLETED evaluation
      await expect(evaluationService.startEvaluation(pendingEval.id)).rejects.toThrow(/already COMPLETED/i);

      // 7. Cannot retry a COMPLETED evaluation
      await expect(evaluationService.retryEvaluation(pendingEval.id)).rejects.toThrow(/Only FAILED evaluations can be retried/i);

      // 8. Cannot complete evaluation with incomplete or unknown criteria
      const attemptX = await attemptService.createAttempt(testProblemId);
      const subX = await submissionService.createSubmission(attemptX.id, 'Validation test submission content for rubric check.');
      const evalX = await evaluationService.createEvaluation(subX.id);
      await evaluationService.startEvaluation(evalX.id);

      // Incomplete criteria (only 2 criteria provided)
      await expect(
        evaluationService.completeEvaluation(evalX.id, {
          evaluatorType: EvaluatorType.LLM,
          evaluatorModel: 'test',
          criterionResults: [
            { criterionName: 'Requirement Understanding', score: 10, maxScore: 15, evidence: 'Ok' },
            { criterionName: 'Class Responsibilities', score: 15, maxScore: 20, evidence: 'Ok' },
          ],
        })
      ).rejects.toThrow(/Incomplete evaluation: Missing canonical criterion/i);

      // Unknown criterion provided
      await expect(
        evaluationService.completeEvaluation(evalX.id, {
          evaluatorType: EvaluatorType.LLM,
          evaluatorModel: 'test',
          criterionResults: [
            { criterionName: 'Fictitious Criterion', score: 10, maxScore: 15, evidence: 'Fake' },
          ],
        })
      ).rejects.toThrow(/Unknown criterion/i);

      await prisma.evaluation.delete({ where: { id: evalX.id } });
      await prisma.submission.delete({ where: { id: subX.id } });
      await prisma.attempt.delete({ where: { id: attemptX.id } });

      // Clean up
      await prisma.feedback.deleteMany({ where: { evaluationId: completedEval.id } });
      await prisma.evaluation.delete({ where: { id: completedEval.id } });
      await prisma.submission.delete({ where: { id: submission.id } });
      await prisma.attempt.delete({ where: { id: attempt.id } });
    });

    it('rule 9 & 10: learner retry creates brand new Attempt/Submission while preserving previous attempt intact', async () => {
      // Learner Attempt 1
      const attempt1 = await attemptService.createAttempt(testProblemId);
      const submission1 = await submissionService.createSubmission(
        attempt1.id,
        'Learner design submission 1: initial draft of parking lot.'
      );
      const eval1 = await evaluationService.evaluateSubmission(submission1.id);
      expect(eval1.status).toBe(EvaluationStatus.COMPLETED);

      // Learner clicks "Try Again" -> Attempt 2
      const attempt2 = await attemptService.createAttempt(testProblemId);
      expect(attempt2.id).not.toBe(attempt1.id);
      expect(attempt2.status).toBe(AttemptStatus.IN_PROGRESS);

      const submission2 = await submissionService.createSubmission(
        attempt2.id,
        'Learner design submission 2: improved parking lot addressing earlier feedback.'
      );
      expect(submission2.id).not.toBe(submission1.id);

      const eval2 = await evaluationService.evaluateSubmission(submission2.id);
      expect(eval2.id).not.toBe(eval1.id);

      // Verify Attempt 1 remains intact
      const preservedAttempt1 = await attemptService.getAttemptById(attempt1.id);
      expect(preservedAttempt1.submission?.id).toBe(submission1.id);
      expect(preservedAttempt1.submission?.evaluation?.id).toBe(eval1.id);
      expect(preservedAttempt1.submission?.content).toContain('initial draft');

      // Verify Attempt 2 has its own records
      const freshAttempt2 = await attemptService.getAttemptById(attempt2.id);
      expect(freshAttempt2.submission?.id).toBe(submission2.id);
      expect(freshAttempt2.submission?.evaluation?.id).toBe(eval2.id);
      expect(freshAttempt2.submission?.content).toContain('improved parking lot');

      // Clean up
      await prisma.feedback.deleteMany({ where: { evaluationId: { in: [eval1.id, eval2.id] } } });
      await prisma.evaluation.deleteMany({ where: { id: { in: [eval1.id, eval2.id] } } });
      await prisma.submission.deleteMany({ where: { id: { in: [submission1.id, submission2.id] } } });
      await prisma.attempt.deleteMany({ where: { id: { in: [attempt1.id, attempt2.id] } } });
    });
  });
});
