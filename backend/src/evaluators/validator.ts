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
   * Validates that an evidence string is strictly grounded in the submission.
   * Evidence must either:
   * 1. Explicitly state that the submission does not specify / mention the relevant information.
   * 2. Directly quote or reference a meaningful subsequence/identifier from the submission.
   * Generic placeholders ("Looks good", "Evaluated submission") or fabricated claims are rejected.
   */
  static isEvidenceGrounded(evidence: string, submissionContent: string): { valid: boolean; reason?: string } {
    if (!evidence || typeof evidence !== 'string' || evidence.trim().length === 0) {
      return { valid: false, reason: 'Evidence cannot be empty' };
    }

    const trimmed = evidence.trim();
    const lower = trimmed.toLowerCase();

    // 1. Reject generic placeholders
    const genericPlaceholders = [
      'evaluated submission',
      'evaluated submission.',
      'looks good',
      'looks good.',
      'good class design',
      'good class design.',
      'meets requirements',
      'meets requirements.',
      'demonstrated good practices',
      'demonstrated good practices.',
      'standard implementation',
      'standard implementation.',
      'submission meets criteria',
      'n/a',
      'none',
      'no evidence',
    ];
    if (genericPlaceholders.includes(lower)) {
      return { valid: false, reason: 'Generic placeholder evidence is not permitted' };
    }

    // 2. Check if explicitly specifies missing / unspecified information
    const unspecifiedPatterns = [
      /\bnot specified\b/i,
      /\bunspecified\b/i,
      /\bdoes not specify\b/i,
      /\bdid not specify\b/i,
      /\bdoes not mention\b/i,
      /\bdid not mention\b/i,
      /\bno mention\b/i,
      /\bnot mentioned\b/i,
      /\bmissing\b/i,
      /\bnot addressed\b/i,
      /\bnot provided\b/i,
      /\bnot included\b/i,
      /\bomitted\b/i,
      /\bno explicit\b/i,
      /\bnone specified\b/i,
      /\bnot discussed\b/i,
      /\babsent\b/i,
      /\bnot implemented\b/i,
      /\bno implementation\b/i,
    ];
    for (const pattern of unspecifiedPatterns) {
      if (pattern.test(trimmed)) {
        if (trimmed.length < 15) {
          return { valid: false, reason: 'Omission evidence must be descriptive and explain what is missing (at least 15 characters)' };
        }
        return { valid: true };
      }
    }

    // If submission content is empty, cannot verify grounding
    if (!submissionContent || submissionContent.trim().length === 0) {
      return { valid: true };
    }

    const lowerSubmission = submissionContent.toLowerCase();

    // 3. Check for quoted substrings in evidence: "...", '...', or `...`
    const quoteRegex = /["'`“‘]([^"'`”’]{3,})["'`”’]/g;
    let quoteMatch: RegExpExecArray | null;
    let foundQuotes = false;
    let anyQuoteMatched = false;

    while ((quoteMatch = quoteRegex.exec(trimmed)) !== null) {
      foundQuotes = true;
      const quotedSnippet = quoteMatch[1].trim().toLowerCase();
      if (lowerSubmission.includes(quotedSnippet)) {
        anyQuoteMatched = true;
        break;
      }
    }

    if (foundQuotes) {
      if (anyQuoteMatched) {
        return { valid: true };
      }
      return { valid: false, reason: 'Quoted evidence was not found in the candidate submission' };
    }

    // 4. Check for 2-word contiguous phrase matches from submission
    const words = trimmed.split(/\s+/);
    for (let i = 0; i < words.length - 1; i++) {
      const clean1 = words[i].replace(/[^a-zA-Z0-9_]/g, '');
      const clean2 = words[i + 1].replace(/[^a-zA-Z0-9_]/g, '');
      if (clean1.length >= 3 && clean2.length >= 3) {
        const bigram = `${clean1} ${clean2}`.toLowerCase();
        if (lowerSubmission.includes(bigram)) {
          return { valid: true };
        }
      }
    }

    // 5. Check for matching code identifiers / key domain concepts from the submission
    const evidenceTokens = (trimmed.match(/[A-Za-z0-9_]{3,}/g) || []).map((t) => t.toLowerCase());
    const submissionTokenSet = new Set((submissionContent.match(/[A-Za-z0-9_]{3,}/g) || []).map((t) => t.toLowerCase()));

    const stopWords = new Set([
      'this', 'that', 'with', 'from', 'have', 'been', 'were', 'what', 'when', 'where',
      'which', 'there', 'their', 'about', 'would', 'could', 'should', 'these', 'those',
      'then', 'than', 'some', 'such', 'into', 'more', 'other', 'also', 'only', 'very',
      'just', 'does', 'done', 'will', 'each', 'make', 'made', 'both'
    ]);

    const meaningfulMatches = evidenceTokens.filter(
      (t) => submissionTokenSet.has(t) && !stopWords.has(t) && t.length >= 4
    );

    if (meaningfulMatches.length >= 1) {
      return { valid: true };
    }

    return { valid: false, reason: 'Evidence is not grounded in the submitted solution content' };
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
   * - Grounded evidence in submission content
   */
  static validate(
    rawJson: unknown,
    expectedCriteria: CriterionSpec[],
    submissionContent?: string
  ): CriterionEvaluationResult[] {
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
    const intermediateResults: { item: (typeof rawItems)[0]; spec: CriterionSpec }[] = [];

    // Step 1: Check duplicate IDs and unknown IDs
    for (const item of rawItems) {
      const { criterionId, score, confidence } = item;

      if (seenIds.has(criterionId)) {
        throw new OutputValidationError(`Duplicate criterionId found in LLM response: "${criterionId}".`);
      }
      seenIds.add(criterionId);

      const spec = expectedMap.get(criterionId);
      if (!spec) {
        throw new OutputValidationError(
          `Unknown criterionId "${criterionId}" returned by LLM. It does not exist in the active rubric.`
        );
      }

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

      const validConfidence = confidence !== undefined ? confidence : 1.0;
      if (validConfidence < 0 || validConfidence > 1) {
        throw new OutputValidationError(
          `Confidence (${validConfidence}) for criterion "${spec.name}" must be between 0.0 and 1.0.`
        );
      }

      intermediateResults.push({ item, spec });
    }

    // Step 2: Check for missing criteria
    for (const spec of expectedCriteria) {
      if (!seenIds.has(spec.id)) {
        throw new OutputValidationError(
          `Missing rubric criterion in LLM response: "${spec.name}" (ID: ${spec.id}). All ${expectedCriteria.length} criteria must be evaluated.`
        );
      }
    }

    // Step 3: Validate evidence grounding on all criteria
    const validatedResults: CriterionEvaluationResult[] = [];
    for (const { item, spec } of intermediateResults) {
      const { evidence, score, concern, suggestion, confidence } = item;

      if (submissionContent && submissionContent.trim().length > 0) {
        const grounding = OutputValidator.isEvidenceGrounded(evidence, submissionContent);
        if (!grounding.valid) {
          throw new OutputValidationError(
            `Evidence grounding validation failed for criterion "${spec.name}": ${grounding.reason}. Evidence provided: "${evidence}"`
          );
        }
      }

      validatedResults.push({
        criterionId: spec.id,
        criterionName: spec.name,
        score: Math.round(score),
        maxScore: spec.maxScore,
        evidence: evidence.trim(),
        concern: concern && concern.trim().length > 0 ? concern.trim() : undefined,
        suggestion: suggestion && suggestion.trim().length > 0 ? suggestion.trim() : undefined,
        confidence: confidence !== undefined ? confidence : 1.0,
      });
    }

    return validatedResults;
  }
}
