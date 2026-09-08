/**
 * Domain types and value objects for LLD Practice Platform.
 */

export const AttemptStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;
export type AttemptStatus = (typeof AttemptStatus)[keyof typeof AttemptStatus];

export const SubmissionType = {
  TEXT: 'TEXT',
  DIAGRAM: 'DIAGRAM', // Change Test A hook
  CODE: 'CODE',       // Change Test A hook
} as const;
export type SubmissionType = (typeof SubmissionType)[keyof typeof SubmissionType];

export const EvaluationStatus = {
  PENDING: 'PENDING',
  EVALUATING: 'EVALUATING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
export type EvaluationStatus = (typeof EvaluationStatus)[keyof typeof EvaluationStatus];

export const EvaluatorType = {
  LLM: 'LLM',
  RULE_BASED: 'RULE_BASED', // Change Test B hook
  HUMAN: 'HUMAN',           // Change Test B hook
} as const;
export type EvaluatorType = (typeof EvaluatorType)[keyof typeof EvaluatorType];

/**
 * Criterion definition passed to an evaluator
 */
export interface CriterionSpec {
  id: string;
  name: string;
  description: string;
  maxScore: number;
  orderIndex: number;
}

/**
 * Input required by an evaluator to assess a submission
 */
export interface EvaluationInput {
  problem: {
    title: string;
    description: string;
    problemStatement: string;
    requirements: string[];
    constraints: string[];
  };
  submission: {
    id: string;
    type: string;
    content: string;
  };
  criteria: CriterionSpec[];
}

/**
 * Single criterion feedback returned by an evaluator
 */
export interface CriterionEvaluationResult {
  criterionName: string;
  criterionId?: string;
  score: number;
  maxScore: number;
  evidence: string;
  concern?: string;
  suggestion?: string;
  confidence?: number;
}

/**
 * Complete outcome returned by an Evaluator implementation
 */
export interface EvaluationResult {
  evaluatorType: EvaluatorType;
  evaluatorModel?: string;
  criterionResults: CriterionEvaluationResult[];
}
