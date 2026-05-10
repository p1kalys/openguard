/**
 * Validation error class
 */

import { OpenGuardError, ErrorCategory, createOpenGuardError } from './base.js';

/**
 * Validation error class
 */
export class ValidationError extends OpenGuardError {
  constructor(
    message: string,
    code: string,
    field?: string,
    value?: any,
    options: {
      requestId?: string;
      details?: Record<string, any>;
    } = {}
  ) {
    super(message, code, ErrorCategory.VALIDATION, {
      requestId: options.requestId,
      details: {
        field,
        value,
        ...options.details,
      },
    });
  }
}

/**
 * Create validation error
 */
export function createValidationError(
  message: string,
  code: string,
  field?: string,
  value?: any,
  options: {
    requestId?: string;
    details?: Record<string, any>;
  } = {}
): ValidationError {
  return new ValidationError(message, code, field, value, options);
}
