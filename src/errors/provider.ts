/**
 * Provider-specific error class
 */

import { OpenGuardError, ErrorCategory, createOpenGuardError } from './base.js';

/**
 * Provider error class
 */
export class ProviderError extends OpenGuardError {
  constructor(
    message: string,
    code: string,
    provider: string,
    model?: string,
    options: {
      requestId?: string;
      details?: Record<string, any>;
    } = {}
  ) {
    super(message, code, ErrorCategory.PROVIDER_ERROR, {
      provider,
      model,
      requestId: options.requestId,
      details: options.details,
    });
  }
}

/**
 * Create provider error
 */
export function createProviderError(
  message: string,
  code: string,
  provider: string,
  model?: string,
  options: {
    requestId?: string;
    details?: Record<string, any>;
  } = {}
): ProviderError {
  return new ProviderError(message, code, provider, model, options);
}
