import type { Problem, Rubric, Attempt, Submission, Evaluation, AttemptHistoryItem } from '../types/index.js';

const API_BASE = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const body = await res.json();
      if (body.error) {
        errorMsg = typeof body.error === 'string' ? body.error : body.error.message || errorMsg;
      }
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

export const api = {
  // Health
  getHealth: async (): Promise<{ status: string }> => {
    const res = await fetch(`${API_BASE}/health`);
    return handleResponse<{ status: string }>(res);
  },

  // Problems
  getProblems: async (): Promise<Problem[]> => {
    const res = await fetch(`${API_BASE}/problems`);
    const data = await handleResponse<{ problems: Problem[] }>(res);
    return data.problems;
  },

  getProblem: async (idOrSlug: string): Promise<Problem> => {
    const res = await fetch(`${API_BASE}/problems/${idOrSlug}`);
    const data = await handleResponse<{ problem: Problem }>(res);
    return data.problem;
  },

  getProblemAttempts: async (problemId: string): Promise<AttemptHistoryItem[]> => {
    const res = await fetch(`${API_BASE}/problems/${problemId}/attempts`);
    const data = await handleResponse<{ attempts: AttemptHistoryItem[] }>(res);
    return data.attempts;
  },

  // Rubric
  getDefaultRubric: async (): Promise<Rubric> => {
    const res = await fetch(`${API_BASE}/rubric`);
    const data = await handleResponse<{ rubric: Rubric }>(res);
    return data.rubric;
  },

  // Attempts
  createAttempt: async (problemId: string): Promise<Attempt> => {
    const res = await fetch(`${API_BASE}/attempts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problemId }),
    });
    const data = await handleResponse<{ attempt: Attempt }>(res);
    return data.attempt;
  },

  getAttempt: async (attemptId: string): Promise<Attempt> => {
    const res = await fetch(`${API_BASE}/attempts/${attemptId}`);
    const data = await handleResponse<{ attempt: Attempt }>(res);
    return data.attempt;
  },

  // Submissions
  createSubmission: async (attemptId: string, content: string): Promise<Submission> => {
    const res = await fetch(`${API_BASE}/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attemptId, content, type: 'TEXT' }),
    });
    const data = await handleResponse<{ submission: Submission }>(res);
    return data.submission;
  },

  getSubmission: async (submissionId: string): Promise<Submission> => {
    const res = await fetch(`${API_BASE}/submissions/${submissionId}`);
    const data = await handleResponse<{ submission: Submission }>(res);
    return data.submission;
  },

  // Evaluation
  triggerEvaluation: async (submissionId: string): Promise<Evaluation> => {
    const res = await fetch(`${API_BASE}/submissions/${submissionId}/evaluate`, {
      method: 'POST',
    });
    const data = await handleResponse<{ evaluation: Evaluation }>(res);
    return data.evaluation;
  },

  getEvaluation: async (submissionId: string): Promise<Evaluation> => {
    const res = await fetch(`${API_BASE}/evaluations/${submissionId}`);
    const data = await handleResponse<{ evaluation: Evaluation }>(res);
    return data.evaluation;
  },
};
