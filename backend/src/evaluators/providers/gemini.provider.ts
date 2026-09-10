import { LLMProvider, PromptPayload, ProviderOptions } from './provider.interface.js';

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  readonly modelName: string;
  private apiKey: string;

  constructor(apiKey?: string, modelName?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    this.modelName = modelName || process.env.GEMINI_MODEL || 'gemini-2.0-flash';

    if (!this.apiKey || this.apiKey === 'your_gemini_api_key_here') {
      throw new Error('Gemini API key is not configured. Please set GEMINI_API_KEY in backend/.env.');
    }
  }

  async generateStructuredResponse(prompt: PromptPayload, options?: ProviderOptions): Promise<string> {
    const timeoutMs = options?.timeoutMs ?? 30000;
    const temperature = options?.temperature ?? 0.2;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

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
          const errJson = await response.json() as any;
          errSnippet = errJson?.error?.message || response.statusText;
        } catch {
          errSnippet = response.statusText;
        }

        if (response.status === 429) {
          throw new Error(`Gemini API rate limit reached (429): ${errSnippet}`);
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
        throw new Error(`Gemini API request timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
