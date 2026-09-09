import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { evaluationService } from '../src/services/evaluation.service.js';

describe('LLD Practice Platform - REST API Integration Tests', () => {
  let server: http.Server;
  let baseUrl: string;
  let parkingLotId: string;

  beforeAll(async () => {
    // Start test HTTP server on an ephemeral port
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });

    // Locate seeded Parking Lot problem
    const problem = await prisma.problem.findFirst({
      where: { slug: 'parking-lot' },
    });
    if (!problem) {
      throw new Error('Seeded problems missing. Run npm run db:seed first.');
    }
    parkingLotId = problem.id;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  describe('1. Problems Endpoints', () => {
    it('GET /api/problems returns all seeded problems', async () => {
      const res = await fetch(`${baseUrl}/api/problems`);
      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(Array.isArray(data.problems)).toBe(true);
      expect(data.problems.length).toBeGreaterThanOrEqual(4);

      const slugs = data.problems.map((p: any) => p.slug);
      expect(slugs).toContain('parking-lot');
      expect(slugs).toContain('elevator-system');
    });

    it('GET /api/problems/:id returns problem details by ID', async () => {
      const res = await fetch(`${baseUrl}/api/problems/${parkingLotId}`);
      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(data.problem.id).toBe(parkingLotId);
      expect(data.problem.title).toBe('Parking Lot');
      expect(Array.isArray(data.problem.requirements)).toBe(true);
    });

    it('GET /api/problems/slug/:slug returns problem details by slug', async () => {
      const res = await fetch(`${baseUrl}/api/problems/slug/parking-lot`);
      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(data.problem.slug).toBe('parking-lot');
      expect(data.problem.id).toBe(parkingLotId);
    });

    it('GET /api/problems/:id with invalid ID returns 404', async () => {
      const res = await fetch(`${baseUrl}/api/problems/00000000-0000-0000-0000-000000000000`);
      expect(res.status).toBe(404);

      const data = (await res.json()) as any;
      expect(data.error.code).toBe('NOT_FOUND');
      expect(data.error.message).toContain('not found');
    });
  });

  describe('2. Attempts Endpoints', () => {
    let testAttemptId: string;

    it('POST /api/problems/:problemId/attempts creates an attempt in IN_PROGRESS state', async () => {
      const res = await fetch(`${baseUrl}/api/problems/${parkingLotId}/attempts`, {
        method: 'POST',
      });
      expect(res.status).toBe(201);

      const data = (await res.json()) as any;
      expect(data.attempt.id).toBeDefined();
      expect(data.attempt.problemId).toBe(parkingLotId);
      expect(data.attempt.status).toBe('IN_PROGRESS');

      testAttemptId = data.attempt.id;
    });

    it('GET /api/attempts/:attemptId retrieves attempt details', async () => {
      const res = await fetch(`${baseUrl}/api/attempts/${testAttemptId}`);
      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(data.attempt.id).toBe(testAttemptId);
      expect(data.attempt.problem.slug).toBe('parking-lot');
    });

    it('GET /api/problems/:problemId/attempts returns list of attempts for problem', async () => {
      const res = await fetch(`${baseUrl}/api/problems/${parkingLotId}/attempts`);
      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(Array.isArray(data.attempts)).toBe(true);
      const ids = data.attempts.map((a: any) => a.id);
      expect(ids).toContain(testAttemptId);

      // Clean up test attempt
      await prisma.attempt.delete({ where: { id: testAttemptId } });
    });
  });

  describe('3. Submissions Endpoints', () => {
    let attemptId: string;
    let submissionId: string;

    beforeAll(async () => {
      const attempt = await prisma.attempt.create({
        data: { problemId: parkingLotId, status: 'IN_PROGRESS' },
      });
      attemptId = attempt.id;
    });

    afterAll(async () => {
      if (submissionId) {
        await prisma.submission.deleteMany({ where: { id: submissionId } });
      }
      await prisma.attempt.deleteMany({ where: { id: attemptId } });
    });

    it('POST /api/attempts/:attemptId/submission rejects empty content with 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}/api/attempts/${attemptId}/submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '   ' }),
      });
      expect(res.status).toBe(400);

      const data = (await res.json()) as any;
      expect(data.error.code).toBe('BAD_REQUEST');
    });

    it('POST /api/attempts/:attemptId/submission persists valid submission and returns 201 Created', async () => {
      const validContent = 'Design containing ParkingLot, Levels, ParkingSpots, Vehicle hierarchy, and FeeStrategy.';
      const res = await fetch(`${baseUrl}/api/attempts/${attemptId}/submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: validContent, type: 'TEXT' }),
      });
      expect(res.status).toBe(201);

      const data = (await res.json()) as any;
      expect(data.submission.id).toBeDefined();
      expect(data.submission.attemptId).toBe(attemptId);
      expect(data.submission.content).toBe(validContent);

      submissionId = data.submission.id;
    });

    it('POST /api/attempts/:attemptId/submission rejects duplicate submission with 409 Conflict', async () => {
      const res = await fetch(`${baseUrl}/api/attempts/${attemptId}/submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Second submission should be rejected.' }),
      });
      expect(res.status).toBe(409);

      const data = (await res.json()) as any;
      expect(data.error.code).toBe('CONFLICT');
      expect(data.error.message).toContain('already has a submission');
    });

    it('GET /api/submissions/:submissionId retrieves submission details', async () => {
      const res = await fetch(`${baseUrl}/api/submissions/${submissionId}`);
      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(data.submission.id).toBe(submissionId);
    });
  });

  describe('4. Evaluations Endpoints & Retry', () => {
    let attemptId: string;
    let submissionId: string;
    let evaluationId: string;

    beforeAll(async () => {
      const attempt = await prisma.attempt.create({
        data: { problemId: parkingLotId, status: 'IN_PROGRESS' },
      });
      attemptId = attempt.id;

      const submission = await prisma.submission.create({
        data: {
          attemptId: attempt.id,
          content: 'Parking Lot design with Singleton pattern for manager, Factory for tickets, and Strategy for pricing.',
        },
      });
      submissionId = submission.id;
    });

    afterAll(async () => {
      if (evaluationId) {
        await prisma.feedback.deleteMany({ where: { evaluationId } });
        await prisma.evaluation.deleteMany({ where: { id: evaluationId } });
      }
      await prisma.submission.deleteMany({ where: { id: submissionId } });
      await prisma.attempt.deleteMany({ where: { id: attemptId } });
    });

    it('POST /api/submissions/:submissionId/evaluation triggers evaluation and returns 201 Created', async () => {
      const res = await fetch(`${baseUrl}/api/submissions/${submissionId}/evaluation`, {
        method: 'POST',
      });
      expect(res.status).toBe(201);

      const data = (await res.json()) as any;
      expect(data.evaluation.id).toBeDefined();
      expect(data.evaluation.status).toBe('COMPLETED');
      expect(data.evaluation.totalScore).toBeGreaterThan(0);
      expect(Array.isArray(data.evaluation.feedback)).toBe(true);

      evaluationId = data.evaluation.id;
    });

    it('GET /api/evaluations/:evaluationId retrieves evaluation score and feedback', async () => {
      const res = await fetch(`${baseUrl}/api/evaluations/${evaluationId}`);
      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(data.evaluation.id).toBe(evaluationId);
      expect(data.evaluation.maxScore).toBe(100);
    });

    it('POST /api/evaluations/:evaluationId/retry rejects retrying a COMPLETED evaluation with 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}/api/evaluations/${evaluationId}/retry`, {
        method: 'POST',
      });
      expect(res.status).toBe(400);

      const data = (await res.json()) as any;
      expect(data.error.code).toBe('BAD_REQUEST');
      expect(data.error.message).toContain('Only FAILED evaluations can be retried');
    });

    it('POST /api/evaluations/:evaluationId/retry re-evaluates a FAILED evaluation to COMPLETED preserving the same evaluation row', async () => {
      // 1. Create a fresh attempt and submission
      const resAttempt = await fetch(`${baseUrl}/api/problems/${parkingLotId}/attempts`, { method: 'POST' });
      const { attempt: retryAttempt } = (await resAttempt.json()) as any;

      const resSub = await fetch(`${baseUrl}/api/attempts/${retryAttempt.id}/submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Complete retry test: Parking lot design with vehicle hierarchies and ticket issuing.' }),
      });
      const { submission: retrySub } = (await resSub.json()) as any;

      // 2. Force an evaluation failure
      const createdEval = await evaluationService.createEvaluation(retrySub.id);
      await evaluationService.startEvaluation(createdEval.id);
      const failedEval = await evaluationService.markEvaluationFailed(createdEval.id, 'Simulated upstream model timeout');
      expect(failedEval.status).toBe('FAILED');

      // 3. Call the HTTP retry endpoint
      const resRetry = await fetch(`${baseUrl}/api/evaluations/${failedEval.id}/retry`, {
        method: 'POST',
      });
      expect(resRetry.status).toBe(200);

      const dataRetry = (await resRetry.json()) as any;
      expect(dataRetry.evaluation.id).toBe(failedEval.id); // Same evaluation ID (in-place retry)
      expect(dataRetry.evaluation.status).toBe('COMPLETED');
      expect(dataRetry.evaluation.totalScore).toBeGreaterThan(0);
      expect(Array.isArray(dataRetry.evaluation.feedback)).toBe(true);
      expect(dataRetry.evaluation.feedback.length).toBe(7); // All 7 canonical criteria persisted
    });
  });

  describe('5. Learner Retry End-to-End Cycle', () => {
    it('creates brand new Attempt and preserves Attempt 1 historical data untouched', async () => {
      // Step 1: Learner attempt 1
      const resAttempt1 = await fetch(`${baseUrl}/api/problems/${parkingLotId}/attempts`, { method: 'POST' });
      const { attempt: attempt1 } = (await resAttempt1.json()) as any;

      const resSub1 = await fetch(`${baseUrl}/api/attempts/${attempt1.id}/submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Attempt 1 design: initial basic parking spot classes.' }),
      });
      const { submission: sub1 } = (await resSub1.json()) as any;

      const resEval1 = await fetch(`${baseUrl}/api/submissions/${sub1.id}/evaluation`, { method: 'POST' });
      const { evaluation: eval1 } = (await resEval1.json()) as any;
      expect(eval1.status).toBe('COMPLETED');

      // Step 2: Learner clicks "Try Again" -> creates Attempt 2
      const resAttempt2 = await fetch(`${baseUrl}/api/problems/${parkingLotId}/attempts`, { method: 'POST' });
      const { attempt: attempt2 } = (await resAttempt2.json()) as any;
      expect(attempt2.id).not.toBe(attempt1.id);

      const resSub2 = await fetch(`${baseUrl}/api/attempts/${attempt2.id}/submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Attempt 2 design: improved concurrent lock management.' }),
      });
      const { submission: sub2 } = (await resSub2.json()) as any;
      expect(sub2.id).not.toBe(sub1.id);

      // Step 3: Verify Attempt 1 remains intact
      const resCheckAttempt1 = await fetch(`${baseUrl}/api/attempts/${attempt1.id}`);
      const { attempt: checked1 } = (await resCheckAttempt1.json()) as any;
      expect(checked1.submission.id).toBe(sub1.id);
      expect(checked1.submission.evaluation.id).toBe(eval1.id);
      expect(checked1.submission.content).toContain('Attempt 1 design');

      // Clean up
      await prisma.feedback.deleteMany({ where: { evaluationId: { in: [eval1.id] } } });
      await prisma.evaluation.deleteMany({ where: { id: { in: [eval1.id] } } });
      await prisma.submission.deleteMany({ where: { id: { in: [sub1.id, sub2.id] } } });
      await prisma.attempt.deleteMany({ where: { id: { in: [attempt1.id, attempt2.id] } } });
    });
  });
});
