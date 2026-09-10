import { request } from './client.js';
import type { Problem, Rubric, AttemptHistoryItem } from '../types/index.js';

let cachedProblems: Problem[] | null = null;
let cachedRubric: Rubric | null = null;
const problemCache = new Map<string, Problem>();

const isTest = typeof process !== 'undefined' && ((process.env as any)?.NODE_ENV === 'test' || (process.env as any)?.VITEST);

export async function listProblems(): Promise<Problem[]> {
  if (!isTest && cachedProblems && cachedProblems.length > 0) {
    return cachedProblems;
  }
  const data = await request<{ problems: Problem[] }>('/problems');
  cachedProblems = data.problems;
  for (const p of data.problems) {
    problemCache.set(p.id, p);
    if (p.slug) problemCache.set(p.slug, p);
  }
  return data.problems;
}

export async function getProblem(id: string): Promise<Problem> {
  if (!isTest && problemCache.has(id)) {
    return problemCache.get(id)!;
  }
  const data = await request<{ problem: Problem }>(`/problems/${id}`);
  problemCache.set(id, data.problem);
  return data.problem;
}

export async function getProblemBySlug(slug: string): Promise<Problem> {
  if (!isTest && problemCache.has(slug)) {
    return problemCache.get(slug)!;
  }
  const data = await request<{ problem: Problem }>(`/problems/slug/${slug}`);
  problemCache.set(slug, data.problem);
  return data.problem;
}

export async function getProblemAttempts(problemId: string): Promise<AttemptHistoryItem[]> {
  const data = await request<{ attempts: AttemptHistoryItem[] }>(`/problems/${problemId}/attempts`);
  return data.attempts;
}

export async function getDefaultRubric(): Promise<Rubric> {
  if (!isTest && cachedRubric) {
    return cachedRubric;
  }
  const data = await request<{ rubric: Rubric }>('/rubric');
  cachedRubric = data.rubric;
  return data.rubric;
}

export async function getHealth(): Promise<{ status: string }> {
  return request<{ status: string }>('/health');
}
