/**
 * Response normalization layer for OpenGuard
 */

import type { GenerateResponse } from '../providers/base.js';

/**
 * Standardized finish reasons across all providers
 */
export type StandardFinishReason = 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'timeout' | 'error' | null;

/**
 * Normalized token usage information
 */
export interface NormalizedUsage {
  /** Input tokens consumed */
  promptTokens: number;
  /** Output tokens generated */
  completionTokens: number;
  /** Total tokens used */
  totalTokens: number;
  /** Cost estimation (if available) */
  estimatedCost?: number;
  /** Token model used */
  tokenModel?: string;
}

/**
 * Normalized response structure
 */
export interface NormalizedResponse {
  /** Unique response identifier */
  id: string;
  /** Normalized content text */
  content: string;
  /** Normalized model name */
  model: string;
  /** Provider that generated response */
  provider: string;
  /** Standardized finish reason */
  finishReason: StandardFinishReason;
  /** Normalized usage information */
  usage?: NormalizedUsage;
  /** Timestamp when response was generated */
  timestamp: number;
  /** Processing time in milliseconds */
  processingTime?: number;
  /** Raw provider response for advanced use cases */
  raw?: unknown;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Response normalizer for consistent output across providers
 */
export class ResponseNormalizer {
  private providerName: string;

  constructor(providerName: string) {
    this.providerName = providerName;
  }

  /**
   * Normalize a provider response
   */
  normalize(response: GenerateResponse, processingTime?: number): NormalizedResponse {
    return {
      id: response.id || `${this.providerName.toLowerCase()}-${Date.now()}`,
      content: response.content || '',
      model: this.normalizeModel(response.model),
      provider: this.providerName,
      finishReason: this.normalizeFinishReason(response.finishReason),
      usage: this.normalizeUsage(response.usage),
      timestamp: Date.now(),
      processingTime,
      raw: response,
    };
  }

  /**
   * Normalize model name
   */
  private normalizeModel(model?: string): string {
    if (!model) return 'unknown';
    
    // Extract family name
    const normalized = model.toLowerCase();
    if (normalized.includes('gpt')) return 'GPT';
    if (normalized.includes('claude')) return 'Claude';
    if (normalized.includes('gemini')) return 'Gemini';
    if (normalized.includes('llama')) return 'Llama';
    if (normalized.includes('mistral')) return 'Mistral';
    
    return model;
  }

  /**
   * Normalize finish reason
   */
  private normalizeFinishReason(reason?: string | null): StandardFinishReason {
    if (!reason) return null;
    
    const normalized = reason.toLowerCase();
    if (normalized.includes('stop')) return 'stop';
    if (normalized.includes('length')) return 'length';
    if (normalized.includes('filter')) return 'content_filter';
    if (normalized.includes('tool')) return 'tool_calls';
    if (normalized.includes('timeout')) return 'timeout';
    
    return 'error';
  }

  /**
   * Normalize usage information
   */
  private normalizeUsage(usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }): NormalizedUsage | undefined {
    if (!usage) return undefined;
    
    const promptTokens = usage.promptTokens || 0;
    const completionTokens = usage.completionTokens || 0;
    const totalTokens = usage.totalTokens || (promptTokens + completionTokens);
    
    return {
      promptTokens,
      completionTokens,
      totalTokens,
    };
  }
}

/**
 * Utility function to normalize responses
 */
export function normalizeResponse(
  response: GenerateResponse,
  providerName: string,
  processingTime?: number
): NormalizedResponse {
  const normalizer = new ResponseNormalizer(providerName);
  return normalizer.normalize(response, processingTime);
}
