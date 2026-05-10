/**
 * Semantic validation system for OpenGuard
 * Validates logical consistency of structured outputs using heuristic-based validation
 */

import { NormalizedResponse } from '../types/normalized.js';

/**
 * Validation severity levels
 */
export type ValidationSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Validation issue types
 */
export type ValidationIssueType = 
  | 'contradiction'
  | 'impossible_value'
  | 'incomplete_relationship'
  | 'logical_inconsistency'
  | 'range_violation'
  | 'dependency_violation'
  | 'format_mismatch'
  | 'semantic_anomaly';

/**
 * Individual validation issue
 */
export interface ValidationIssue {
  /** Issue type */
  type: ValidationIssueType;
  /** Severity level */
  severity: ValidationSeverity;
  /** Issue description */
  message: string;
  /** Field path where issue was found */
  fieldPath: string;
  /** Current value that caused the issue */
  currentValue: any;
  /** Expected value or range (optional) */
  expectedValue?: any;
  /** Related fields (for dependency issues) */
  relatedFields?: string[];
  /** Rule that triggered this issue */
  rule: string;
  /** Confidence in this validation (0-1) */
  confidence: number;
}

/**
 * Validation result for a single validation run
 */
export interface ValidationResult {
  /** Overall validation passed */
  passed: boolean;
  /** Overall validation score (0-1) */
  score: number;
  /** All validation issues found */
  issues: ValidationIssue[];
  /** Validation metadata */
  metadata: {
    /** Validation timestamp */
    timestamp: number;
    /** Processing time in milliseconds */
    processingTime: number;
    /** Rules applied */
    rulesApplied: string[];
    /** Data structure analyzed */
    structure: string;
  };
}

/**
 * Semantic validation rule interface
 */
export interface SemanticValidationRule {
  /** Unique rule identifier */
  name: string;
  /** Rule description */
  description: string;
  /** Rule priority (higher = more important) */
  priority: number;
  /** Issue type this rule produces */
  issueType: ValidationIssueType;
  /** Default severity for issues */
  defaultSeverity: ValidationSeverity;
  /** Rule execution function */
  validate: (data: any, context: ValidationContext) => ValidationIssue[];
  /** Whether rule is enabled by default */
  enabled: boolean;
}

/**
 * Validation context provided to rules
 */
export interface ValidationContext {
  /** Full data object being validated */
  data: any;
  /** Current field path */
  fieldPath: string;
  /** Parent object (if available) */
  parent?: any;
  /** Validation configuration */
  config: SemanticValidationConfig;
  /** Schema information (if available) */
  schema?: any;
}

/**
 * Semantic validation configuration
 */
export interface SemanticValidationConfig {
  /** Enabled validation rules */
  enabledRules: string[];
  /** Custom validation rules */
  customRules: SemanticValidationRule[];
  /** Severity thresholds */
  severityThresholds: {
    /** Minimum score to pass validation */
    minScore: number;
    /** Maximum issues allowed by severity */
    maxIssues: Record<ValidationSeverity, number>;
  };
  /** Validation options */
  options: {
    /** Whether to stop on first critical error */
    stopOnCritical: boolean;
    /** Whether to validate nested objects */
    validateNested: boolean;
    /** Maximum depth for nested validation */
    maxDepth: number;
    /** Whether to collect all issues or stop early */
    collectAllIssues: boolean;
  };
  /** Field-specific configurations */
  fieldConfigs: Record<string, FieldValidationConfig>;
}

/**
 * Field-specific validation configuration
 */
export interface FieldValidationConfig {
  /** Expected data type */
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date';
  /** Valid value range (for numbers) */
  range?: { min?: number; max?: number };
  /** Valid values (enum) */
  allowedValues?: any[];
  /** Required fields */
  required?: boolean;
  /** Field dependencies */
  dependencies?: FieldDependency[];
  /** Custom validation functions */
  customValidators?: ((value: any, context: ValidationContext) => ValidationIssue[])[];
}

/**
 * Field dependency definition
 */
export interface FieldDependency {
  /** Name of dependent field */
  field: string;
  /** Dependency condition */
  condition: (value: any, dependentValue: any) => boolean;
  /** Error message if dependency violated */
  message: string;
}

/**
 * Complete semantic validation response
 */
export interface SemanticValidationResponse {
  /** Original response being validated */
  originalResponse: NormalizedResponse;
  /** Validation result */
  result: ValidationResult;
  /** Validation configuration used */
  config: SemanticValidationConfig;
  /** Summary statistics */
  summary: {
    /** Total issues by severity */
    issuesBySeverity: Record<ValidationSeverity, number>;
    /** Total issues by type */
    issuesByType: Record<ValidationIssueType, number>;
    /** Most common issue type */
    mostCommonIssue: ValidationIssueType | null;
    /** Fields with most issues */
    problematicFields: Array<{ field: string; count: number }>;
  };
}

/**
 * Default semantic validation configuration
 */
export const DEFAULT_SEMANTIC_CONFIG: SemanticValidationConfig = {
  enabledRules: [
    'contradiction_detection',
    'range_validation',
    'dependency_validation',
    'type_consistency',
    'logical_relationships',
  ],
  customRules: [],
  severityThresholds: {
    minScore: 0.7,
    maxIssues: {
      info: 10,
      warning: 5,
      error: 3,
      critical: 0,
    },
  },
  options: {
    stopOnCritical: false,
    validateNested: true,
    maxDepth: 5,
    collectAllIssues: true,
  },
  fieldConfigs: {},
};
