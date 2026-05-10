/**
 * Parsing error class
 */

import { OpenGuardError, ErrorCategory, createOpenGuardError } from './base.js';

/**
 * Parsing error class
 */
export class ParsingError extends OpenGuardError {
  public readonly position?: number;
  public readonly line?: number;
  public readonly character?: string;

  constructor(
    message: string,
    code: string,
    position?: number,
    line?: number,
    character?: string,
    options: {
      requestId?: string;
      details?: Record<string, any>;
    } = {}
  ) {
    super(message, code, ErrorCategory.PARSING, {
      requestId: options.requestId,
      details: {
        position,
        line,
        character,
        ...options.details,
      },
    });
    
    this.position = position;
    this.line = line;
    this.character = character;
  }

  /**
   * Get parsing error summary
   */
  getSummary(): string {
    const location = this.position !== undefined 
      ? ` at position ${this.position}`
      : this.line !== undefined 
      ? ` at line ${this.line}`
      : this.character !== undefined 
      ? ` at character '${this.character}'`
      : '';
      
    return `Parsing error${location}: ${this.message}`;
  }
}
