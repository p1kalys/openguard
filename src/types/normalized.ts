/**
 * Standardized normalized response interface
 * This becomes the internal universal AI format for OpenGuard
 */

/**
 * Standardized token usage
 */
export interface NormalizedUsage {
  /** Input tokens consumed */
  inputTokens?: number;
  /** Output tokens generated */
  outputTokens?: number;
  /** Total tokens used */
  totalTokens?: number;
}

/**
 * Standardized normalized response - CRITICAL INTERFACE
 */
export interface NormalizedResponse {
  /** Response text content */
  text: string;
  /** Provider that generated response */
  provider: string;
  /** Model name used */
  model: string;
  /** Token usage information */
  usage?: NormalizedUsage;
  /** Finish reason */
  finishReason?: string;
  /** Raw provider response */
  raw?: unknown;
}

/**
 * Standardized request interface
 */
export interface NormalizedRequest {
  /** Request text content */
  text: string;
  /** Request metadata */
  metadata?: Record<string, any>;
}
