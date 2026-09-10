import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProblemCard } from '../components/ProblemCard.js';
import { ErrorState } from '../components/ErrorState.js';
import { LoadingState } from '../components/LoadingState.js';
import { ScoreDisplay } from '../components/ScoreDisplay.js';
import { FeedbackCard } from '../components/FeedbackCard.js';
import { AttemptHistory } from '../components/AttemptHistory.js';
import { ProblemLibrary } from '../pages/ProblemLibrary.js';
import { EvaluationResult } from '../pages/EvaluationResult.js';
import type { Problem, AttemptHistoryItem, CriterionFeedback } from '../types/index.js';

describe('Frontend Component & Page Flow Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockProblem: Problem = {
    id: 'prob-1',
    slug: 'parking-lot',
    title: 'Design a Parking Lot',
    description: 'Design an automated multi-floor parking lot system.',
    problemStatement: 'Design a parking lot with vehicle entry, spot allocation, and fee calculation.',
    requirements: ['Support vehicle types', 'Multiple floors', 'Payment strategy'],
    constraints: ['In-memory state', 'Thread-safe spot assignment'],
    difficulty: 'MEDIUM',
    createdAt: '2026-09-08T00:00:00.000Z',
  };

  const mockFeedback: CriterionFeedback = {
    id: 'fb-1',
    criterionName: 'Class Responsibilities (SRP)',
    score: 18,
    maxScore: 20,
    evidence: 'ParkingLot coordinates floors while TicketManager handles ticket issuance.',
    concern: 'ParkingLot could become bloated if fee calculations are added directly.',
    suggestion: 'Extract fee calculation into an independent FeeCalculationStrategy.',
    confidence: 0.95,
  };

  // 1. Problem Library Rendering
  it('1. renders problem cards with title, description, and difficulty badge', () => {
    render(
      <MemoryRouter>
        <ProblemCard problem={mockProblem} />
      </MemoryRouter>
    );

    expect(screen.getByText('Design a Parking Lot')).toBeDefined();
    expect(screen.getByText('MEDIUM')).toBeDefined();
    expect(screen.getByText(/automated multi-floor parking lot/i)).toBeDefined();
    expect(screen.getByRole('link', { name: /Practice Design a Parking Lot/i })).toBeDefined();
  });

  it('1b. renders problem library with list of problems fetched from API', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/problems')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ problems: [mockProblem] }),
        } as Response);
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(
      <MemoryRouter>
        <ProblemLibrary />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Design a Parking Lot')).toBeDefined();
      expect(screen.getByRole('link', { name: /Practice Design a Parking Lot/i })).toBeDefined();
    });
  });

  // 2. Empty & Error States
  it('2. renders actionable ErrorState with retry button', () => {
    const onRetry = vi.fn();
    render(
      <MemoryRouter>
        <ErrorState
          title="Network Connection Failed"
          message="Could not reach the practice server. Please verify your connection."
          onRetry={onRetry}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Network Connection Failed')).toBeDefined();
    expect(screen.getByText(/Could not reach the practice server/i)).toBeDefined();

    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('2b. renders LoadingState with spinner and informative message', () => {
    render(<LoadingState message="Loading Practice Workspace..." description="Fetching problem details and rubric" />);
    expect(screen.getByText('Loading Practice Workspace...')).toBeDefined();
    expect(screen.getByText('Fetching problem details and rubric')).toBeDefined();
  });

  // 3. Attempt History with Trajectory Comparison
  it('3. renders attempt history with status, score, and comparison trajectory signals', () => {
    const mockAttempts: AttemptHistoryItem[] = [
      {
        id: 'att-2',
        problemId: 'prob-1',
        status: 'COMPLETED',
        startedAt: '2026-09-09T12:00:00.000Z',
        completedAt: '2026-09-09T12:05:00.000Z',
        submission: {
          id: 'sub-2',
          type: 'TEXT',
          submittedAt: '2026-09-09T12:05:00.000Z',
          evaluation: {
            id: 'eval-2',
            status: 'COMPLETED',
            totalScore: 90,
            maxScore: 100,
            completedAt: '2026-09-09T12:05:03.000Z',
          },
        },
      },
      {
        id: 'att-1',
        problemId: 'prob-1',
        status: 'COMPLETED',
        startedAt: '2026-09-09T10:00:00.000Z',
        completedAt: '2026-09-09T10:05:00.000Z',
        submission: {
          id: 'sub-1',
          type: 'TEXT',
          submittedAt: '2026-09-09T10:05:00.000Z',
          evaluation: {
            id: 'eval-1',
            status: 'COMPLETED',
            totalScore: 75,
            maxScore: 100,
            completedAt: '2026-09-09T10:05:03.000Z',
          },
        },
      },
    ];

    render(
      <MemoryRouter>
        <AttemptHistory attempts={mockAttempts} loading={false} onStartNewAttempt={vi.fn()} />
      </MemoryRouter>
    );

    // Attempt #2 shows +15 pts improvement
    expect(screen.getByText('Attempt #2')).toBeDefined();
    expect(screen.getByText(/90 \/ 100/)).toBeDefined();
    expect(screen.getByText(/\+15 pts/)).toBeDefined();

    // Attempt #1 shows baseline
    expect(screen.getByText('Attempt #1')).toBeDefined();
    expect(screen.getByText(/75 \/ 100/)).toBeDefined();
    expect(screen.getByText('Baseline')).toBeDefined();
  });

  // 4. Completed Evaluation Feedback & Score Display
  it('4. renders ScoreDisplay and FeedbackCard with evidence and suggestions on completion', () => {
    render(
      <ScoreDisplay
        totalScore={88}
        maxScore={100}
        status="COMPLETED"
        evaluatorType="LLM"
      />
    );

    expect(screen.getByText('88')).toBeDefined();
    expect(screen.getByText(/100/)).toBeDefined();
    expect(screen.getByText(/Exceptional Architecture/i)).toBeDefined();

    render(<FeedbackCard feedback={mockFeedback} index={0} />);
    expect(screen.getByText(/Criterion #1/i)).toBeDefined();
    expect(screen.getByText(/Class Responsibilities \(SRP\)/i)).toBeDefined();
    expect(screen.getByText(/ParkingLot coordinates floors/i)).toBeDefined();
    expect(screen.getByText(/Extract fee calculation/i)).toBeDefined();
  });

  // 5. Evaluation State Machine: Evaluating in Progress
  it('5. renders evaluating progress banner when status is EVALUATING', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/submissions/sub-evaluating')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            submission: {
              id: 'sub-evaluating',
              attemptId: 'att-1',
              type: 'TEXT',
              content: 'Sample solution text.',
              submittedAt: new Date().toISOString(),
              evaluation: {
                id: 'eval-pending',
                submissionId: 'sub-evaluating',
                evaluatorType: 'LLM',
                status: 'EVALUATING',
                totalScore: null,
                maxScore: 100,
                startedAt: new Date().toISOString(),
                feedback: [],
              },
            },
          }),
        } as Response);
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(
      <MemoryRouter initialEntries={['/submissions/sub-evaluating']}>
        <Routes>
          <Route path="/submissions/:submissionId" element={<EvaluationResult />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Evaluating Your Low-Level Design/i)).toBeDefined();
    });

    // Verify no completed score is displayed while evaluating
    expect(screen.queryByText(/Exceptional Architecture/i)).toBeNull();
  });

  // 6. Failed Evaluation State & In-Place Retry
  it('6. renders failure banner and actionable retry button on evaluation failure', async () => {
    let retryCalled = false;
    globalThis.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/evaluations/eval-failed/retry') && options?.method === 'POST') {
        retryCalled = true;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            evaluation: {
              id: 'eval-failed',
              submissionId: 'sub-failed',
              evaluatorType: 'LLM',
              status: 'EVALUATING',
              totalScore: null,
              maxScore: 100,
              startedAt: new Date().toISOString(),
              feedback: [],
            },
          }),
        } as Response);
      }

      if (url.includes('/submissions/sub-failed')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            submission: {
              id: 'sub-failed',
              attemptId: 'att-1',
              type: 'TEXT',
              content: 'Sample solution text.',
              submittedAt: new Date().toISOString(),
              evaluation: {
                id: 'eval-failed',
                submissionId: 'sub-failed',
                evaluatorType: 'LLM',
                status: 'FAILED',
                totalScore: null,
                maxScore: 100,
                errorMessage: 'Simulated LLM rate limit (429)',
                startedAt: new Date().toISOString(),
                feedback: [],
              },
            },
          }),
        } as Response);
      }

      return Promise.reject(new Error('Unknown url'));
    });

    render(
      <MemoryRouter initialEntries={['/submissions/sub-failed']}>
        <Routes>
          <Route path="/submissions/:submissionId" element={<EvaluationResult />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Evaluation Failed/i)).toBeDefined();
      expect(screen.getByText(/Simulated LLM rate limit/i)).toBeDefined();
    });

    const retryBtn = screen.getByRole('button', { name: /Retry Evaluation/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(retryCalled).toBe(true);
    });
  });

  // 7. Try Again (Create New Attempt Navigation)
  it('7. renders Try Again button enabling iterative attempt cycles', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/submissions/sub-completed')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            submission: {
              id: 'sub-completed',
              attemptId: 'att-1',
              type: 'TEXT',
              content: 'Completed attempt solution.',
              submittedAt: new Date().toISOString(),
              attempt: {
                id: 'att-1',
                problemId: 'prob-1',
              },
              evaluation: {
                id: 'eval-completed',
                submissionId: 'sub-completed',
                evaluatorType: 'LLM',
                status: 'COMPLETED',
                totalScore: 85,
                maxScore: 100,
                startedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                feedback: [mockFeedback],
              },
            },
          }),
        } as Response);
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(
      <MemoryRouter initialEntries={['/submissions/sub-completed']}>
        <Routes>
          <Route path="/submissions/:submissionId" element={<EvaluationResult />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      const tryAgainButtons = screen.getAllByText(/Try Again/i);
      expect(tryAgainButtons.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('85')).toBeDefined();
    });
  });
});
