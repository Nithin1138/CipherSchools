import { request } from './client.js';
import type { Evaluation } from '../types/index.js';

export async function triggerEvaluation(submissionId: string): Promise<Evaluation> {
  const data = await request<{ evaluation: Evaluation }>(`/submissions/${submissionId}/evaluation`, {
    method: 'POST',
  });
  return data.evaluation;
}

export async function getEvaluation(evaluationId: string): Promise<Evaluation> {
  const data = await request<{ evaluation: Evaluation }>(`/evaluations/${evaluationId}`);
  return data.evaluation;
}

export async function retryEvaluation(evaluationId: string): Promise<Evaluation> {
  const data = await request<{ evaluation: Evaluation }>(`/evaluations/${evaluationId}/retry`, {
    method: 'POST',
  });
  return data.evaluation;
}
