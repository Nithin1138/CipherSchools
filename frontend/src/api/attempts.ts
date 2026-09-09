import { request } from './client.js';
import type { Attempt } from '../types/index.js';

export async function createAttempt(problemId: string): Promise<Attempt> {
  const data = await request<{ attempt: Attempt }>(`/problems/${problemId}/attempts`, {
    method: 'POST',
  });
  return data.attempt;
}

export async function getAttempt(attemptId: string): Promise<Attempt> {
  const data = await request<{ attempt: Attempt }>(`/attempts/${attemptId}`);
  return data.attempt;
}
