/**
 * Streaming error class
 */

import { OpenGuardError, ErrorCategory, createOpenGuardError } from './base.js';

/**
 * Streaming error class
 */
export class StreamingError extends OpenGuardError {
  public readonly chunk?: string;
  public readonly streamId?: string;

  constructor(
    message: string,
    code: string,
    chunk?: string,
    streamId?: string,
    options: {
      requestId?: string;
      details?: Record<string, any>;
    } = {}
  ) {
    super(message, code, ErrorCategory.NETWORK, {
      requestId: options.requestId,
      details: {
        chunk,
        streamId,
        ...options.details,
      },
    });
    
    this.chunk = chunk;
    this.streamId = streamId;
  }

  /**
   * Get streaming error summary
   */
  getSummary(): string {
    const location = this.chunk !== undefined 
      ? ` in chunk '${this.chunk}'`
      : this.streamId !== undefined 
      ? ` in stream '${this.streamId}'`
      : '';
      
    return `Streaming error${location}: ${this.message}`;
  }
}
