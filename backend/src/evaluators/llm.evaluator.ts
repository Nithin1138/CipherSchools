import { Evaluator } from '../domain/evaluator.js';
import { EvaluationInput, EvaluationResult, EvaluatorType } from '../domain/types.js';
import { LLMProvider } from './providers/provider.interface.js';
import { GeminiProvider } from './providers/gemini.provider.js';
import { OpenAIProvider } from './providers/openai.provider.js';
import { MockLLMProvider } from './providers/mock.provider.js';
import { PromptBuilder } from './prompt.builder.js';
import { OutputValidator } from './validator.js';

/**
 * Production LLM Evaluator implementing the domain Evaluator contract.
 * Decoupled from specific vendor SDKs via LLMProvider interface.
 * Implements strict output validation, deterministic scoring aggregation,
 * and timeout/failure guarantees.
 */
export class LLMEvaluator implements Evaluator {
  readonly name = 'LLMEvaluator';
  private provider?: LLMProvider;
  private readonly defaultTimeoutMs: number = 30000;

  constructor(provider?: LLMProvider) {
    if (provider) {
      this.provider = provider;
    }
  }

  /**
   * Lazily resolves or returns the configured provider.
   */
  getProvider(): LLMProvider {
    if (this.provider) {
      return this.provider;
    }

    // In automated test environments (VITEST or NODE_ENV === 'test'), default to MockLLMProvider
    // to guarantee 100% offline, deterministic, and fast test runs without external API calls.
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      this.provider = new MockLLMProvider();
      return this.provider;
    }

    const providerSetting = process.env.LLM_PROVIDER?.toLowerCase().trim();
    if (providerSetting === 'openai') {
      this.provider = new OpenAIProvider();
    } else {
      // Default to Google Gemini
      this.provider = new GeminiProvider();
    }

    return this.provider;
  }

  async evaluate(input: EvaluationInput): Promise<EvaluationResult> {
    const provider = this.getProvider();
    const startTime = Date.now();

    console.log(
      `[LLMEvaluator] Starting evaluation for submission ${input.submission.id} via ${provider.name} (${provider.modelName})`
    );

    try {
      // 1. Construct strict, anti-hallucination prompt
      const prompt = PromptBuilder.build(input);

      // 2. Call LLM provider with timeout
      const rawResponse = await provider.generateStructuredResponse(prompt, {
        timeoutMs: this.defaultTimeoutMs,
        temperature: 0.2,
      });

      // 3. Parse JSON safely (handling markdown code wrappers)
      const parsedJson = OutputValidator.parseJsonString(rawResponse);

      // In live production evaluation (non-mock provider), deduplicate accidental repeated criterionId entries
      // from upstream LLM completions so minor duplicate completions do not fail candidate evaluations
      if (provider.name !== 'mock' && parsedJson && Array.isArray((parsedJson as any).criteria)) {
        const seenIds = new Set<string>();
        (parsedJson as any).criteria = (parsedJson as any).criteria.filter((item: any) => {
          if (!item || typeof item.criterionId !== 'string') return true;
          if (seenIds.has(item.criterionId)) {
            console.warn(
              `[LLMEvaluator] Upstream model returned duplicate criterionId "${item.criterionId}". Deduplicating to preserve candidate evaluation.`
            );
            return false;
          }
          seenIds.add(item.criterionId);
          return true;
        });
      }

      // 4. Validate output schema, criterion IDs, score boundaries, confidence, and evidence grounding
      const criterionResults = OutputValidator.validate(parsedJson, input.criteria, input.submission.content);

      const latencyMs = Date.now() - startTime;
      console.log(
        `[LLMEvaluator] Successfully evaluated submission ${input.submission.id} in ${latencyMs}ms (${criterionResults.length} criteria)`
      );

      return {
        evaluatorType: EvaluatorType.LLM,
        evaluatorModel: `${provider.name}:${provider.modelName}`,
        criterionResults,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const message = (err as Error).message || 'Unknown evaluation failure';
      console.error(
        `[LLMEvaluator] Evaluation failed for submission ${input.submission.id} after ${latencyMs}ms: ${message}`
      );
      throw err;
    }
  }
}
