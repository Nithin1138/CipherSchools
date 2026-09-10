import { LLMProvider, PromptPayload, ProviderOptions } from './provider.interface.js';

const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';
const DEPRECATED_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-2.0-pro-exp-02-05',
]);

const FALLBACK_CANDIDATES: Record<string, string> = {
  'gemini-3.6-flash': 'gemini-3.6-pro',
  'gemini-3.6-pro': 'gemini-3.6-flash',
};

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

  async generateStructuredResponse(prompt: PromptPayload, options?: ProviderOptions): Promise<string> {
    try {
      return await this.executeModelRequest(this.modelName, prompt, options);
    } catch (primaryErr: any) {
      const fallbackModel = FALLBACK_CANDIDATES[this.modelName];
      const isTransient = /high demand|overloaded|429|503|resource has been exhausted|rate limit/i.test(primaryErr.message || '');

      if (fallbackModel && isTransient) {
        console.warn(
          `[GeminiProvider] Primary model ${this.modelName} unavailable (${primaryErr.message}). Cascading to fallback model ${fallbackModel}...`
        );
        try {
          return await this.executeModelRequest(fallbackModel, prompt, options);
        } catch (fallbackErr: any) {
          console.error(`[GeminiProvider] Fallback model ${fallbackModel} also failed: ${fallbackErr.message}`);
          throw new Error(
            `Gemini servers are experiencing high demand across models (${this.modelName} & ${fallbackModel}). Your design submission is saved safely. Please click 'Retry Evaluation' in a few moments.`
          );
        }
      }

      throw primaryErr;
    }
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
