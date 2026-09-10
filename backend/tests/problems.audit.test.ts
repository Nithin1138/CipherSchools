import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';

describe('Curated Problems & Evaluator Integration Test Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  const EXPECTED_PROBLEMS = [
    {
      slug: 'parking-lot',
      title: 'Parking Lot',
      difficulty: 'MEDIUM',
      solutionSnippet: `
# Parking Lot LLD Solution
## Entities
- Vehicle: Motorcycle, Car, Bus, ElectricVehicle
- ParkingSpot: CompactSpot, LargeSpot, EVSpot
- ParkingLot: Multi-floor coordinator with spot lookup map
- EntryGate / ExitGate: Ticket issuing and fee calculation
## Design Patterns & Concurrency
- Strategy Pattern for dynamic fee calculation (hourly vs surge)
- Mutex / Synchronized blocks on spot allocation to prevent race conditions.
      `.trim(),
    },
    {
      slug: 'elevator-system',
      title: 'Elevator System',
      difficulty: 'HARD',
      solutionSnippet: `
# Elevator System LLD Solution
## Entities
- ElevatorCar: currentFloor, direction (UP, DOWN, IDLE), doorState (OPEN, CLOSED)
- ElevatorController: Manages bank of N cars, hall calls, and internal requests
- Dispatcher: Pluggable SCAN / LOOK elevator algorithm
## State Machine & Safety
- Car state transitions: Idle -> Moving -> Stopped -> DoorOpening -> DoorClosing
- Hardware interlocks: Car cannot move while doors are open.
      `.trim(),
    },
    {
      slug: 'vending-machine',
      title: 'Vending Machine',
      difficulty: 'MEDIUM',
      solutionSnippet: `
# Vending Machine LLD Solution
## State Pattern Implementation
- States: IdleState, ItemSelectedState, PaymentPendingState, DispensingState
- VendingMachine context coordinates transitions and cash reserves
## Inventory & Payment
- Inventory: Slot racks with product prices and quantities
- Payment: Coin/Card payment processor with change return algorithm using available coin denominations.
      `.trim(),
    },
    {
      slug: 'food-delivery',
      title: 'Food Delivery',
      difficulty: 'HARD',
      solutionSnippet: `
# Food Delivery Platform LLD Solution
## Actors & Domain Models
- Customer, RestaurantPartner, DeliveryAgent, Order
- Order lifecycle: Placed -> Confirmed -> Preparing -> ReadyForPickup -> InTransit -> Delivered
## Strategies & Concurrency
- DriverAssignmentStrategy: Decoupled proximity-based driver matching
- Concurrent state locking on driver acceptance to prevent duplicate order claims.
      `.trim(),
    },
  ];

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('1. Verifies the default 100-point rubric is complete and stable', async () => {
    const res = await fetch(`${baseUrl}/api/rubric`);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.rubric).toBeDefined();
    expect(body.rubric.criteria.length).toBe(7);

    const totalWeight = body.rubric.criteria.reduce((sum: number, c: any) => sum + c.maxScore, 0);
    expect(totalWeight).toBe(100);

    const names = body.rubric.criteria.map((c: any) => c.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(7);
  });

  for (const probSpec of EXPECTED_PROBLEMS) {
    it(`2. Evaluates problem "${probSpec.title}" (${probSpec.slug}) end-to-end`, async () => {
      // 1. Fetch problem by slug
      const pRes = await fetch(`${baseUrl}/api/problems/slug/${probSpec.slug}`);
      expect(pRes.status).toBe(200);
      const pBody: any = await pRes.json();
      expect(pBody.problem.title).toBe(probSpec.title);
      expect(pBody.problem.difficulty).toBe(probSpec.difficulty);
      expect(pBody.problem.requirements.length).toBeGreaterThan(0);
      expect(pBody.problem.constraints.length).toBeGreaterThan(0);

      const problemId = pBody.problem.id;

      // 2. Create attempt
      const aRes = await fetch(`${baseUrl}/api/problems/${problemId}/attempts`, { method: 'POST' });
      expect(aRes.status).toBe(201);
      const aBody: any = await aRes.json();
      const attemptId = aBody.attempt.id;

      // 3. Create submission with tailored solution
      const sRes = await fetch(`${baseUrl}/api/attempts/${attemptId}/submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: probSpec.solutionSnippet, type: 'TEXT' }),
      });
      expect(sRes.status).toBe(201);
      const sBody: any = await sRes.json();
      const submissionId = sBody.submission.id;

      // 4. Trigger evaluation
      const eRes = await fetch(`${baseUrl}/api/submissions/${submissionId}/evaluation`, { method: 'POST' });
      expect(eRes.status).toBe(201);
      const eBody: any = await eRes.json();
      const evaluation = eBody.evaluation;

      expect(evaluation.status).toBe('COMPLETED');
      expect(evaluation.maxScore).toBe(100);
      expect(evaluation.totalScore).toBeGreaterThanOrEqual(0);
      expect(evaluation.totalScore).toBeLessThanOrEqual(100);

      // Verify deterministic score sum
      const sumScores = evaluation.feedback.reduce((acc: number, f: any) => acc + f.score, 0);
      expect(evaluation.totalScore).toBe(sumScores);

      // Verify all 7 criteria feedback
      expect(evaluation.feedback.length).toBe(7);
      for (const fb of evaluation.feedback) {
        expect(fb.criterionName).toBeDefined();
        expect(fb.score).toBeGreaterThanOrEqual(0);
        expect(fb.score).toBeLessThanOrEqual(fb.maxScore);
        expect(fb.evidence).toBeDefined();
        expect(fb.evidence.length).toBeGreaterThan(0);
        expect(fb.confidence).toBeGreaterThan(0);
      }
    });
  }

  it('3. Guarantees completed evaluations are immutable against duplicate POST', async () => {
    // Find any existing completed submission
    const existingEval = await prisma.evaluation.findFirst({
      where: { status: 'COMPLETED' },
    });
    expect(existingEval).toBeDefined();

    // Re-triggering evaluate on an already completed submission returns the completed record safely
    const retriggerRes = await fetch(`${baseUrl}/api/submissions/${existingEval!.submissionId}/evaluation`, {
      method: 'POST',
    });
    expect(retriggerRes.status).toBe(201);
    const retriggerBody: any = await retriggerRes.json();
    expect(retriggerBody.evaluation.id).toBe(existingEval!.id);
    expect(retriggerBody.evaluation.status).toBe('COMPLETED');

    // Attempting to retry a COMPLETED evaluation must be rejected with 400
    const retryRes = await fetch(`${baseUrl}/api/evaluations/${existingEval!.id}/retry`, {
      method: 'POST',
    });
    expect(retryRes.status).toBe(400);
    const retryBody: any = await retryRes.json();
    expect(retryBody.error.code).toBe('BAD_REQUEST');
  });
});
