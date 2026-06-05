/**
 * OpenGuard - Universal Reliability Layer for LLM Applications
 *
 * Full public API surface. For tree-shakable sub-path imports use:
 *   import { ... } from 'openguard/providers'
 *   import { ... } from 'openguard/validation'
 *   import { ... } from 'openguard/events'
 *   import { ... } from 'openguard/metrics'
 *   import { ... } from 'openguard/middleware'
 *   import { ... } from 'openguard/reliability'
 *   import { ... } from 'openguard/verification'
 *   import { ... } from 'openguard/testing'
 *   import { ... } from 'openguard/utils'
 *   import { ... } from 'openguard/core'
 */

// --- Types ---
export type {
    MessageRole,
    FinishReason,
    BaseMessage,
    SystemMessage,
    UserMessage,
    AssistantMessage,
    ToolMessage,
    Message,
    ChatCompletionRequest,
    ChatCompletionRequestParams,
    ChatCompletionResponse,
    ChatCompletionChoice,
    ChatCompletionUsage,
    ChatCompletionError,
    PartialBy,
    DeepPartial,
} from './types/types.js';

export type {
    NormalizedResponse,
    NormalizedRequest,
    NormalizedUsage,
} from './types/normalized.js';

// --- Errors (Result<T> functional system) ---
// The full class-based hierarchy (ValidationError, ProviderError, etc.)
// is available via the 'openguard/errors' sub-path import.
export * from './errors/result.js';

// --- Constants ---
export * from './constants/index.js';

// --- Core (middleware, normalization, orchestration) ---
export * from './core/index.js';

// --- Providers ---
export * from './providers/index.js';

// --- Middleware ---
// Explicit exports to avoid conflicts with the new retry/validators modules
// (retry and validateSchema are superseded by the Result<T>-based versions below)
export type { ValidationResult, SchemaValidator } from './middleware/validation.js';
export { JSONSchemaValidator, LengthValidator, KeywordValidator } from './middleware/validation.js';
export type { RetryConfig, RetryResult } from './middleware/retry.js';
export { RetryUtil } from './middleware/retry.js';
export * from './middleware/repair.js';
export * from './middleware/guardrails.js';

// --- Pipeline ---
export * from './pipeline/index.js';

// --- Utilities ---
export * from './utils/index.js';

// --- Testing ---
export * from './testing/index.js';

// --- Reliability Scoring ---
export * from './reliability/index.js';

// --- Self-Verification ---
export * from './verification/index.js';

// --- Validation: Semantic ---
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
} from './semantic/index.js';

// --- Validation: Grounding ---
export * from './grounding/index.js';

// --- Validation: Hallucination Detection ---
export * from './hallucination/index.js';

// --- Confidence Aggregation ---
export * from './confidence/index.js';

// --- Event System ---
export * from './events/index.js';

// --- Metrics ---
export * from './metrics/index.js';

// --- Request Tracing ---
export * from './tracing/index.js';

// --- Debugging Snapshots ---
export * from './debug/index.js';

// --- Storage Abstraction ---
export * from './storage/index.js';

// --- Plugin SDK ---
export * from './plugins/index.js';

// --- Observability Query API ---
export * from './query/index.js';

// --- Team Monitoring ---
export * from './monitoring/index.js';

// --- JSON Repair ---
export * from './repair/json-repair.js';

// --- Retry Strategies ---
export * from './retry/retry-strategy.js';

// --- Schema Validation ---
export * from './validators/schema-validator.js';
