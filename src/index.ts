/**
 * OpenGuard - AI Guardrails Library
 * 
 * A minimal library for implementing guardrails around AI interactions
 * to ensure safe and responsible usage.
 */

// Core modules
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

export * from './errors.js';

// Constants
export * from './constants/index.js';

// Core functionality
export * from './core/index.js';

// Providers
export * from './providers/index.js';

// Middleware
export * from './middleware/index.js';

// Pipeline (future)
export * from './pipeline/index.js';

// Utilities
export * from './utils/index.js';

// Testing
export * from './testing/index.js';

// Reliability Scoring
export * from './reliability/index.js';

// Self-Verification
export * from './verification/index.js';

// Semantic Validation
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

// Grounding Validation
export * from './grounding/index.js';

// Hallucination Detection
export * from './hallucination/index.js';

// Confidence Aggregation
export * from './confidence/index.js';
