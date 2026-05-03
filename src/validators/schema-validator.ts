/**
 * Schema validation utilities using Zod
 */

import { z } from 'zod';
import { error, OpenGuardResult } from '../errors.js';

/**
 * Validate data against a Zod schema
 *
 * @param schema - The Zod schema to validate against
 * @param data - The data to validate
 * @returns Validation result with typed data or error details
 */
export function validateSchema<T>(
  schema: z.ZodType<T>,
  data: unknown
): OpenGuardResult<T> {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (err) {
    if (err instanceof z.ZodError) {
      const validationIssues = err.errors.map(
        (e) => `${e.path.join('.')}: ${e.message}`
      );
      return error(
        'SCHEMA_VALIDATION_ERROR',
        'Schema validation failed',
        { validationIssues }
      );
    }
    return error(
      'UNKNOWN_ERROR',
      err instanceof Error ? err.message : 'Unknown validation error'
    );
  }
}
