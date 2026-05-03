/**
 * Clean OpenAI provider implementation
 */

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionError,
} from '../types/types.js';
import type {
  ChatCompletionProvider,
  ProviderConfig,
} from './base.js';

export interface OpenAIConfig extends ProviderConfig {
  apiKey: string;
  baseURL?: string;
  organization?: string;
  defaultModel?: string;
}

export class OpenAIProvider implements ChatCompletionProvider {
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
    return this.transformResponse(data);
  }

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
            yield this.transformResponse(data);
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  private transformResponse(data: any): ChatCompletionResponse {
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
}
