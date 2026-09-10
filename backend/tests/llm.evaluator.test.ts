import { describe, it, expect, beforeEach } from 'vitest';
import prisma from '../src/lib/prisma.js';
import { LLMEvaluator } from '../src/evaluators/llm.evaluator.js';
import { MockLLMProvider } from '../src/evaluators/providers/mock.provider.js';
import { EvaluationService } from '../src/services/evaluation.service.js';
import { OutputValidator, OutputValidationError } from '../src/evaluators/validator.js';
import { EvaluationInput, CriterionSpec, EvaluationStatus, EvaluatorType } from '../src/domain/types.js';

describe('LLMEvaluator & Provider Architecture Tests (Phase 5)', () => {
  let mockProvider: MockLLMProvider;
  let evaluator: LLMEvaluator;

  const mockCriteria: CriterionSpec[] = [
    { id: 'crit-1', name: 'Requirement Understanding', description: 'Assesses scope and requirements', maxScore: 15, orderIndex: 1 },
    { id: 'crit-2', name: 'Class Responsibilities', description: 'Assesses SRP and god objects', maxScore: 20, orderIndex: 2 },
    { id: 'crit-3', name: 'Encapsulation & Interfaces', description: 'Assesses interfaces and coupling', maxScore: 15, orderIndex: 3 },
  ];

  const sampleInput: EvaluationInput = {
    problem: {
      title: 'Design a Parking Lot',
      description: 'Multi-level parking system',
      problemStatement: 'Design an automated parking lot system managing vehicle entry, spot allocation, and payment.',
      requirements: ['Vehicle entry/exit', 'Spot assignment by size', 'Payment calculation'],
      constraints: ['Thread-safe spot allocation', 'In-memory state'],
    },
    submission: {
      id: 'sub-test-123',
      type: 'TEXT',
      content: `class ParkingLot {
  List<Level> levels;
  Ticket issueTicket(Vehicle v) { return new Ticket(); }
}
interface ParkingStrategy {
  ParkingSpot findSpot(VehicleType type);
}`,
    },
    criteria: mockCriteria,
  };

  const validJsonResponse = JSON.stringify({
    criteria: [
      {
        criterionId: 'crit-1',
        criterionName: 'Requirement Understanding',
        score: 12,
        evidence: 'Submission implements entry/exit via issueTicket method.',
        concern: 'Payment flow and fee calculation strategies are omitted.',
        suggestion: 'Introduce a PaymentProcessor interface and fee strategy.',
        confidence: 0.95,
      },
      {
        criterionId: 'crit-2',
        criterionName: 'Class Responsibilities',
        score: 16,
        evidence: 'ParkingLot manages levels and issues tickets.',
        concern: 'ParkingLot could become a god object if it also manages payment directly.',
        suggestion: 'Separate ticketing service from parking lot coordinator.',
        confidence: 0.9,
      },
      {
        criterionId: 'crit-3',
        criterionName: 'Encapsulation & Interfaces',
        score: 14,
        evidence: 'Defines ParkingStrategy interface for finding spots.',
        concern: null,
        suggestion: 'Make ParkingSpot state private with encapsulated lock guards.',
        confidence: 0.85,
      },
    ],
  });

  beforeEach(() => {
    mockProvider = new MockLLMProvider('mock-tester-v1');
    evaluator = new LLMEvaluator(mockProvider);
  });

  // 1. Valid structured response
  it('1. parses and maps valid structured LLM response correctly', async () => {
    mockProvider.setResponse(validJsonResponse);

    const result = await evaluator.evaluate(sampleInput);

    expect(result.evaluatorType).toBe(EvaluatorType.LLM);
    expect(result.evaluatorModel).toBe('mock:mock-tester-v1');
    expect(result.criterionResults).toHaveLength(3);

    const [c1, c2, c3] = result.criterionResults;
    expect(c1.criterionId).toBe('crit-1');
    expect(c1.score).toBe(12);
    expect(c1.maxScore).toBe(15);
    expect(c1.confidence).toBe(0.95);
    expect(c1.evidence).toContain('issueTicket');

    expect(c2.criterionId).toBe('crit-2');
    expect(c2.score).toBe(16);

    expect(c3.criterionId).toBe('crit-3');
    expect(c3.score).toBe(14);
  });

  // 2. Missing criterion
  it('2. rejects output with missing rubric criteria', async () => {
    const missingCritResponse = JSON.stringify({
      criteria: [
        {
          criterionId: 'crit-1',
          score: 10,
          evidence: 'Some evidence',
        },
        // crit-2 and crit-3 missing
      ],
    });
    mockProvider.setResponse(missingCritResponse);

    await expect(evaluator.evaluate(sampleInput)).rejects.toThrow(OutputValidationError);
    await expect(evaluator.evaluate(sampleInput)).rejects.toThrow(/Missing rubric criterion/);
  });

  // 3. Unknown criterion
  it('3. rejects output with unknown criterion ID not present in rubric', async () => {
    const unknownCritResponse = JSON.stringify({
      criteria: [
        { criterionId: 'crit-1', score: 10, evidence: 'Valid' },
        { criterionId: 'crit-2', score: 15, evidence: 'Valid' },
        { criterionId: 'unknown-999', score: 10, evidence: 'Rogue criterion' },
      ],
    });
    mockProvider.setResponse(unknownCritResponse);

    await expect(evaluator.evaluate(sampleInput)).rejects.toThrow(/Unknown criterionId "unknown-999"/);
  });

  // 4. Duplicate criterion
  it('4. rejects output with duplicate criterion IDs', async () => {
    const duplicateCritResponse = JSON.stringify({
      criteria: [
        { criterionId: 'crit-1', score: 10, evidence: 'First instance' },
        { criterionId: 'crit-1', score: 12, evidence: 'Duplicate instance' },
        { criterionId: 'crit-2', score: 15, evidence: 'Valid' },
        { criterionId: 'crit-3', score: 10, evidence: 'Valid' },
      ],
    });
    mockProvider.setResponse(duplicateCritResponse);

    await expect(evaluator.evaluate(sampleInput)).rejects.toThrow(/Duplicate criterionId found/);
  });

  // 5. Score above maximum
  it('5. rejects criterion score exceeding maxScore', async () => {
    const scoreAboveMaxResponse = JSON.stringify({
      criteria: [
        { criterionId: 'crit-1', score: 25, evidence: 'Exceeds max 15' }, // Max is 15
        { criterionId: 'crit-2', score: 15, evidence: 'Valid' },
        { criterionId: 'crit-3', score: 10, evidence: 'Valid' },
      ],
    });
    mockProvider.setResponse(scoreAboveMaxResponse);

    await expect(evaluator.evaluate(sampleInput)).rejects.toThrow(/exceeds maximum allowable score/);
  });

  // 6. Negative score
  it('6. rejects negative criterion score', async () => {
    const negativeScoreResponse = JSON.stringify({
      criteria: [
        { criterionId: 'crit-1', score: -5, evidence: 'Negative score' },
        { criterionId: 'crit-2', score: 15, evidence: 'Valid' },
        { criterionId: 'crit-3', score: 10, evidence: 'Valid' },
      ],
    });
    mockProvider.setResponse(negativeScoreResponse);

    await expect(evaluator.evaluate(sampleInput)).rejects.toThrow(/Negative score \(-5\) provided/);
  });

  // 7. Invalid confidence
  it('7. rejects confidence value outside [0.0, 1.0] range', async () => {
    const invalidConfidenceResponse = JSON.stringify({
      criteria: [
        { criterionId: 'crit-1', score: 10, evidence: 'Valid', confidence: 1.5 },
        { criterionId: 'crit-2', score: 15, evidence: 'Valid', confidence: 0.9 },
        { criterionId: 'crit-3', score: 10, evidence: 'Valid', confidence: 0.8 },
      ],
    });
    mockProvider.setResponse(invalidConfidenceResponse);

    await expect(evaluator.evaluate(sampleInput)).rejects.toThrow(/confidence must be between 0.0 and 1.0/i);
  });

  // 8. Malformed JSON
  it('8. handles malformed JSON or markdown code fence wrappers properly', async () => {
    // 8a. Markdown code fence wrapper (should sanitize and succeed)
    mockProvider.setResponse('```json\n' + validJsonResponse + '\n```');
    const result = await evaluator.evaluate(sampleInput);
    expect(result.criterionResults).toHaveLength(3);

    // 8b. Completely broken JSON (should throw clean OutputValidationError)
    mockProvider.setResponse('NOT_JSON_AT_ALL { "bad": ');
    await expect(evaluator.evaluate(sampleInput)).rejects.toThrow(OutputValidationError);
    await expect(evaluator.evaluate(sampleInput)).rejects.toThrow(/Failed to parse LLM response as JSON/);
  });

  // 9. Provider failure
  it('9. handles upstream provider API error and surfaces clean failure', async () => {
    mockProvider.simulateFailure('Rate limit exceeded (429): Quota exhausted');

    await expect(evaluator.evaluate(sampleInput)).rejects.toThrow(/Rate limit exceeded/);
  });

  // 10. Timeout/failure path
  it('10. handles provider timeout correctly', async () => {
    mockProvider.simulateTimeout();

    await expect(evaluator.evaluate(sampleInput)).rejects.toThrow(/simulated timeout/);
  });

  // 11. Deterministic total score calculation
  it('11. verifies deterministic score calculation in EvaluationService', async () => {
    const activeRubric = await prisma.rubric.findFirst({
      where: { isDefault: true },
      include: { criteria: true },
    });

    const criteriaPayload = {
      criteria: activeRubric!.criteria.map((c, idx) => ({
        criterionId: c.id,
        criterionName: c.name,
        score: Math.min(c.maxScore, idx * 2), // deterministic scores bounded by maxScore
        evidence: `Demonstrated in TestSystem: "void run()" addressing ${c.name}`,
        concern: null,
        suggestion: null,
        confidence: 0.9,
      })),
    };

    mockProvider.setResponse(JSON.stringify(criteriaPayload));

    // Create problem & submission in test database
    const problem = await prisma.problem.create({
      data: {
        title: 'Score Calc Test Problem',
        slug: `score-calc-test-${Date.now()}`,
        description: 'Test problem for deterministic scoring',
        problemStatement: 'Design a test system',
        requirements: ['Req 1'],
        constraints: ['Constraint 1'],
      },
    });

    const attempt = await prisma.attempt.create({
      data: { problemId: problem.id },
    });

    const submission = await prisma.submission.create({
      data: {
        attemptId: attempt.id,
        content: 'class TestSystem { void run() {} }',
      },
    });

    const evalService = new EvaluationService(evaluator);
    const evaluation = await evalService.evaluateSubmission(submission.id, evaluator);

    expect(evaluation.status).toBe(EvaluationStatus.COMPLETED);
    const expectedSum = criteriaPayload.criteria.reduce((acc, c) => acc + c.score, 0);
    expect(evaluation.totalScore).toBe(expectedSum);
    expect(evaluation.maxScore).toBe(100);

    const feedbacks = await prisma.feedback.findMany({
      where: { evaluationId: evaluation.id },
    });
    const sumScores = feedbacks.reduce((acc, f) => acc + f.score, 0);
    expect(evaluation.totalScore).toBe(sumScores);
  });

  // 12. Successful evaluation persistence
  it('12. persists all criterion feedback items and metadata on success', async () => {
    // Generate valid response dynamically matching active database rubric criteria
    const activeRubric = await prisma.rubric.findFirst({
      where: { isDefault: true },
      include: { criteria: true },
    });

    const allCriteriaPayload = {
      criteria: activeRubric!.criteria.map((c) => ({
        criterionId: c.id,
        criterionName: c.name,
        score: Math.floor(c.maxScore * 0.8),
        evidence: `Demonstrated: "Strategy pattern" in architecture addressing ${c.name}`,
        concern: `Minor concern for ${c.name}`,
        suggestion: `Actionable suggestion for ${c.name}`,
        confidence: 0.95,
      })),
    };

    mockProvider.setResponse(JSON.stringify(allCriteriaPayload));

    const problem = await prisma.problem.findFirst();
    const attempt = await prisma.attempt.create({
      data: { problemId: problem!.id },
    });
    const submission = await prisma.submission.create({
      data: { attemptId: attempt.id, content: 'Detailed candidate architecture with Strategy pattern.' },
    });

    const evalService = new EvaluationService(evaluator);
    const completed = await evalService.evaluateSubmission(submission.id, evaluator);

    expect(completed.status).toBe(EvaluationStatus.COMPLETED);
    expect(completed.feedback).toHaveLength(activeRubric!.criteria.length);
    expect(completed.errorMessage).toBeNull();
  });

  // 13. Failed evaluation persistence
  it('13. marks evaluation FAILED and preserves submission intact when LLM fails', async () => {
    mockProvider.simulateFailure('Simulated Gemini 500 internal server error');

    const problem = await prisma.problem.findFirst();
    const attempt = await prisma.attempt.create({
      data: { problemId: problem!.id },
    });
    const submission = await prisma.submission.create({
      data: { attemptId: attempt.id, content: 'Candidate submission that encounters provider failure.' },
    });

    const evalService = new EvaluationService(evaluator);

    await expect(evalService.evaluateSubmission(submission.id, evaluator)).rejects.toThrow();

    // Verify submission is still present and unmodified
    const preservedSub = await prisma.submission.findUnique({
      where: { id: submission.id },
      include: { evaluation: true },
    });
    expect(preservedSub).not.toBeNull();
    expect(preservedSub!.content).toBe('Candidate submission that encounters provider failure.');
    expect(preservedSub!.evaluation!.status).toBe(EvaluationStatus.FAILED);
    expect(preservedSub!.evaluation!.errorMessage).toContain('Simulated Gemini 500');
  });

  // 14. Retry after failure
  it('14. retries a FAILED evaluation in-place without creating duplicate records', async () => {
    // First: fail the evaluation
    mockProvider.simulateFailure('Temporary upstream network failure');

    const problem = await prisma.problem.findFirst();
    const attempt = await prisma.attempt.create({
      data: { problemId: problem!.id },
    });
    const submission = await prisma.submission.create({
      data: { attemptId: attempt.id, content: 'Submission for in-place retry verification.' },
    });

    const evalService = new EvaluationService(evaluator);
    await expect(evalService.evaluateSubmission(submission.id, evaluator)).rejects.toThrow();

    const failedEval = await prisma.evaluation.findUnique({
      where: { submissionId: submission.id },
    });
    expect(failedEval!.status).toBe(EvaluationStatus.FAILED);

    // Second: now mock provider succeeds
    const activeRubric = await prisma.rubric.findFirst({
      where: { isDefault: true },
      include: { criteria: true },
    });
    const successPayload = {
      criteria: activeRubric!.criteria.map((c) => ({
        criterionId: c.id,
        criterionName: c.name,
        score: c.maxScore,
        evidence: `Retry evidence for ${c.name}`,
        confidence: 0.99,
      })),
    };
    mockProvider.setResponse(JSON.stringify(successPayload));

    // Retry evaluation
    const retriedEval = await evalService.evaluateSubmission(submission.id, evaluator);

    expect(retriedEval.id).toBe(failedEval!.id); // EXACT SAME EVALUATION ROW!
    expect(retriedEval.status).toBe(EvaluationStatus.COMPLETED);
    expect(retriedEval.errorMessage).toBeNull();
    expect(retriedEval.totalScore).toBe(100);

    // Verify database has only 1 evaluation row for this submission
    const allEvalsForSub = await prisma.evaluation.findMany({
      where: { submissionId: submission.id },
    });
    expect(allEvalsForSub).toHaveLength(1);
  });

  // 15. Valid direct quotation evidence
  it('15. accepts valid direct quotation evidence matching submission', () => {
    const groundedJson = {
      criteria: mockCriteria.map((c) => ({
        criterionId: c.id,
        criterionName: c.name,
        score: c.maxScore,
        evidence: `Directly quotes submission: "issueTicket" and "ParkingSpot" for ${c.name}.`,
        confidence: 0.95,
      })),
    };

    const results = OutputValidator.validate(groundedJson, mockCriteria, sampleInput.submission.content);
    expect(results).toHaveLength(mockCriteria.length);
    expect(results[0].evidence).toContain('issueTicket');
  });

  // 16. Valid explicit missing/unspecified evidence
  it('16. accepts explicit missing/unspecified evidence for omitted requirements', () => {
    const unspecifiedJson = {
      criteria: mockCriteria.map((c) => ({
        criterionId: c.id,
        criterionName: c.name,
        score: Math.floor(c.maxScore * 0.5),
        evidence: `The submission does not specify thread safety or lock primitives for ${c.name}.`,
        confidence: 0.9,
      })),
    };

    const results = OutputValidator.validate(unspecifiedJson, mockCriteria, sampleInput.submission.content);
    expect(results).toHaveLength(mockCriteria.length);
    expect(results[0].evidence).toContain('does not specify');
  });

  // 17. Rejects fabricated evidence
  it('17. rejects fabricated evidence that does not exist in the submission', () => {
    const fabricatedJson = {
      criteria: mockCriteria.map((c) => ({
        criterionId: c.id,
        criterionName: c.name,
        score: c.maxScore,
        evidence: `Candidate configured a distributed Kafka stream and Redis cluster with ZooKeeper orchestration.`,
        confidence: 0.9,
      })),
    };

    expect(() =>
      OutputValidator.validate(fabricatedJson, mockCriteria, sampleInput.submission.content)
    ).toThrow(OutputValidationError);
    expect(() =>
      OutputValidator.validate(fabricatedJson, mockCriteria, sampleInput.submission.content)
    ).toThrow(/Evidence grounding validation failed/i);
  });

  // 18. Rejects generic placeholder evidence
  it('18. rejects generic placeholder evidence (e.g. "Evaluated submission.", "Looks good.")', () => {
    const placeholderJson = {
      criteria: mockCriteria.map((c) => ({
        criterionId: c.id,
        criterionName: c.name,
        score: c.maxScore,
        evidence: `Evaluated submission.`,
        confidence: 0.9,
      })),
    };

    expect(() =>
      OutputValidator.validate(placeholderJson, mockCriteria, sampleInput.submission.content)
    ).toThrow(OutputValidationError);
    expect(() =>
      OutputValidator.validate(placeholderJson, mockCriteria, sampleInput.submission.content)
    ).toThrow(/Generic placeholder evidence is not permitted/i);
  });
});
