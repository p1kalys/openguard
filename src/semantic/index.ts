/**
 * Main semantic validation module exports for OpenGuard
 */

// Re-export types and interfaces
export {
  ValidationSeverity,
  ValidationIssueType,
  ValidationIssue,
  ValidationResult,
  SemanticValidationResponse,
  SemanticValidationRule,
  ValidationContext,
  SemanticValidationConfig,
  FieldValidationConfig,
  FieldDependency,
  DEFAULT_SEMANTIC_CONFIG,
} from './types.js';

// Re-export rules engine
export { SemanticRulesEngine } from './rules-engine.js';

// Re-export validators
export { BuiltinValidators } from './validators.js';

// Re-export custom rules
export { CustomRuleBuilder, RuleTemplates, ExampleCustomRules } from './custom-rules.js';

// Re-export orchestrator
export { SemanticValidationOrchestrator } from './orchestrator.js';

// Convenience functions for quick validation
import { SemanticValidationOrchestrator } from './orchestrator.js';
import { SemanticValidationConfig, DEFAULT_SEMANTIC_CONFIG } from './types.js';
import { NormalizedResponse } from '../types/normalized.js';

/**
 * Quick semantic validation with default configuration
 */
export async function quickSemanticValidate(
  response: NormalizedResponse,
  config?: Partial<SemanticValidationConfig>
) {
  const orchestrator = new SemanticValidationOrchestrator(config);
  return orchestrator.validateResponse(response);
}

/**
 * Validate raw data directly
 */
export function validateData(
  data: any,
  config?: Partial<SemanticValidationConfig>
) {
  const orchestrator = new SemanticValidationOrchestrator(config);
  return orchestrator.validateData(data);
}

/**
 * Create semantic validation orchestrator with custom configuration
 */
export function createSemanticValidator(
  config?: Partial<SemanticValidationConfig>
): SemanticValidationOrchestrator {
  return new SemanticValidationOrchestrator(config);
}
