import { LLMProvider, PromptPayload, ProviderOptions } from './provider.interface.js';

export type MockHandler = (prompt: PromptPayload, options?: ProviderOptions) => Promise<string> | string;

export class MockLLMProvider implements LLMProvider {
  readonly name = 'mock';
  readonly modelName: string;
  private handler?: MockHandler;
  private cannedResponse?: string;
  private shouldTimeout: boolean = false;
  private shouldFail: boolean = false;
  private failureMessage: string = 'Mock provider simulated failure';

  constructor(modelName: string = 'mock-llm-v1') {
    this.modelName = modelName;
  }

  setResponse(jsonString: string): this {
    this.cannedResponse = jsonString;
    this.handler = undefined;
    this.shouldTimeout = false;
    this.shouldFail = false;
    return this;
  }

  setHandler(handler: MockHandler): this {
    this.handler = handler;
    this.cannedResponse = undefined;
    this.shouldTimeout = false;
    this.shouldFail = false;
    return this;
  }

  simulateTimeout(): this {
    this.shouldTimeout = true;
    return this;
  }

  simulateFailure(message: string = 'Upstream provider connection error'): this {
    this.shouldFail = true;
    this.failureMessage = message;
    return this;
  }

  async generateStructuredResponse(prompt: PromptPayload, options?: ProviderOptions): Promise<string> {
    if (this.shouldTimeout) {
      throw new Error(`Mock provider simulated timeout after ${options?.timeoutMs ?? 30000}ms`);
    }

    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    if (this.handler) {
      return this.handler(prompt, options);
    }

    if (this.cannedResponse) {
      return this.cannedResponse;
    }

    // Dynamic mock response extracting criteria from prompt user text
    const idMatches = [...prompt.user.matchAll(/criterionId:\s*"([^"]+)"\s*\n\s*- criterionName:\s*"([^"]+)"\s*\n\s*- maxScore:\s*(\d+)/g)];
    if (idMatches.length > 0) {
      const criteria = idMatches.map((m) => {
        const maxScore = parseInt(m[3], 10);
        return {
          criterionId: m[1],
          criterionName: m[2],
          score: Math.floor(maxScore * 0.8),
          evidence: `Demonstrated architectural patterns and cohesive class structure for ${m[2]}.`,
          concern: `Edge case handling for ${m[2]} could be expanded.`,
          suggestion: `Consider refining interface abstractions for ${m[2]}.`,
          confidence: 0.95,
        };
      });
      return JSON.stringify({ criteria });
    }

    throw new Error('MockLLMProvider has no response configured and could not find criteria in prompt.');
  }
}
