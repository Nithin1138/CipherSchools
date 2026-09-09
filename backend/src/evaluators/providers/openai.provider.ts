import { LLMProvider, PromptPayload, ProviderOptions } from './provider.interface.js';

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  readonly modelName: string;
  private apiKey: string;

  constructor(apiKey?: string, modelName?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.modelName = modelName || process.env.OPENAI_MODEL || 'gpt-4o-mini';

    if (!this.apiKey || this.apiKey === 'your_openai_api_key_here') {
      throw new Error('OpenAI API key is not configured. Please set OPENAI_API_KEY in backend/.env.');
    }
  }

  async generateStructuredResponse(prompt: PromptPayload, options?: ProviderOptions): Promise<string> {
    const timeoutMs = options?.timeoutMs ?? 30000;
    const temperature = options?.temperature ?? 0.2;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`OpenAI request timed out after ${timeoutMs}ms`)), timeoutMs);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
          response_format: { type: 'json_object' },
          temperature,
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
          throw new Error(`OpenAI API rate limit reached (429): ${errSnippet}`);
        }
        throw new Error(`OpenAI API returned error ${response.status}: ${errSnippet}`);
      }

      const data = (await response.json()) as any;
      const text = data.choices?.[0]?.message?.content;

      if (!text || typeof text !== 'string') {
        throw new Error('OpenAI returned an empty or unparseable response.');
      }

      return text.trim();
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError' || controller.signal.aborted) {
        throw new Error(`OpenAI API request timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
