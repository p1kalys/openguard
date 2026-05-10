/**
 * OpenRouter provider implementation using OpenRouter SDK
 */

import OpenAI from 'openai';
import type {
  AIProvider,
  GenerateRequest,
  GenerateResponse,
  ProviderCapabilities,
  ProviderConfig,
} from './base.js';
import type { Message } from '../types/types.js';

export interface OpenRouterConfig extends ProviderConfig {
  apiKey: string;
  baseURL?: string;
  defaultModel?: string;
  timeout?: number;
  siteName?: string;
  siteUrl?: string;
}

/**
 * OpenRouter provider implementing the AIProvider interface
 */
export class OpenRouterProvider implements AIProvider {
  public readonly capabilities: ProviderCapabilities = {
    streaming: true,
    jsonMode: true,
    tools: true,
    vision: false,
    maxTokens: 128000,
    inputFormats: ['text'],
  };
  private config: OpenRouterConfig;
  private client: OpenAI;

  constructor(config: OpenRouterConfig) {
    if (!config.apiKey) {
      throw new Error('OpenRouter API key is required');
    }

    this.config = {
      defaultModel: 'meta-llama/llama-3.1-8b-instruct:free',
      baseURL: 'https://openrouter.ai/api/v1',
      timeout: 30000,
      siteName: 'OpenGuard',
      siteUrl: 'https://github.com/pavanemani/openguard',
      ...config,
    };

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      defaultHeaders: {
        'HTTP-Referer': this.config.siteUrl,
        'X-Title': this.config.siteName,
      },
    });
  }

  /**
   * Generate a complete response
   */
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const messages = this.formatMessages(request.prompt);
    const model = request.model || this.config.defaultModel || 'meta-llama/llama-3.1-8b-instruct:free';

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: false,
        ...this.extractAdditionalOptions(request),
      });

      return this.transformResponse(response);
    } catch (error) {
      throw new Error(`OpenRouter API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a streaming response
   */
  async *streamGenerate(request: GenerateRequest): AsyncIterable<GenerateResponse> {
    const messages = this.formatMessages(request.prompt);
    const model = request.model || this.config.defaultModel || 'meta-llama/llama-3.1-8b-instruct:free';

    try {
      const stream = await this.client.chat.completions.create({
        model,
        messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: true,
        ...this.extractAdditionalOptions(request),
      });

      for await (const chunk of stream) {
        yield this.transformStreamChunk(chunk);
      }
    } catch (error) {
      throw new Error(`OpenRouter API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format messages for OpenRouter API
   */
  private formatMessages(prompt: GenerateRequest['prompt']): any[] {
    if (typeof prompt === 'string') {
      return [{ role: 'user', content: prompt }];
    }

    return prompt.map(message => {
      if (message.role === 'tool') {
        // OpenRouter doesn't support tool messages in all models, convert to user message
        return {
          role: 'user',
          content: message.content,
        };
      }
      return {
        role: message.role,
        content: message.content,
      };
    });
  }

  /**
   * Transform OpenRouter response to GenerateResponse
   */
  private transformResponse(response: any): GenerateResponse {
    const choice = response.choices?.[0];

    return {
      id: response.id || this.generateId(),
      content: choice?.message?.content || '',
      model: response.model,
      finishReason: this.mapFinishReason(choice?.finish_reason),
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens || 0,
        completionTokens: response.usage.completion_tokens || 0,
        totalTokens: response.usage.total_tokens || 0,
      } : undefined,
      raw: response,
    };
  }

  /**
   * Transform stream chunk to GenerateResponse
   */
  private transformStreamChunk(chunk: any): GenerateResponse {
    const delta = chunk.choices?.[0]?.delta;

    return {
      id: chunk.id || this.generateId(),
      content: delta?.content || '',
      model: chunk.model,
      finishReason: this.mapFinishReason(chunk.choices?.[0]?.finish_reason),
      usage: chunk.usage ? {
        promptTokens: chunk.usage.prompt_tokens || 0,
        completionTokens: chunk.usage.completion_tokens || 0,
        totalTokens: chunk.usage.total_tokens || 0,
      } : undefined,
      raw: chunk,
    };
  }

  /**
   * Map OpenRouter finish reasons to standard format
   */
  private mapFinishReason(reason?: string): GenerateResponse['finishReason'] {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      case 'tool_calls':
        return 'tool_calls';
      default:
        return null;
    }
  }

  /**
   * Extract additional options from request
   */
  private extractAdditionalOptions(request: GenerateRequest): Record<string, any> {
    const options: Record<string, any> = {};

    if (request.options) {
      Object.assign(options, request.options);
    }

    return options;
  }

  /**
   * Generate a unique ID for responses
   */
  private generateId(): string {
    return `openrouter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
