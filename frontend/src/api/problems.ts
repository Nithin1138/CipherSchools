import { request } from './client.js';
import type { Problem, Rubric, AttemptHistoryItem } from '../types/index.js';

export async function listProblems(): Promise<Problem[]> {
  const data = await request<{ problems: Problem[] }>('/problems');
  return data.problems;
}

export async function getProblem(id: string): Promise<Problem> {
  const data = await request<{ problem: Problem }>(`/problems/${id}`);
  return data.problem;
}

export async function getProblemBySlug(slug: string): Promise<Problem> {
  const data = await request<{ problem: Problem }>(`/problems/slug/${slug}`);
  return data.problem;
}

export async function getProblemAttempts(problemId: string): Promise<AttemptHistoryItem[]> {
  const data = await request<{ attempts: AttemptHistoryItem[] }>(`/problems/${problemId}/attempts`);
  return data.attempts;
}

export async function getDefaultRubric(): Promise<Rubric> {
  const data = await request<{ rubric: Rubric }>('/rubric');
  return data.rubric;
}

export async function getHealth(): Promise<{ status: string }> {
  return request<{ status: string }>('/health');
}
