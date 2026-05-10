/**
 * Validation type constants
 */

/**
 * Standard validation types
 */
export const VALIDATION_TYPES = {
  JSON_SCHEMA: 'json_schema',
  CONTENT_LENGTH: 'content_length',
  KEYWORD_FILTER: 'keyword_filter',
  PATTERN_MATCH: 'pattern_match',
  EMAIL_FORMAT: 'email_format',
  URL_FORMAT: 'url_format',
  REQUIRED_FIELDS: 'required_fields',
  CUSTOM: 'custom',
} as const;

/**
 * Validation type
 */
export type ValidationType = typeof VALIDATION_TYPES[keyof typeof VALIDATION_TYPES];

/**
 * Validation severity levels
 */
export const VALIDATION_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

/**
 * Validation severity type
 */
export type ValidationSeverity = typeof VALIDATION_SEVERITY[keyof typeof VALIDATION_SEVERITY];

/**
 * Common validation error messages
 */
export const VALIDATION_ERRORS = {
  EMPTY_CONTENT: 'Content cannot be empty',
  INVALID_JSON: 'Invalid JSON format',
  CONTENT_TOO_LONG: 'Content exceeds maximum length',
  CONTENT_TOO_SHORT: 'Content below minimum length',
  BLOCKED_KEYWORD: 'Contains blocked keyword',
  INVALID_EMAIL: 'Invalid email format',
  INVALID_URL: 'Invalid URL format',
  MISSING_FIELD: 'Missing required field',
  VALIDATION_FAILED: 'Validation failed',
} as const;

/**
 * Validation error type
 */
export type ValidationError = typeof VALIDATION_ERRORS[keyof typeof VALIDATION_ERRORS];

/**
 * Default validation limits
 */
export const VALIDATION_LIMITS = {
  MIN_CONTENT_LENGTH: 1,
  MAX_CONTENT_LENGTH: 10000,
  MAX_TITLE_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 1000,
} as const;
