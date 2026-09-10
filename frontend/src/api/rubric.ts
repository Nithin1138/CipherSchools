import { request } from './client.js';
import type { Rubric } from '../types/index.js';

export async function getDefaultRubric(): Promise<Rubric> {
  const data = await request<{ rubric: Rubric }>('/rubric');
  return data.rubric;
}
