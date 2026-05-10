/**
 * Validation utilities for OpenGuard
 */

import type { GenerateResponse } from '../providers/base.js';

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Validation details */
  details?: Record<string, any>;
}

/**
 * Schema validator interface
 */
export interface SchemaValidator {
  /** Validate response against schema */
  validate(response: GenerateResponse): ValidationResult;
}

/**
 * Simple JSON schema validator
 */
export class JSONSchemaValidator implements SchemaValidator {
  constructor(private schema: any) {}

  validate(response: GenerateResponse): ValidationResult {
    try {
      const content = response.content;
      if (!content) {
        return { valid: false, error: 'Empty content' };
      }

      // Try to parse as JSON
      const parsed = JSON.parse(content);
      
      // Basic validation against schema
      if (this.schema && typeof this.schema === 'object') {
        return this.validateAgainstSchema(parsed, this.schema);
      }

      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: `JSON parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  private validateAgainstSchema(data: any, schema: any): ValidationResult {
    // Simple schema validation
    if (schema.type && typeof data !== schema.type) {
      return { 
        valid: false, 
        error: `Expected ${schema.type}, got ${typeof data}` 
      };
    }

    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (!(field in data)) {
          return { 
            valid: false, 
            error: `Missing required field: ${field}` 
          };
        }
      }
    }

    return { valid: true };
  }
}

/**
 * Content length validator
 */
export class LengthValidator implements SchemaValidator {
  constructor(private maxLength: number) {}

  validate(response: GenerateResponse): ValidationResult {
    const content = response.content || '';
    
    if (content.length > this.maxLength) {
      return { 
        valid: false, 
        error: `Content too long: ${content.length} > ${this.maxLength}` 
      };
    }

    return { valid: true };
  }
}

/**
 * Keyword validator
 */
export class KeywordValidator implements SchemaValidator {
  constructor(private keywords: string[]) {}

  validate(response: GenerateResponse): ValidationResult {
    const content = response.content || '';
    
    for (const keyword of this.keywords) {
      if (content.includes(keyword)) {
        return { 
          valid: false, 
          error: `Blocked keyword found: ${keyword}` 
        };
      }
    }

    return { valid: true };
  }
}

/**
 * Utility function to validate schema
 */
export function validateSchema(
  response: GenerateResponse,
  validator: SchemaValidator
): ValidationResult {
  return validator.validate(response);
}
