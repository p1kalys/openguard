/**
 * Mock providers for testing
 */

import type { AIProvider, GenerateRequest, GenerateResponse, ProviderCapabilities } from '../providers/base.js';

/**
 * Mock provider for testing
 */
export class MockProvider implements AIProvider {
  public readonly capabilities: ProviderCapabilities = {
    streaming: true,
    jsonMode: true,
    tools: true,
    vision: true,
    maxTokens: 1000,
    inputFormats: ['text'],
  };

  constructor(
    private mockResponse: string,
    private shouldFail: boolean = false,
    private failMessage: string = 'Mock provider error'
  ) {}

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    if (this.shouldFail) {
      throw new Error(this.failMessage);
    }

    return {
      id: 'mock-' + Date.now(),
      content: this.mockResponse,
      model: 'mock-model',
      finishReason: 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: this.mockResponse.length,
        totalTokens: 10 + this.mockResponse.length,
      },
    };
  }

  async *streamGenerate(request: GenerateRequest): AsyncIterable<GenerateResponse> {
    if (this.shouldFail) {
      throw new Error(this.failMessage);
    }

    yield {
      id: 'mock-stream-' + Date.now(),
      content: this.mockResponse,
      model: 'mock-model',
      finishReason: 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: this.mockResponse.length,
        totalTokens: 10 + this.mockResponse.length,
      },
    };
  }
}

/**
 * Create mock provider
 */
export function createMockProvider(
  response: string,
  options: {
    shouldFail?: boolean;
    failMessage?: string;
  } = {}
): MockProvider {
  return new MockProvider(response, options.shouldFail, options.failMessage);
}
