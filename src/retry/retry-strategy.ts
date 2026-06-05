/**
 * Retry strategy utilities for OpenGuard
 *
 * retry() wraps any async function that returns OpenGuardResult<T> and
 * re-invokes it on failure (thrown error OR success:false result).
 */

import { success, error, type OpenGuardResult } from '../errors/result.js';
import type { RequestEventContext } from '../events/helpers.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BackoffStrategy =
  | 'fixed'
  | 'linear'
  | 'exponential'
  | 'exponential-with-jitter';

export interface RetryOptions {
  /** Maximum number of retry attempts (not counting the initial call). */
  maxRetries: number;
  /** Base delay in milliseconds between retries. Default: 0. */
  initialDelayMs?: number;
  /** How delay grows across retries. Default: 'exponential'. */
  backoffStrategy?: BackoffStrategy;
  /** Jitter factor applied on 'exponential-with-jitter'. Default: 0.1. */
  jitterFactor?: number;
  /**
   * Called before each retry with the triggering error, retry number (1-based),
   * and the delay that will be applied.
   */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  /**
   * Return false to abort retrying immediately.
   * Takes precedence over retryableErrors / retryOnNetworkErrors.
   */
  shouldRetry?: (error: unknown) => boolean;
  /** Retry only when the error message includes one of these substrings. */
  retryableErrors?: string[];
  /** Retry on common network errors (ECONNREFUSED, ETIMEDOUT, …). Default: true. */
  retryOnNetworkErrors?: boolean;
  /** Optional event context for observability retry events. */
  eventContext?: RequestEventContext;
}

// ---------------------------------------------------------------------------
// Core retry function
// ---------------------------------------------------------------------------

const NETWORK_ERROR_PATTERNS = [
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND',
  'network', 'timeout', 'socket',
];

function isNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return NETWORK_ERROR_PATTERNS.some((p) => msg.toUpperCase().includes(p.toUpperCase()));
}

function shouldAttemptRetry(err: unknown, opts: RetryOptions): boolean {
  if (opts.shouldRetry !== undefined) return opts.shouldRetry(err);

  const msg = err instanceof Error ? err.message : String(err);

  if (opts.retryableErrors?.length) {
    const matches = opts.retryableErrors.some((pattern) =>
      msg.toLowerCase().includes(pattern.toLowerCase())
    );
    if (!matches && !(opts.retryOnNetworkErrors !== false && isNetworkError(err))) {
      return false;
    }
  }

  if (opts.retryOnNetworkErrors === false) {
    // Only retry if it's explicitly in retryableErrors
    return (opts.retryableErrors ?? []).some((p) =>
      msg.toLowerCase().includes(p.toLowerCase())
    );
  }

  return true;
}

function computeDelay(retryNumber: number, opts: RetryOptions): number {
  const base = opts.initialDelayMs ?? 0;
  if (base === 0) return 0;

  const strategy = opts.backoffStrategy ?? 'exponential';

  switch (strategy) {
    case 'fixed':
      return base;
    case 'linear':
      return base * retryNumber;
    case 'exponential':
      return base * Math.pow(2, retryNumber - 1);
    case 'exponential-with-jitter': {
      const raw = base * Math.pow(2, retryNumber - 1);
      const factor = opts.jitterFactor ?? 0.1;
      return raw + raw * factor * Math.random();
    }
  }
}

/**
 * Retry an async function that returns OpenGuardResult<T>.
 *
 * The function is retried when it:
 *  - throws / rejects, OR
 *  - returns { success: false }
 *
 * @returns The first successful OpenGuardResult<T>, or an error result
 *          with type 'RETRY_EXHAUSTED_ERROR' after all attempts are spent.
 */
export async function retry<T>(
  fn: () => Promise<OpenGuardResult<T>>,
  opts: RetryOptions
): Promise<OpenGuardResult<T>> {
  const maxAttempts = opts.maxRetries + 1; // initial call + retries
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();

      if (result.success) return result;

      // Treat a failure result as a retryable error
      lastError = new Error(result.error.message);
    } catch (err) {
      lastError = err;
    }

    const isLastAttempt = attempt === maxAttempts;
    if (isLastAttempt) break;

    if (!shouldAttemptRetry(lastError, opts)) break;

    const retryNumber = attempt; // 1st retry is retryNumber=1
    const delayMs = computeDelay(retryNumber, opts);

    opts.onRetry?.(lastError, retryNumber, delayMs);

    if (opts.eventContext) {
      const reason = lastError instanceof Error ? lastError.message : String(lastError);
      void opts.eventContext.emitRetry(
        retryNumber,
        opts.maxRetries,
        reason,
        delayMs,
        lastError instanceof Error ? lastError : new Error(reason)
      );
    }

    if (delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return error('RETRY_EXHAUSTED_ERROR', `Retry exhausted after ${maxAttempts} attempt(s)`, {
    retries: maxAttempts,
  });
}

// ---------------------------------------------------------------------------
// Preset strategies
// ---------------------------------------------------------------------------

export const RetryStrategies = {
  /** No retries — fail immediately. */
  none(): RetryOptions {
    return { maxRetries: 0 };
  },

  /** Fixed delay between retries. */
  fixed(maxRetries = 3, initialDelayMs = 1000): RetryOptions {
    return { maxRetries, initialDelayMs, backoffStrategy: 'fixed' };
  },

  /** Exponential backoff. */
  exponential(maxRetries = 3, initialDelayMs = 500): RetryOptions {
    return { maxRetries, initialDelayMs, backoffStrategy: 'exponential' };
  },

  /** Exponential backoff with jitter to avoid thundering-herd. */
  exponentialWithJitter(maxRetries = 3, initialDelayMs = 500, jitterFactor = 0.1): RetryOptions {
    return { maxRetries, initialDelayMs, backoffStrategy: 'exponential-with-jitter', jitterFactor };
  },

  /** High-frequency retries for transient failures. */
  aggressive(maxRetries = 5, initialDelayMs = 100): RetryOptions {
    return { maxRetries, initialDelayMs, backoffStrategy: 'exponential' };
  },

  /** Low-frequency retries for expensive or rate-limited operations. */
  conservative(maxRetries = 2, initialDelayMs = 2000): RetryOptions {
    return { maxRetries, initialDelayMs, backoffStrategy: 'exponential' };
  },
} as const;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Create a RetryOptions object (passthrough for type safety and documentation). */
export function createRetryStrategy(opts: RetryOptions): RetryOptions {
  return opts;
}

/** Merge two RetryOptions objects, with overrides taking precedence. */
export function mergeRetryStrategies(
  base: RetryOptions,
  overrides: Partial<RetryOptions>
): RetryOptions {
  return { ...base, ...overrides };
}
