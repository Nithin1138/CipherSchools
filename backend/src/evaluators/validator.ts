import { z } from 'zod';
import { CriterionSpec, CriterionEvaluationResult } from '../domain/types.js';

export class OutputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutputValidationError';
  }
}

// Zod schema for individual criterion output from LLM
const RawCriterionSchema = z.object({
  criterionId: z.string().min(1, 'criterionId is required'),
  criterionName: z.string().optional(),
  score: z.number({ required_error: 'score is required and must be a number' }),
  evidence: z.string().min(1, 'evidence is required and cannot be empty'),
  concern: z.string().nullable().optional(),
  suggestion: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1, 'confidence must be between 0.0 and 1.0').optional(),
});

const RawEvaluationOutputSchema = z.object({
  criteria: z.array(RawCriterionSchema).min(1, 'Output criteria array cannot be empty'),
});

export class OutputValidator {
  /**
   * Sanitizes markdown wrappers from LLM string output and parses JSON.
   */
  static parseJsonString(rawText: string): unknown {
    if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
      throw new OutputValidationError('LLM returned an empty response.');
    }

    // Strip ```json ... ``` or ``` ... ``` markdown fences if present
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
      cleaned = cleaned.replace(/\s*```$/i, '');
      cleaned = cleaned.trim();
    }

    try {
      return JSON.parse(cleaned);
    } catch (err: unknown) {
      throw new OutputValidationError(`Failed to parse LLM response as JSON: ${(err as Error).message}. Raw output preview: "${rawText.slice(0, 150)}..."`);
    }
  }

  /**
   * Strictly validates LLM output against the expected rubric criteria.
   * Enforces:
   * - Schema conformity
   * - Criterion IDs match
   * - No duplicates
   * - No missing criteria
   * - No unknown criterion IDs
   * - Scores within [0, maxScore]
   * - Confidence within [0, 1]
   */
  static validate(rawJson: unknown, expectedCriteria: CriterionSpec[]): CriterionEvaluationResult[] {
    const parseResult = RawEvaluationOutputSchema.safeParse(rawJson);
    if (!parseResult.success) {
      const errorDetails = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new OutputValidationError(`LLM response schema validation failed: ${errorDetails}`);
    }

    const { criteria: rawItems } = parseResult.data;
    const expectedMap = new Map<string, CriterionSpec>();
    for (const spec of expectedCriteria) {
      expectedMap.set(spec.id, spec);
    }

    const seenIds = new Set<string>();
    const validatedResults: CriterionEvaluationResult[] = [];

    for (const item of rawItems) {
      const { criterionId, score, evidence, concern, suggestion, confidence } = item;

      // Check for duplicate criteria in response
      if (seenIds.has(criterionId)) {
        throw new OutputValidationError(`Duplicate criterionId found in LLM response: "${criterionId}".`);
      }
      seenIds.add(criterionId);

      // Check for unknown criteria
      const spec = expectedMap.get(criterionId);
      if (!spec) {
        throw new OutputValidationError(
          `Unknown criterionId "${criterionId}" returned by LLM. It does not exist in the active rubric.`
        );
      }

      // Check score bounds
      if (score < 0) {
        throw new OutputValidationError(
          `Negative score (${score}) provided for criterion "${spec.name}". Scores must be >= 0.`
        );
      }

      if (score > spec.maxScore) {
        throw new OutputValidationError(
          `Score (${score}) for criterion "${spec.name}" exceeds maximum allowable score of ${spec.maxScore}.`
        );
      }

      // Check confidence bounds if provided
      const validConfidence = confidence !== undefined ? confidence : 1.0;
      if (validConfidence < 0 || validConfidence > 1) {
        throw new OutputValidationError(
          `Confidence (${validConfidence}) for criterion "${spec.name}" must be between 0.0 and 1.0.`
        );
      }

      validatedResults.push({
        criterionId: spec.id,
        criterionName: spec.name,
        score: Math.round(score),
        maxScore: spec.maxScore,
        evidence: evidence.trim(),
        concern: concern && concern.trim().length > 0 ? concern.trim() : undefined,
        suggestion: suggestion && suggestion.trim().length > 0 ? suggestion.trim() : undefined,
        confidence: validConfidence,
      });
    }

    // Check for missing criteria
    for (const spec of expectedCriteria) {
      if (!seenIds.has(spec.id)) {
        throw new OutputValidationError(
          `Missing rubric criterion in LLM response: "${spec.name}" (ID: ${spec.id}). All ${expectedCriteria.length} criteria must be evaluated.`
        );
      }
    }

    return validatedResults;
  }
}
