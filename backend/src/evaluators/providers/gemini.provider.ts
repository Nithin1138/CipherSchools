import { LLMProvider, PromptPayload, ProviderOptions } from './provider.interface.js';

const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';
const DEPRECATED_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-2.0-pro-exp-02-05',
]);

const FALLBACK_MODEL_SEQUENCE = [
  'gemini-3.6-flash',
  'gemini-2.5-flash',
  'gemini-3.6-pro',
  'gemini-2.5-pro',
  'gemini-1.5-flash-8b',
];

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  readonly modelName: string;
  private apiKey: string;

  constructor(apiKey?: string, modelName?: string) {
    this.apiKey = (apiKey !== undefined ? apiKey : process.env.GEMINI_API_KEY) || '';
    const candidate = (modelName !== undefined ? modelName : process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim();
    this.modelName = DEPRECATED_MODELS.has(candidate) ? DEFAULT_GEMINI_MODEL : candidate;

    if (!this.apiKey || this.apiKey === 'your_gemini_api_key_here') {
      throw new Error('Gemini API key is not configured. Please set GEMINI_API_KEY in backend/.env.');
    }
  }

  /**
   * Returns the prioritized sequence of models to try.
   * Starts with the user's configured model, followed by all remaining active models in order.
   */
  getModelSequence(): string[] {
    const sequence: string[] = [this.modelName];
    for (const model of FALLBACK_MODEL_SEQUENCE) {
      if (!sequence.includes(model)) {
        sequence.push(model);
      }
    }
    return sequence;
  }

  async generateStructuredResponse(prompt: PromptPayload, options?: ProviderOptions): Promise<string> {
    const modelsToTry = this.getModelSequence();
    const failureLog: Array<{ model: string; error: string }> = [];

    for (let i = 0; i < modelsToTry.length; i++) {
      const currentModel = modelsToTry[i];
      try {
        if (i > 0) {
          console.warn(
            `[GeminiProvider] Primary model failed. Cascading to fallback model: ${currentModel} (${i + 1}/${modelsToTry.length})...`
          );
        }
        const result = await this.executeModelRequest(currentModel, prompt, options);
        if (i > 0) {
          console.log(`[GeminiProvider] Fallback model ${currentModel} succeeded!`);
        }
        return result;
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        failureLog.push({ model: currentModel, error: errMsg });
        console.warn(`[GeminiProvider] Model ${currentModel} failed: ${errMsg}`);

        // If this is the last model in the sequence, exit loop
        if (i === modelsToTry.length - 1) {
          break;
        }

        // Only cascade if error is transient, capacity-related, or model-availability-related
        const canCascade =
          /404|429|500|502|503|504|overloaded|high demand|resource has been exhausted|rate limit|not found|no longer available|timeout/i.test(
            errMsg
          );

        if (!canCascade) {
          throw err;
        }
      }
    }

    const summary = failureLog.map((f) => `${f.model} (${f.error})`).join('; ');
    throw new Error(
      `All Gemini models in sequence encountered errors [${summary}]. Your submission is safely saved in PostgreSQL. Please click 'Retry Evaluation' in a few moments.`
    );
  }

  private async executeModelRequest(model: string, prompt: PromptPayload, options?: ProviderOptions): Promise<string> {
    const timeoutMs = options?.timeoutMs ?? 35000;
    const temperature = options?.temperature ?? 0.2;
    const maxRetries = 3;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new Error(`Gemini request timed out after ${timeoutMs}ms`)), timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: prompt.system }],
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt.user }],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature,
            },
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          let errSnippet = '';
          try {
            const errJson = (await response.json()) as any;
            errSnippet = errJson?.error?.message || response.statusText;
          } catch {
            errSnippet = response.statusText;
          }

          const isTransient =
            response.status === 429 ||
            response.status === 503 ||
            response.status === 500 ||
            response.status === 502 ||
            response.status === 504 ||
            /overloaded|high demand|resource has been exhausted|rate limit/i.test(errSnippet);

          if (isTransient && attempt < maxRetries) {
            const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 600, 5000);
            console.warn(
              `[GeminiProvider] High demand / transient error on ${model} (${response.status}: ${errSnippet}). Retrying in ${Math.round(backoffMs)}ms (attempt ${attempt}/${maxRetries})...`
            );
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }

          if (response.status === 429 || response.status === 503) {
            throw new Error(`Gemini API high demand on ${model} (${response.status}: ${errSnippet})`);
          }
          throw new Error(`Gemini API returned error ${response.status}: ${errSnippet}`);
        }

        const data = (await response.json()) as any;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text || typeof text !== 'string') {
          throw new Error('Gemini returned an empty or unparseable response.');
        }

        return text.trim();
      } catch (err: unknown) {
        if ((err as Error).name === 'AbortError' || controller.signal.aborted) {
          lastError = new Error(`Gemini API request for ${model} timed out after ${timeoutMs}ms`);
        } else {
          lastError = err as Error;
        }

        if (attempt < maxRetries && (lastError.message.includes('fetch failed') || lastError.message.includes('timed out'))) {
          const backoffMs = 1200 * attempt;
          console.warn(`[GeminiProvider] Network/timeout on ${model}. Retrying in ${backoffMs}ms (attempt ${attempt}/${maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        throw lastError;
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError || new Error(`Gemini evaluation request for ${model} failed after retries.`);
  }
}
