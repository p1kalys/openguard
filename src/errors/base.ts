/**
 * Base error class for OpenGuard
 */

/**
 * Base error class with structured error information
 */
export class OpenGuardError extends Error {
  public readonly code: string;
  public readonly category: ErrorCategory;
  public readonly provider?: string;
  public readonly model?: string;
  public readonly requestId?: string;
  public readonly timestamp: number;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    code: string,
    category: ErrorCategory,
    options: {
      provider?: string;
      model?: string;
      requestId?: string;
      details?: Record<string, any>;
    } = {}
  ) {
    super(message);
    this.code = code;
    this.category = category;
    this.provider = options.provider;
    this.model = options.model;
    this.requestId = options.requestId;
    this.timestamp = Date.now();
    this.details = options.details;
  }

  /**
   * Get error summary
   */
  getSummary(): string {
    return `${this.category}: ${this.code} - ${this.message}`;
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return this.category === 'network' || this.category === 'timeout' || this.category === 'rate_limit';
  }

  /**
   * Check if error is client error
   */
  isClientError(): boolean {
    return this.category === 'authentication' || this.category === 'validation' || this.category === 'configuration';
  }

  /**
   * Convert to plain object for logging
   */
  toJSON(): Record<string, any> {
    return {
      name: this.constructor.name,
      message: this.message,
      code: this.code,
      category: this.category,
      provider: this.provider,
      model: this.model,
      requestId: this.requestId,
      timestamp: this.timestamp,
      details: this.details,
      stack: this.stack,
    };
  }
}

/**
 * Error categories
 */
export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  SERVER_ERROR = 'server_error',
  CONFIGURATION = 'configuration',
  PARSING = 'parsing',
  PROVIDER_ERROR = 'provider_error',
  UNKNOWN = 'unknown',
}

/**
 * Create OpenGuard error
 */
export function createOpenGuardError(
  message: string,
  code: string,
  category: ErrorCategory,
  options: {
    provider?: string;
    model?: string;
    requestId?: string;
    details?: Record<string, any>;
  } = {}
): OpenGuardError {
  return new OpenGuardError(message, code, category, options);
}
