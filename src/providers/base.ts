/**
 * Clean provider abstraction for AI chat completions
 */

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionError,
  Message,
} from '../types/types.js';

/**
 * Provider capabilities
 */
export interface ProviderCapabilities {
  /** Whether provider supports streaming */
  streaming: boolean;
  /** Whether provider supports JSON mode */
  jsonMode: boolean;
  /** Whether provider supports tools/function calling */
  tools: boolean;
  /** Whether provider supports vision/image input */
  vision: boolean;
  /** Maximum tokens supported (null if unknown) */
  maxTokens?: number;
  /** Supported input formats */
  inputFormats?: string[];
  /** Additional provider-specific capabilities */
  custom?: Record<string, boolean | string | number>;
}

/**
 * Core provider interface with modern naming conventions
 */
export interface AIProvider {
  /**
   * Provider capabilities
   */
  readonly capabilities: ProviderCapabilities;

  /**
   * Generate a complete response
   */
  generate(request: GenerateRequest): Promise<GenerateResponse>;

  /**
   * Generate a streaming response
   */
  streamGenerate(request: GenerateRequest): AsyncIterable<GenerateResponse>;
}

/**
 * Backward compatibility interface
 * @deprecated Use AIProvider instead
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

// Re-export NormalizedResponse for providers
export type { NormalizedResponse } from '../types/normalized.js';

/**
 * Simplified request interface for common use cases
 */
export interface GenerateRequest {
  /** The prompt or messages to send */
  prompt: string | Message[];

  /** Model identifier */
  model?: string;

  /** Sampling temperature (0-2) */
  temperature?: number;

  /** Maximum tokens to generate */
  maxTokens?: number;

  /** Additional provider-specific options */
  options?: Record<string, unknown>;
}

/**
 * Normalized response interface
 */
export interface GenerateResponse {
  /** Unique response identifier */
  id: string;

  /** Generated content */
  content: string;

  /** Model used for generation */
  model: string;

  /** Finish reason */
  finishReason?: 'stop' | 'length' | 'content_filter' | 'tool_calls' | null;

  /** Token usage information */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  /** Raw provider response for advanced use cases */
  raw?: unknown;
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
export type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionError,
  Message
};

/**
 * Utility to convert between request formats
 */
export function convertGenerateRequest(request: GenerateRequest): ChatCompletionRequest {
  const messages = typeof request.prompt === 'string'
    ? [{ role: 'user' as const, content: request.prompt }]
    : request.prompt;

  return {
    messages,
    model: request.model || 'default',
    temperature: request.temperature,
    maxTokens: request.maxTokens,
    ...request.options,
  };
}

/**
 * Utility to convert between response formats
 */
export function convertGenerateResponse(response: ChatCompletionResponse): GenerateResponse {
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
