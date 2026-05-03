/**
 * Clean provider abstraction for AI chat completions
 */

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionError,
} from '../types/types.js';

/**
 * Minimal interface for chat completion providers
 */
export interface ChatCompletionProvider {
  /**
   * Create a chat completion
   */
  complete(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;

  /**
   * Create a streaming chat completion
   */
  stream(request: ChatCompletionRequest): AsyncIterable<ChatCompletionResponse>;
}

/**
 * Provider configuration type
 */
export type ProviderConfig = Record<string, unknown>;

/**
 * Provider error for consistent error handling
 */
export class ProviderError extends Error {
  public readonly originalError?: ChatCompletionError;

  constructor(message: string, originalError?: ChatCompletionError) {
    super(message);
    this.name = 'ProviderError';
    this.originalError = originalError;
  }
}

// Re-export types for convenience
export type { ChatCompletionRequest, ChatCompletionResponse, ChatCompletionError };
