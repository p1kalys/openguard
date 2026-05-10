/**
 * OpenAI verification provider implementation
 */

import { BaseVerificationProvider } from './base.js';
import { VerificationRequest, VerificationProviderResponse } from '../types.js';

/**
 * OpenAI verification provider
 */
export class OpenAIVerificationProvider extends BaseVerificationProvider {
  name = 'openai';
  
  private apiKey: string;
  private client: any;

  constructor(apiKey: string, config?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }) {
    super(config);
    this.apiKey = apiKey;
    
    // Dynamic import to avoid bundling issues
    try {
      this.client = require('openai');
    } catch (error) {
      throw new Error('OpenAI package not found. Please install it with: npm install openai');
    }
  }

  async verify(request: VerificationRequest): Promise<VerificationProviderResponse> {
    if (!this.isAvailable()) {
      throw new Error('OpenAI provider is not available');
    }

    const { result, processingTime } = await this.measureTime(async () => {
      const openai = new this.client.OpenAI({
        apiKey: this.apiKey,
      });

      const completion = await openai.chat.completions.create({
        model: this.config.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a verification assistant. Provide accurate, thorough analysis following the requested format.',
          },
          {
            role: 'user',
            content: request.prompt,
          },
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      });

      return completion.choices[0]?.message?.content || '';
    });

    const tokens = {
      input: 0, // OpenAI doesn't provide exact token count in response
      output: 0,
      total: 0,
    };

    return this.createResponse(
      result,
      this.config.model || 'gpt-3.5-turbo',
      tokens,
      processingTime
    );
  }

  isAvailable(): boolean {
    return !!this.apiKey && !!this.client;
  }
}
