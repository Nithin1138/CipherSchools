import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';

describe('Learner Practice Flow End-to-End API Suite', () => {
  let server: http.Server;
  let baseUrl: string;
  let problemId: string;
  let problemSlug: string;
  let attempt1Id: string;
  let submission1Id: string;
  let evaluation1Id: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });

    const p = await prisma.problem.findFirst({
      where: { slug: 'parking-lot' },
    });
    if (!p) throw new Error('Seeded parking-lot problem not found');
    problemId = p.id;
    problemSlug = p.slug;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('1. Learner visits Problem Library: GET /api/problems', async () => {
    const res = await fetch(`${baseUrl}/api/problems`);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.problems).toBeDefined();
    expect(Array.isArray(body.problems)).toBe(true);
    expect(body.problems.length).toBeGreaterThanOrEqual(4);

    const target = body.problems.find((p: any) => p.id === problemId);
    expect(target).toBeDefined();
    expect(target.title).toBe('Parking Lot');
    expect(target.difficulty).toBe('MEDIUM');
  });

  it('2. Learner opens Problem Detail: GET /api/problems/:id and by slug', async () => {
    const resById = await fetch(`${baseUrl}/api/problems/${problemId}`);
    expect(resById.status).toBe(200);
    const bodyById: any = await resById.json();
    expect(bodyById.problem.id).toBe(problemId);
    expect(bodyById.problem.requirements.length).toBeGreaterThan(0);
    expect(bodyById.problem.constraints.length).toBeGreaterThan(0);

    const resBySlug = await fetch(`${baseUrl}/api/problems/slug/${problemSlug}`);
    expect(resBySlug.status).toBe(200);
    const bodyBySlug: any = await resBySlug.json();
    expect(bodyBySlug.problem.id).toBe(problemId);
  });

  it('3. Learner starts an Attempt: POST /api/problems/:problemId/attempts', async () => {
    const res = await fetch(`${baseUrl}/api/problems/${problemId}/attempts`, {
      method: 'POST',
    });
    expect(res.status).toBe(201);
    const body: any = await res.json();
    expect(body.attempt).toBeDefined();
    expect(body.attempt.problemId).toBe(problemId);
    expect(body.attempt.status).toBe('IN_PROGRESS');
    attempt1Id = body.attempt.id;
  });

  it('4. Learner views Attempt Workspace: GET /api/attempts/:attemptId', async () => {
    const res = await fetch(`${baseUrl}/api/attempts/${attempt1Id}`);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.attempt.id).toBe(attempt1Id);
    expect(body.attempt.status).toBe('IN_PROGRESS');
  });

  it('5. Learner submits solution: POST /api/attempts/:attemptId/submission', async () => {
    const solutionText = `
# Parking Lot System Design

## 1. Class Design
- Vehicle (Base): Car, Bike, Truck subclasses
- ParkingSpot: SpotType (Compact, Large, EV), isAvailable()
- ParkingLot: Singleton registry with Level lists
- Gate & Ticket: EntryGate, ExitGate, ParkingTicket

## 2. Dynamic Pricing Strategy
- FeeCalculator: Strategy pattern with HourlyFeeStrategy and SurgeFeeStrategy

## 3. Concurrency
- Atomic CAS / ReentrantLock on spot assignment to prevent double-booking.
    `.trim();

    const res = await fetch(`${baseUrl}/api/attempts/${attempt1Id}/submission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: solutionText, type: 'TEXT' }),
    });

    expect(res.status).toBe(201);
    const body: any = await res.json();
    expect(body.submission).toBeDefined();
    expect(body.submission.attemptId).toBe(attempt1Id);
    submission1Id = body.submission.id;

    // Verify attempt transitioned to COMPLETED
    const attRes = await fetch(`${baseUrl}/api/attempts/${attempt1Id}`);
    const attBody: any = await attRes.json();
    expect(attBody.attempt.status).toBe('COMPLETED');
  });

  it('6. Trigger Evaluation: POST /api/submissions/:submissionId/evaluation', async () => {
    const res = await fetch(`${baseUrl}/api/submissions/${submission1Id}/evaluation`, {
      method: 'POST',
    });
    expect(res.status).toBe(201);
    const body: any = await res.json();
    expect(body.evaluation).toBeDefined();
    expect(body.evaluation.submissionId).toBe(submission1Id);
    expect(body.evaluation.status).toBe('COMPLETED');
    expect(body.evaluation.totalScore).toBeGreaterThanOrEqual(0);
    evaluation1Id = body.evaluation.id;
  });

  it('7. View Evaluation Result: GET /api/evaluations/:evaluationId', async () => {
    const res = await fetch(`${baseUrl}/api/evaluations/${evaluation1Id}`);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.evaluation.id).toBe(evaluation1Id);
    expect(body.evaluation.status).toBe('COMPLETED');
    expect(body.evaluation.feedback).toBeDefined();
    expect(body.evaluation.feedback.length).toBe(7);

    for (const fb of body.evaluation.feedback) {
      expect(fb.criterionName).toBeDefined();
      expect(fb.score).toBeGreaterThanOrEqual(0);
      expect(fb.evidence).toBeDefined();
      expect(typeof fb.evidence).toBe('string');
      expect(fb.confidence).toBeGreaterThan(0);
    }
  });

  it('8. Learner clicks "Try Again": POST /api/problems/:problemId/attempts spawns new Attempt', async () => {
    const res = await fetch(`${baseUrl}/api/problems/${problemId}/attempts`, {
      method: 'POST',
    });
    expect(res.status).toBe(201);
    const body: any = await res.json();
    const attempt2Id = body.attempt.id;
    expect(attempt2Id).not.toBe(attempt1Id);
    expect(body.attempt.status).toBe('IN_PROGRESS');

    // Attempt 1 remains intact in history with its submission and evaluation
    const histRes = await fetch(`${baseUrl}/api/problems/${problemId}/attempts`);
    expect(histRes.status).toBe(200);
    const histBody: any = await histRes.json();
    const att1 = histBody.attempts.find((a: any) => a.id === attempt1Id);
    expect(att1).toBeDefined();
    expect(att1.status).toBe('COMPLETED');
    expect(att1.submission).toBeDefined();
    expect(att1.submission.id).toBe(submission1Id);
    expect(att1.submission.evaluation).toBeDefined();
    expect(att1.submission.evaluation.id).toBe(evaluation1Id);
  });
});
