/**
 * Retry error class
 */

import { OpenGuardError, ErrorCategory, createOpenGuardError } from './base.js';

/**
 * Retry error class
 */
export class RetryError extends OpenGuardError {
  public readonly attempt: number;
  public readonly maxAttempts: number;
  public readonly delay: number;

  constructor(
    message: string,
    code: string,
    attempt: number,
    maxAttempts: number,
    delay: number,
    options: {
      requestId?: string;
      details?: Record<string, any>;
    } = {}
  ) {
    super(message, code, ErrorCategory.NETWORK, {
      requestId: options.requestId,
      details: {
        attempt,
        maxAttempts,
        delay,
        ...options.details,
      },
    });
    
    this.attempt = attempt;
    this.maxAttempts = maxAttempts;
    this.delay = delay;
  }

  /**
   * Get retry summary
   */
  getSummary(): string {
    return `Retry ${this.attempt}/${this.maxAttempts} after ${this.delay}ms delay`;
  }
}
