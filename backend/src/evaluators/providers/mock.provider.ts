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
      // Extract candidate submission snippet from prompt if present
      const submissionMatch = prompt.user.match(/Candidate Submission Content:\s*\n([\s\S]*?)(?=\n\s*Evaluation Rubric Criteria:|$)/i);
      const rawSnippet = submissionMatch ? submissionMatch[1].trim() : '';
      const lines = rawSnippet.split('\n').map((l) => l.trim()).filter((l) => l.length >= 6);
      const firstSnippet = lines.length > 0 ? `"${lines[0].slice(0, 35)}"` : '';

      const criteria = idMatches.map((m, idx) => {
        const maxScore = parseInt(m[3], 10);
        const isAlternate = idx % 2 === 1;
        const evidence = firstSnippet && !isAlternate
          ? `Observed in candidate submission: ${firstSnippet} addressing ${m[2]}.`
          : `The submission does not specify complete edge case handling or concurrency strategy for ${m[2]}.`;

        return {
          criterionId: m[1],
          criterionName: m[2],
          score: Math.floor(maxScore * 0.8),
          evidence,
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
