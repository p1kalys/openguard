/**
 * Zod-based schema validator for OpenGuard
 */

import { z } from 'zod';
import { success, error, type OpenGuardResult } from '../errors/result.js';
import type { RequestEventContext } from '../events/helpers.js';

/**
 * Validate arbitrary data against a Zod schema.
 *
 * @returns OpenGuardResult<T>
 *   - success: { data: T }
 *   - failure: { error.type = 'SCHEMA_VALIDATION_ERROR', error.validationIssues = string[] }
 */
export function validateSchema<T>(
  schema: z.ZodType<T>,
  data: unknown,
  eventContext?: RequestEventContext
): OpenGuardResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    if (eventContext) {
      void eventContext.emitValidation('schema', true);
    }
    return success(result.data);
  }

  const issues = result.error.errors.map(
    (e) => `${e.path.join('.') || '(root)'}: ${e.message}`
  );

  if (eventContext) {
    void eventContext.emitValidation('schema', false, { validationIssues: issues }, result.error.message);
  }

  return error('SCHEMA_VALIDATION_ERROR', result.error.message, {
    validationIssues: issues,
  });
}
