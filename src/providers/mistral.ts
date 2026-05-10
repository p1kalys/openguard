/**
 * Mistral provider implementation using Mistral AI SDK
 */

import MistralClient from '@mistralai/mistralai';
import type {
  AIProvider,
  GenerateRequest,
  GenerateResponse,
  ProviderCapabilities,
  ProviderConfig,
} from './base.js';
import type { Message } from '../types/types.js';

export interface MistralConfig extends ProviderConfig {
  apiKey: string;
  baseURL?: string;
  defaultModel?: string;
  organization?: string;
}

/**
 * Mistral provider implementing the AIProvider interface
 */
export class MistralProvider implements AIProvider {
  public readonly capabilities: ProviderCapabilities = {
    streaming: true,
    jsonMode: false,
    tools: false,
    vision: false,
    maxTokens: 32000,
    inputFormats: ['text'],
  };
  private config: MistralConfig;
  private client: MistralClient;

  constructor(config: MistralConfig) {
    if (!config.apiKey) {
      throw new Error('Mistral API key is required');
    }

    this.config = {
      defaultModel: 'mistral-tiny',
      baseURL: 'https://api.mistral.ai/v1',
      ...config,
    };

    this.client = new MistralClient(this.config.apiKey);
  }

  /**
   * Generate a complete response
   */
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const messages = this.formatMessages(request.prompt);
    const model = request.model || this.config.defaultModel || 'mistral-tiny';

    try {
      const response = await this.client.chat({
        model,
        messages,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        ...this.extractAdditionalOptions(request),
      });

      return this.transformResponse(response, model);
    } catch (error) {
      throw new Error(`Mistral API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a streaming response
   */
  async *streamGenerate(request: GenerateRequest): AsyncIterable<GenerateResponse> {
    const messages = this.formatMessages(request.prompt);
    const model = request.model || this.config.defaultModel || 'mistral-tiny';

    try {
      const stream = await this.client.chatStream({
        model,
        messages,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        ...this.extractAdditionalOptions(request),
      });

      for await (const chunk of stream) {
        yield this.transformStreamChunk(chunk, model);
      }
    } catch (error) {
      throw new Error(`Mistral API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format messages for Mistral API
   */
  private formatMessages(prompt: GenerateRequest['prompt']): any[] {
    if (typeof prompt === 'string') {
      return [{ role: 'user', content: prompt }];
    }

    return prompt.map(message => {
      if (message.role === 'tool') {
        // Mistral doesn't support tool messages, convert to user message
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
   * Transform Mistral response to GenerateResponse
   */
  private transformResponse(response: any, model: string): GenerateResponse {
    const choice = response.choices?.[0];

    return {
      id: response.id || this.generateId(),
      content: choice?.message?.content || '',
      model,
      finishReason: this.mapFinishReason(choice?.finishReason),
      usage: response.usage ? {
        promptTokens: response.usage.promptTokens || 0,
        completionTokens: response.usage.completionTokens || 0,
        totalTokens: response.usage.totalTokens || 0,
      } : undefined,
      raw: response,
    };
  }

  /**
   * Transform stream chunk to GenerateResponse
   */
  private transformStreamChunk(chunk: any, model: string): GenerateResponse {
    const delta = chunk.choices?.[0]?.delta;

    return {
      id: chunk.id || this.generateId(),
      content: delta?.content || '',
      model,
      finishReason: this.mapFinishReason(chunk.choices?.[0]?.finishReason),
      usage: chunk.usage ? {
        promptTokens: chunk.usage.promptTokens || 0,
        completionTokens: chunk.usage.completionTokens || 0,
        totalTokens: chunk.usage.totalTokens || 0,
      } : undefined,
      raw: chunk,
    };
  }

  /**
   * Map Mistral finish reasons to standard format
   */
  private mapFinishReason(reason?: string): GenerateResponse['finishReason'] {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'model_length':
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
    return `mistral-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
