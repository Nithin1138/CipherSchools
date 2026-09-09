/**
 * LLM Provider Abstraction.
 * Keeps domain and evaluation services independent of specific vendor SDKs or endpoints.
 */

export interface PromptPayload {
  system: string;
  user: string;
}

export interface ProviderOptions {
  timeoutMs?: number;
  temperature?: number;
}

export interface LLMProvider {
  /**
   * Unique name of the LLM provider (e.g., 'gemini', 'openai', 'mock')
   */
  readonly name: string;

  /**
   * Model identifier currently in use
   */
  readonly modelName: string;

  /**
   * Generates a raw structured string (typically JSON) from the LLM.
   * Throws an Error on network failure, timeout, or non-2xx status.
   */
  generateStructuredResponse(prompt: PromptPayload, options?: ProviderOptions): Promise<string>;
}
