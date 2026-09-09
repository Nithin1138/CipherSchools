import { EvaluationInput } from '../domain/types.js';
import { PromptPayload } from './providers/provider.interface.js';

export class PromptBuilder {
  /**
   * Constructs the structured system instructions and user payload
   * for LLM-based Low-Level Design evaluation.
   */
  static build(input: EvaluationInput): PromptPayload {
    const system = PromptBuilder.buildSystemPrompt();
    const user = PromptBuilder.buildUserPrompt(input);
    return { system, user };
  }

  private static buildSystemPrompt(): string {
    return `You are an expert Principal Software Engineer and Low-Level Design (LLD) interviewer.
Your task is to impartially evaluate a candidate's Low-Level Design submission against an official evaluation rubric.

==================================================
EVALUATION RULES & GUIDELINES
==================================================

1. EVALUATE THE DESIGN, NOT THE CANDIDATE:
   - Base all evaluations strictly on the technical merits and deficiencies in the submitted text.
   - Maintain an objective, constructive, and engineering-grounded tone.

2. ANTI-HALLUCINATION RULE (STRICT EVIDENCE ONLY):
   - You MUST NOT reward the candidate for architectural choices or features that were not explicitly demonstrated.
   - If the candidate does not mention persistence, do NOT assume "probably uses a database". Instead state: "The submission does not specify persistence."
   - If concurrency handling is not discussed, do NOT assume thread safety exists. Instead state: "No thread synchronization or lock strategy is specified."
   - Clearly distinguish between missing information (unspecified) versus incorrect or flawed implementations.

3. INDEPENDENT RUBRIC SCORING:
   - Score every criterion independently between 0 and its specified maxScore.
   - Do NOT invent or alter criteria. Evaluate ONLY against the provided rubric criteria.
   - Avoid double-counting: penalize a weakness under the single criterion where it belongs, not across multiple unrelated criteria.

4. EVIDENCE-FIRST FEEDBACK:
   - For every criterion, provide:
     * evidence: A direct quotation or specific reference to the candidate's actual submission demonstrating where this criterion was or was not addressed.
     * concern: A concrete technical vulnerability, coupling issue, SRP violation, unhandled edge case, or missing requirement (or null if the design was exceptional).
     * suggestion: Actionable, specific engineering advice explaining how the candidate can refactor or extend their design (or null if no changes needed).

5. CONFIDENCE METRIC:
   - Provide a confidence value as a float between 0.0 and 1.0.
   - Confidence reflects how certainty and clarity of evidence allow you to assess this criterion. It is NOT a substitute for the score.

6. OUTPUT FORMAT:
   - You MUST respond ONLY with a valid JSON object matching the requested schema.
   - Do NOT include conversational filler, markdown explanations outside JSON, or extra root keys.`;
  }

  private static buildUserPrompt(input: EvaluationInput): string {
    const { problem, submission, criteria } = input;

    const requirementsSection = problem.requirements && problem.requirements.length > 0
      ? problem.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')
      : 'None specified.';

    const constraintsSection = problem.constraints && problem.constraints.length > 0
      ? problem.constraints.map((c, i) => `- ${c}`).join('\n')
      : 'Standard object-oriented and in-memory assumptions apply.';

    const rubricSection = criteria.map((c, idx) => {
      return `Criterion ${idx + 1}:
  - criterionId: "${c.id}"
  - criterionName: "${c.name}"
  - maxScore: ${c.maxScore}
  - description: "${c.description}"`;
    }).join('\n\n');

    return `==================================================
PROBLEM DEFINITION
==================================================
Title: ${problem.title}
Problem Statement:
${problem.problemStatement}

Requirements:
${requirementsSection}

Constraints:
${constraintsSection}

==================================================
EVALUATION RUBRIC (DATABASE SOURCE OF TRUTH)
==================================================
You must evaluate the candidate's submission against EXACTLY the following ${criteria.length} criteria:

${rubricSection}

==================================================
CANDIDATE SUBMISSION
==================================================
"""
${submission.content}
"""

==================================================
REQUIRED JSON OUTPUT FORMAT
==================================================
Return a single JSON object with a "criteria" array containing an entry for EVERY criterion listed above:

{
  "criteria": [
    {
      "criterionId": "exact criterionId string from above",
      "criterionName": "exact criterionName string from above",
      "score": <integer between 0 and maxScore>,
      "evidence": "<direct reference or quote from candidate submission>",
      "concern": "<specific architectural weakness or null>",
      "suggestion": "<concrete actionable improvement advice or null>",
      "confidence": <float between 0.0 and 1.0>
    }
  ]
}

REMEMBER:
- Every criterionId in the rubric must appear exactly once in the "criteria" list.
- score must be an integer between 0 and that criterion's maxScore.
- Return ONLY the JSON object.`;
  }
}
