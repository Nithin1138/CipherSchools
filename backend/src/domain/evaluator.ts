import { EvaluationInput, EvaluationResult } from './types.js';

/**
 * Core Evaluator Abstraction (Change Test B).
 * Allows substituting or augmenting the evaluation engine (LLM, rule-based, or human)
 * without touching the practice flow or domain service layer.
 */
export interface Evaluator {
  /**
   * Unique identifier/name of this evaluator engine
   */
  readonly name: string;

  /**
   * Assesses an LLD submission against problem requirements and rubric criteria.
   */
  evaluate(input: EvaluationInput): Promise<EvaluationResult>;
}
