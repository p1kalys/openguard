/**
 * Clean OpenAI provider implementation with new AIProvider interface
 */

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionError,
  Message,
} from '../types/types.js';
import type {
  AIProvider,
  GenerateRequest,
  GenerateResponse,
  NormalizedResponse,
  ChatCompletionProvider,
  ProviderConfig,
  ProviderCapabilities,
  convertGenerateRequest,
  convertGenerateResponse,
} from './base.js';

export interface OpenAIConfig extends ProviderConfig {
  apiKey: string;
  baseURL?: string;
  organization?: string;
  defaultModel?: string;
}

/**
 * OpenAI provider implementing the new AIProvider interface
 */
export class OpenAIProvider implements AIProvider {
  public readonly capabilities: ProviderCapabilities = {
    streaming: true,
    jsonMode: true,
    tools: true,
    vision: true,
    maxTokens: 128000,
    inputFormats: ['text', 'image'],
  };

  private config: OpenAIConfig;

  constructor(config: OpenAIConfig) {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.config = {
      defaultModel: 'gpt-4o-mini',
      baseURL: 'https://api.openai.com/v1',
      ...config,
    };
  }

  /**
   * Generate a complete response using the new interface
   */
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const chatRequest = this.convertToChatRequest(request);
    const chatResponse = await this.complete(chatRequest);
    return this.convertToGenerateResponse(chatResponse);
  }

  /**
   * Generate a streaming response using the new interface
   */
  async *streamGenerate(request: GenerateRequest): AsyncIterable<GenerateResponse> {
    const chatRequest = this.convertToChatRequest(request);

    for await (const chatResponse of this.stream(chatRequest)) {
      yield this.convertToGenerateResponse(chatResponse);
    }
  }

  /**
   * Legacy ChatCompletionProvider interface for backward compatibility
   * @deprecated Use generate() instead
   */
  async complete(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const url = `${this.config.baseURL}/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        ...(this.config.organization && { 'OpenAI-Organization': this.config.organization }),
      },
      body: JSON.stringify({
        model: request.model || this.config.defaultModel,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        top_p: request.topP,
        frequency_penalty: request.frequencyPenalty,
        presence_penalty: request.presencePenalty,
        stream: false,
        ...this.extractAdditionalOptions(request),
      }),
    });

    if (!response.ok) {
      const error: ChatCompletionError = await response.json().catch(() => ({
        message: response.statusText,
        type: 'http_error',
        code: response.status.toString(),
      }));
      throw new Error(`OpenAI API error: ${error.message}`);
    }

    const data = await response.json();
    return this.transformChatResponse(data);
  }

  /**
   * Legacy streaming interface for backward compatibility
   * @deprecated Use streamGenerate() instead
   */
  async *stream(request: ChatCompletionRequest): AsyncIterable<ChatCompletionResponse> {
    const url = `${this.config.baseURL}/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        ...(this.config.organization && { 'OpenAI-Organization': this.config.organization }),
      },
      body: JSON.stringify({
        model: request.model || this.config.defaultModel,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        top_p: request.topP,
        frequency_penalty: request.frequencyPenalty,
        presence_penalty: request.presencePenalty,
        stream: true,
        ...this.extractAdditionalOptions(request),
      }),
    });

    if (!response.ok) {
      const error: ChatCompletionError = await response.json().catch(() => ({
        message: response.statusText,
        type: 'http_error',
        code: response.status.toString(),
      }));
      throw new Error(`OpenAI API error: ${error.message}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === '' || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            yield this.transformChatResponse(data);
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  /**
   * Convert GenerateRequest to ChatCompletionRequest
   */
  private convertToChatRequest(request: GenerateRequest): ChatCompletionRequest {
    const messages = this.formatMessages(request.prompt);

    return {
      messages,
      model: request.model || this.config.defaultModel || 'gpt-4o-mini',
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      ...request.options,
    };
  }

  /**
   * Convert ChatCompletionResponse to GenerateResponse
   */
  private convertToGenerateResponse(response: ChatCompletionResponse): GenerateResponse {
    return {
      id: response.id,
      content: response.choices[0]?.message?.content || '',
      model: response.model,
      finishReason: response.choices[0]?.finishReason,
      usage: response.usage ? {
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        totalTokens: response.usage.totalTokens,
      } : undefined,
      raw: response,
    };
  }

  /**
   * Format prompt into OpenAI message format
   */
  private formatMessages(prompt: GenerateRequest['prompt']): Message[] {
    return typeof prompt === 'string'
      ? [{ role: 'user' as const, content: prompt }]
      : prompt;
  }

  /**
   * Transform OpenAI API response to ChatCompletionResponse
   */
  private transformChatResponse(data: any): ChatCompletionResponse {
    return {
      id: data.id,
      object: data.object,
      created: data.created,
      model: data.model,
      choices: data.choices.map((choice: any) => ({
        index: choice.index,
        message: {
          role: choice.message.role,
          content: choice.message.content,
        },
        finishReason: choice.finish_reason,
      })),
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  }

  /**
   * Extract additional options from request
   */
  private extractAdditionalOptions(request: ChatCompletionRequest): Record<string, any> {
    const options: Record<string, any> = {};

    if (request.topP !== undefined) options.top_p = request.topP;
    if (request.frequencyPenalty !== undefined) options.frequency_penalty = request.frequencyPenalty;
    if (request.presencePenalty !== undefined) options.presence_penalty = request.presencePenalty;

    return options;
  }
}
