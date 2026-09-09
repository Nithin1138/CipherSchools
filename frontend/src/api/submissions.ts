import { request } from './client.js';
import type { Submission } from '../types/index.js';

export async function createSubmission(
  attemptId: string,
  content: string,
  type: string = 'TEXT'
): Promise<Submission> {
  const data = await request<{ submission: Submission }>(`/attempts/${attemptId}/submission`, {
    method: 'POST',
    body: JSON.stringify({ content, type }),
  });
  return data.submission;
}

export async function getSubmission(submissionId: string): Promise<Submission> {
  const data = await request<{ submission: Submission }>(`/submissions/${submissionId}`);
  return data.submission;
}
