/**
 * Anthropic provider adapter for OpenGuard using official SDK
 */

// Note: Install @anthropic-ai/sdk package to use this provider
// import Anthropic from '@anthropic-ai/sdk';

// Mock implementation for development without SDK
class MockAnthropicClient {
  constructor(private config: any) { }

  messages = {
    create: async (params: any) => {
      // Mock response for testing
      return {
        id: 'mock-' + Date.now(),
        type: 'message' as const,
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: `Mock Anthropic response for: ${params.messages?.[0]?.content || 'no content'}` }],
        model: params.model || 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn' as const,
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
      };
    },
    stream: async (params: any) => {
      const content = `Mock Anthropic streaming for: ${params.messages?.[0]?.content || 'no content'}`;

      async function* streamGenerator() {
        for (const word of content.split(' ')) {
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: word + ' ' },
            contentBlock: { index: 0 },
          };
        }

        yield {
          type: 'message_stop',
          message: {
            id: 'mock-stream-' + Date.now(),
            model: params.model || 'claude-3-5-sonnet-20241022',
            stop_reason: 'end_turn',
            usage: {
              input_tokens: 10,
              output_tokens: content.split(' ').length,
            },
          },
        };
      }

      return streamGenerator();
    },
  };
}

interface AnthropicMessage {
  id: string;
  type: 'message';
  role: 'user' | 'assistant' | 'system';
  content: Array<{ type: 'text'; text: string }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AnthropicStreamChunk {
  type: 'content_block_delta' | 'message_stop';
  delta?: { type: 'text_delta'; text: string };
  contentBlock?: { index: number };
  message?: {
    id: string;
    model: string;
    stop_reason: AnthropicMessage['stop_reason'];
    usage?: AnthropicMessage['usage'];
  };
}

// Use mock for development, replace with real SDK when available
const Anthropic = MockAnthropicClient;

import type {
  AIProvider,
  GenerateRequest,
  GenerateResponse,
  ProviderCapabilities,
  ProviderConfig,
} from './base.js';
import type { Message } from '../types/types.js';

/**
 * Anthropic provider configuration
 */
export interface AnthropicConfig extends ProviderConfig {
  apiKey: string;
  baseURL?: string;
  defaultModel?: string;
  maxRetries?: number;
  timeout?: number;
}

/**
 * Anthropic provider implementing AIProvider interface
 */
export class AnthropicProvider implements AIProvider {
  public readonly capabilities: ProviderCapabilities = {
    streaming: true,
    jsonMode: true,
    tools: true,
    vision: false,
    maxTokens: 200000,
    inputFormats: ['text'],
  };
  private client: MockAnthropicClient;
  private config: AnthropicConfig;

  constructor(config: AnthropicConfig) {
    if (!config.apiKey) {
      throw new Error('Anthropic API key is required');
    }

    this.config = {
      defaultModel: 'claude-3-5-sonnet-20241022',
      maxRetries: 3,
      timeout: 60000,
      ...config,
    };

    this.client = new MockAnthropicClient({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
      maxRetries: this.config.maxRetries,
      timeout: this.config.timeout,
    });
  }

  /**
   * Generate a complete response
   */
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const messages = this.formatMessages(request.prompt);
    const anthropicRequest = this.buildAnthropicRequest(request, messages);

    try {
      const response = await this.client.messages.create(anthropicRequest);
      return this.convertToGenerateResponse(response);
    } catch (error) {
      throw new Error(`Anthropic API error: ${(error as Error).message}`);
    }
  }

  /**
   * Generate a streaming response
   */
  async *streamGenerate(request: GenerateRequest): AsyncIterable<GenerateResponse> {
    const messages = this.formatMessages(request.prompt);
    const anthropicRequest = this.buildAnthropicRequest(request, messages, true);

    try {
      const stream = await this.client.messages.stream(anthropicRequest);

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta && chunk.delta.type === 'text_delta') {
          yield {
            id: chunk.contentBlock?.index?.toString() || 'stream-chunk',
            content: chunk.delta.text || '',
            model: request.model || this.config.defaultModel || 'claude-3-5-sonnet-20241022',
            finishReason: null,
          };
        }

        if (chunk.type === 'message_stop' && chunk.message) {
          yield {
            id: chunk.message.id,
            content: '',
            model: chunk.message.model,
            finishReason: this.mapFinishReason(chunk.message.stop_reason as any),
            usage: chunk.message.usage ? {
              promptTokens: chunk.message.usage.input_tokens,
              completionTokens: chunk.message.usage.output_tokens,
              totalTokens: chunk.message.usage.input_tokens + chunk.message.usage.output_tokens,
            } : undefined,
          };
        }
      }
    } catch (error) {
      throw new Error(`Anthropic streaming error: ${(error as Error).message}`);
    }
  }

  /**
   * Convert GenerateRequest to Anthropic message format
   */
  private formatMessages(prompt: GenerateRequest['prompt']): { role: string; content: string }[] {
    return typeof prompt === 'string'
      ? [{ role: 'user', content: prompt }]
      : prompt.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));
  }

  /**
   * Build Anthropic API request
   */
  private buildAnthropicRequest(
    request: GenerateRequest,
    messages: { role: string; content: string }[],
    stream = false
  ): any {
    const baseRequest: any = {
      model: request.model || this.config.defaultModel || 'claude-3-5-sonnet-20241022',
      messages,
      max_tokens: request.maxTokens || 1024,
      temperature: request.temperature,
      stream,
    };

    // Add additional options
    if (request.options) {
      if (request.options.top_p !== undefined) {
        // Anthropic doesn't have top_p, but we can ignore it or warn
        console.warn('Anthropic does not support top_p parameter');
      }
      if (request.options.frequency_penalty !== undefined) {
        // Anthropic doesn't have frequency_penalty
        console.warn('Anthropic does not support frequency_penalty parameter');
      }
      if (request.options.presence_penalty !== undefined) {
        // Anthropic doesn't have presence_penalty
        console.warn('Anthropic does not support presence_penalty parameter');
      }
    }

    return baseRequest;
  }

  /**
   * Convert Anthropic response to GenerateResponse
   */
  private convertToGenerateResponse(response: AnthropicMessage): GenerateResponse {
    const content = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');

    return {
      id: response.id,
      content,
      model: response.model,
      finishReason: this.mapFinishReason(response.stop_reason),
      usage: response.usage ? {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      } : undefined,
      raw: response,
    };
  }

  /**
   * Map Anthropic finish reasons to OpenGuard format
   */
  private mapFinishReason(reason: AnthropicMessage['stop_reason'] | null): GenerateResponse['finishReason'] {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'stop_sequence':
        return 'stop';
      case 'tool_use':
        return 'tool_calls';
      default:
        return null;
    }
  }
}
