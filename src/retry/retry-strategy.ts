/**
 * Retry strategy utilities
 */

import { error, OpenGuardResult } from '../errors.js';

export type BackoffStrategy = 'fixed' | 'linear' | 'exponential' | 'exponential-with-jitter';

export interface RetryConfig {
  /**
   * Maximum number of retry attempts
   */
  maxRetries: number;
  /**
   * Initial delay between retries in milliseconds
   */
  initialDelayMs?: number;
  /**
   * Maximum delay between retries in milliseconds
   */
  maxDelayMs?: number;
  /**
   * Backoff strategy for delay calculation
   */
  backoffStrategy?: BackoffStrategy;
  /**
   * Multiplier for exponential backoff
   */
  backoffMultiplier?: number;
  /**
   * Jitter factor for exponential-with-jitter (0-1)
   */
  jitterFactor?: number;
  /**
   * Custom retry condition based on error type and attempt number
   */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /**
   * Callback for each retry attempt
   */
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
  /**
   * Whether to retry on specific error types
   */
  retryableErrors?: string[];
  /**
   * Whether to retry on network errors
   */
  retryOnNetworkErrors?: boolean;
  /**
   * Whether to retry on timeout errors
   */
  retryOnTimeoutErrors?: boolean;
}

export interface RetryOptions extends RetryConfig { }

const defaultRetryConfig: Required<Omit<RetryConfig, 'maxRetries'>> = {
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffStrategy: 'exponential',
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  shouldRetry: () => true,
  onRetry: () => { },
  retryableErrors: [],
  retryOnNetworkErrors: true,
  retryOnTimeoutErrors: true,
};

/**
 * Calculate delay based on backoff strategy
 */
function calculateDelay(
  attempt: number,
  config: Required<Omit<RetryConfig, 'maxRetries'>>
): number {
  const { initialDelayMs, maxDelayMs, backoffStrategy, backoffMultiplier, jitterFactor } = config;

  let delay: number;

  switch (backoffStrategy) {
    case 'fixed':
      delay = initialDelayMs;
      break;
    case 'linear':
      delay = initialDelayMs * (attempt + 1);
      break;
    case 'exponential':
      delay = initialDelayMs * Math.pow(backoffMultiplier, attempt);
      break;
    case 'exponential-with-jitter':
      const baseDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt);
      const jitter = baseDelay * jitterFactor * (Math.random() * 2 - 1);
      delay = baseDelay + jitter;
      break;
    default:
      delay = initialDelayMs;
  }

  return Math.min(delay, maxDelayMs);
}

/**
 * Check if error is retryable based on configuration
 */
function isRetryableError(
  error: Error,
  config: Required<Omit<RetryConfig, 'maxRetries'>>
): boolean {
  const { retryableErrors, retryOnNetworkErrors, retryOnTimeoutErrors } = config;

  // Check specific error types first (highest priority)
  if (retryableErrors.length > 0) {
    return retryableErrors.some((type) => error.message.includes(type) || error.name.includes(type));
  }

  // Check network errors
  if (retryOnNetworkErrors) {
    const networkPatterns = ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'network', 'fetch'];
    if (networkPatterns.some((pattern) => error.message.toLowerCase().includes(pattern.toLowerCase()))) {
      return true;
    }
  }

  // Check timeout errors
  if (retryOnTimeoutErrors) {
    const timeoutPatterns = ['timeout', 'timed out', 'ETIMEDOUT'];
    if (timeoutPatterns.some((pattern) => error.message.toLowerCase().includes(pattern.toLowerCase()))) {
      return true;
    }
  }

  return false;
}

/**
 * Execute a function with retry logic
 *
 * @param fn - The function to execute with retries
 * @param options - Retry configuration
 * @returns Result of the function or error after all retries exhausted
 */
export async function retry<T>(
  fn: () => Promise<OpenGuardResult<T>>,
  options: RetryOptions
): Promise<OpenGuardResult<T>> {
  const config = { ...defaultRetryConfig, ...options };
  const { maxRetries, shouldRetry } = config;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (result.success) {
        return result;
      }
      // If the function returned an error result, check if we should retry
      const errorObj = new Error(result.error.message);
      const canRetry = attempt < maxRetries &&
        (shouldRetry?.(errorObj, attempt + 1) || isRetryableError(errorObj, config));

      if (canRetry) {
        lastError = errorObj;
        const delay = calculateDelay(attempt + 1, config);
        config.onRetry?.(errorObj, attempt + 1, delay);
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        continue;
      }
      return result;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Unknown error');
      const canRetry = attempt < maxRetries &&
        (shouldRetry?.(errorObj, attempt + 1) || isRetryableError(errorObj, config));

      if (canRetry) {
        lastError = errorObj;
        const delay = calculateDelay(attempt + 1, config);
        config.onRetry?.(errorObj, attempt + 1, delay);
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        continue;
      }
      return error(
        'RETRY_EXHAUSTED_ERROR',
        `All ${maxRetries + 1} attempts failed: ${errorObj.message}`,
        { retries: attempt + 1 }
      );
    }
  }

  return error(
    'RETRY_EXHAUSTED_ERROR',
    `All ${maxRetries + 1} attempts failed: ${lastError?.message || 'Unknown error'}`,
    { retries: maxRetries + 1 }
  );
}

/**
 * Preset retry strategies
 */
export const RetryStrategies = {
  /**
   * No retries
   */
  none: (): RetryConfig => ({
    maxRetries: 0,
  }),

  /**
   * Fixed delay retry strategy
   */
  fixed: (maxRetries: number = 3, delayMs: number = 1000): RetryConfig => ({
    maxRetries,
    initialDelayMs: delayMs,
    backoffStrategy: 'fixed',
  }),

  /**
   * Linear backoff retry strategy
   */
  linear: (maxRetries: number = 3, initialDelayMs: number = 1000): RetryConfig => ({
    maxRetries,
    initialDelayMs,
    backoffStrategy: 'linear',
  }),

  /**
   * Exponential backoff retry strategy
   */
  exponential: (maxRetries: number = 3, initialDelayMs: number = 1000): RetryConfig => ({
    maxRetries,
    initialDelayMs,
    backoffStrategy: 'exponential',
  }),

  /**
   * Exponential backoff with jitter retry strategy (recommended for production)
   */
  exponentialWithJitter: (maxRetries: number = 3, initialDelayMs: number = 1000): RetryConfig => ({
    maxRetries,
    initialDelayMs,
    backoffStrategy: 'exponential-with-jitter',
    jitterFactor: 0.1,
  }),

  /**
   * Aggressive retry strategy for transient errors
   */
  aggressive: (): RetryConfig => ({
    maxRetries: 5,
    initialDelayMs: 100,
    backoffStrategy: 'exponential-with-jitter',
    backoffMultiplier: 1.5,
    maxDelayMs: 10000,
  }),

  /**
   * Conservative retry strategy for critical operations
   */
  conservative: (): RetryConfig => ({
    maxRetries: 2,
    initialDelayMs: 2000,
    backoffStrategy: 'linear',
    maxDelayMs: 5000,
  }),
};

/**
 * Create a custom retry strategy
 */
export function createRetryStrategy(config: Partial<RetryConfig>): RetryConfig {
  return {
    maxRetries: 3,
    ...config,
  };
}

/**
 * Merge retry strategies with custom overrides
 */
export function mergeRetryStrategies(
  base: RetryConfig,
  overrides: Partial<RetryConfig>
): RetryConfig {
  return {
    ...base,
    ...overrides,
  };
}
