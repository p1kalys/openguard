/**
 * Retry reason constants
 */

/**
 * Standard retry reasons
 */
export const RETRY_REASONS = {
  NETWORK_ERROR: 'network_error',
  TIMEOUT: 'timeout',
  RATE_LIMIT: 'rate_limit',
  SERVER_ERROR: 'server_error',
  AUTHENTICATION_ERROR: 'authentication_error',
  VALIDATION_ERROR: 'validation_error',
  UNKNOWN_ERROR: 'unknown_error',
} as const;

/**
 * Retry reason type
 */
export type RetryReason = typeof RETRY_REASONS[keyof typeof RETRY_REASONS];

/**
 * Check if error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  return (
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('rate limit') ||
    message.includes('econnreset') ||
    message.includes('enotfound')
  );
}

/**
 * Get retry delay based on reason
 */
export function getRetryDelay(reason: RetryReason, attempt: number): number {
  const baseDelays: Record<RetryReason, number> = {
    network_error: 1000,
    timeout: 2000,
    rate_limit: 5000,
    server_error: 1500,
    authentication_error: 0, // Don't retry auth errors
    validation_error: 0, // Don't retry validation errors
    unknown_error: 1000,
  };

  const baseDelay = baseDelays[reason] || 1000;
  return Math.min(baseDelay * Math.pow(2, attempt - 1), 30000);
}
