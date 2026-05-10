/**
 * Gemini provider implementation using Google Generative AI SDK
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  AIProvider,
  GenerateRequest,
  GenerateResponse,
  ProviderCapabilities,
  ProviderConfig,
} from './base.js';
import type { Message } from '../types/types.js';

export interface GeminiConfig extends ProviderConfig {
  apiKey: string;
  defaultModel?: string;
  baseURL?: string;
}

/**
 * Gemini provider implementing the AIProvider interface
 */
export class GeminiProvider implements AIProvider {
  public readonly capabilities: ProviderCapabilities = {
    streaming: true,
    jsonMode: true,
    tools: true,
    vision: true,
    maxTokens: 8192,
    inputFormats: ['text', 'image'],
  };
  private config: GeminiConfig;
  private client: GoogleGenerativeAI;

  constructor(config: GeminiConfig) {
    if (!config.apiKey) {
      throw new Error('Gemini API key is required');
    }

    this.config = {
      defaultModel: 'gemini-1.5-flash',
      ...config,
    };

    this.client = new GoogleGenerativeAI(this.config.apiKey);
  }

  /**
   * Generate a complete response
   */
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const model = this.client.getGenerativeModel({
      model: request.model || this.config.defaultModel || 'gemini-1.5-flash',
    });

    const prompt = this.formatPrompt(request.prompt);
    const generationConfig = {
      temperature: request.temperature,
      maxOutputTokens: request.maxTokens,
    };

    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
      });
      const response = result.response;

      return {
        id: this.generateId(),
        content: response.text(),
        model: request.model || this.config.defaultModel || 'gemini-1.5-flash',
        finishReason: this.mapFinishReason(response.candidates?.[0]?.finishReason),
        usage: this.extractUsage(response.usageMetadata),
        raw: response,
      };
    } catch (error) {
      throw new Error(`Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a streaming response
   */
  async *streamGenerate(request: GenerateRequest): AsyncIterable<GenerateResponse> {
    const model = this.client.getGenerativeModel({
      model: request.model || this.config.defaultModel || 'gemini-1.5-flash',
    });

    const prompt = this.formatPrompt(request.prompt);
    const generationConfig = {
      temperature: request.temperature,
      maxOutputTokens: request.maxTokens,
    };

    try {
      const result = await model.generateContentStream({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
      });

      for await (const chunk of result.stream) {
        const text = chunk.text();

        yield {
          id: this.generateId(),
          content: text,
          model: request.model || this.config.defaultModel || 'gemini-1.5-flash',
          finishReason: this.mapFinishReason(chunk.candidates?.[0]?.finishReason),
          usage: this.extractUsage(chunk.usageMetadata),
          raw: chunk,
        };
      }
    } catch (error) {
      throw new Error(`Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format prompt for Gemini API
   */
  private formatPrompt(prompt: GenerateRequest['prompt']): string {
    if (typeof prompt === 'string') {
      return prompt;
    }

    // Convert message array to a single prompt string
    return prompt
      .map(message => {
        const role = message.role === 'user' ? 'User' :
          message.role === 'assistant' ? 'Assistant' :
            message.role === 'system' ? 'System' : 'Tool';
        return `${role}: ${message.content}`;
      })
      .join('\n\n');
  }

  /**
   * Map Gemini finish reasons to standard format
   */
  private mapFinishReason(reason?: string): GenerateResponse['finishReason'] {
    switch (reason) {
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
        return 'content_filter';
      case 'RECITATION':
        return 'content_filter';
      default:
        return null;
    }
  }

  /**
   * Extract usage information from Gemini response
   */
  private extractUsage(usage?: any): GenerateResponse['usage'] {
    if (!usage) return undefined;

    return {
      promptTokens: usage.promptTokenCount || 0,
      completionTokens: usage.candidatesTokenCount || 0,
      totalTokens: usage.totalTokenCount || 0,
    };
  }

  /**
   * Generate a unique ID for responses
   */
  private generateId(): string {
    return `gemini-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
