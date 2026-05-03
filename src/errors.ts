/**
 * Structured error objects for OpenGuard
 */

export type ErrorType =
  | 'SCHEMA_VALIDATION_ERROR'
  | 'JSON_PARSE_ERROR'
  | 'JSON_REPAIR_ERROR'
  | 'PROVIDER_ERROR'
  | 'RETRY_EXHAUSTED_ERROR'
  | 'GUARDRAIL_VIOLATION_ERROR'
  | 'UNKNOWN_ERROR';

export interface ErrorDetails {
  type: ErrorType;
  message: string;
  retries?: number;
  originalResponse?: string;
  repairedResponse?: string;
  validationIssues?: string[];
  provider?: string;
  timestamp: number;
}

export interface Result<T> {
  success: true;
  data: T;
}

export interface ErrorResult {
  success: false;
  error: ErrorDetails;
}

export type OpenGuardResult<T> = Result<T> | ErrorResult;

/**
 * Create a successful result
 */
export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

/**
 * Create an error result
 */
export function error(
  type: ErrorType,
  message: string,
  details?: Partial<Omit<ErrorDetails, 'type' | 'message' | 'timestamp'>>
): ErrorResult {
  return {
    success: false,
    error: {
      type,
      message,
      timestamp: Date.now(),
      ...details,
    },
  };
}

/**
 * Check if a result is an error
 */
export function isError<T>(result: OpenGuardResult<T>): result is ErrorResult {
  return result.success === false;
}

/**
 * Check if a result is successful
 */
export function isSuccess<T>(result: OpenGuardResult<T>): result is Result<T> {
  return result.success === true;
}

/**
 * Get data from a result, throwing if it's an error
 */
export function unwrap<T>(result: OpenGuardResult<T>): T {
  if (isError(result)) {
    throw new OpenGuardError(result.error);
  }
  return result.data;
}

/**
 * Custom error class for OpenGuard
 */
export class OpenGuardError extends Error {
  public readonly details: ErrorDetails;

  constructor(details: ErrorDetails) {
    super(details.message);
    this.name = 'OpenGuardError';
    this.details = details;
  }

  toJSON(): ErrorDetails {
    return this.details;
  }
}
