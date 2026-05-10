/**
 * Retry utilities for OpenGuard
 */

import type { GenerateResponse } from '../providers/base.js';

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Base delay in milliseconds */
  baseDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Exponential backoff multiplier */
  backoffMultiplier: number;
  /** Whether to add jitter */
  jitter: boolean;
}

/**
 * Retry result
 */
export interface RetryResult<T> {
  /** Whether operation succeeded */
  success: boolean;
  /** Result if successful */
  result?: T;
  /** Error if failed */
  error?: Error;
  /** Number of attempts made */
  attempts: number;
  /** Total time spent retrying */
  totalTime: number;
}

/**
 * Simple retry utility
 */
export class RetryUtil {
  constructor(private config: Partial<RetryConfig> = {}) {}

  /**
   * Execute function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    shouldRetry: (error: Error) => boolean = () => true
  ): Promise<RetryResult<T>> {
    const fullConfig: RetryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: true,
      ...this.config,
    };

    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= fullConfig.maxAttempts; attempt++) {
      try {
        const result = await fn();
        return {
          success: true,
          result,
          attempts: attempt,
          totalTime: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry if shouldRetry returns false
        if (!shouldRetry(lastError)) {
          break;
        }
        
        // Don't wait after last attempt
        if (attempt < fullConfig.maxAttempts) {
          const delay = this.calculateDelay(attempt, fullConfig);
          await this.wait(delay);
        }
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: fullConfig.maxAttempts,
      totalTime: Date.now() - startTime,
    };
  }

  /**
   * Calculate delay with exponential backoff
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    
    // Apply maximum delay limit
    delay = Math.min(delay, config.maxDelay);
    
    // Add jitter if enabled
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }

  /**
   * Wait for specified delay
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Utility function to retry operations
 */
export async function retry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>,
  shouldRetry?: (error: Error) => boolean
): Promise<RetryResult<T>> {
  const retryUtil = new RetryUtil(config);
  return retryUtil.execute(fn, shouldRetry);
}
