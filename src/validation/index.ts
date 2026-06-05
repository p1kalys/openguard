/**
 * OpenGuard Unified Validation
 *
 * Sub-path entry point for all validation features.
 * Import via: import { ... } from 'openguard/validation'
 *
 * Covers:
 *  - Semantic validation  (structural/consistency checks)
 *  - Grounding validation (fact-checking against source documents)
 *  - Hallucination detection
 */

// --- Semantic Validation ---
// Named exports with aliases to avoid collisions with generic type names
export {
  ValidationSeverity as SemanticValidationSeverity,
  ValidationIssueType,
  ValidationIssue as SemanticValidationIssue,
  ValidationResult as SemanticValidationResult,
  SemanticValidationResponse,
  SemanticValidationRule,
  ValidationContext as SemanticValidationContext,
  SemanticValidationConfig,
  FieldValidationConfig,
  FieldDependency,
  DEFAULT_SEMANTIC_CONFIG,
  SemanticRulesEngine,
  BuiltinValidators,
  CustomRuleBuilder,
  RuleTemplates,
  ExampleCustomRules,
  SemanticValidationOrchestrator,
  quickSemanticValidate,
  validateData as validateSemanticData,
  createSemanticValidator,
} from '../semantic/index.js';

// --- Grounding Validation ---
export * from '../grounding/index.js';

// --- Hallucination Detection ---
export * from '../hallucination/index.js';
