/**
 * Debugging snapshot types for OpenGuard
 *
 * All types in this module are plain-object serializable (JSON round-trip safe).
 * No Date objects, Error instances, or functions appear in any interface.
 */

// ---------------------------------------------------------------------------
// Primitive serializable value
// ---------------------------------------------------------------------------

/**
 * A value that survives a JSON round-trip without loss.
 * Used throughout snapshot payloads to ensure every snapshot can be stored,
 * transmitted, or logged without transformation.
 */
export type SerializableValue =
  | string
  | number
  | boolean
  | null
  | SerializableValue[]
  | { [key: string]: SerializableValue };

// ---------------------------------------------------------------------------
// Captured phase types
// ---------------------------------------------------------------------------

/** The outgoing request as seen before it reaches any provider. */
export interface CapturedRequest {
  /** Raw prompt — a string or structured message list. */
  prompt: string | Array<{ role: string; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Any provider-specific options (already serialized). */
  options?: Record<string, SerializableValue>;
  /** Unix ms when this phase was captured. */
  capturedAt: number;
}

/** The raw response received directly from the provider. */
export interface CapturedProviderResponse {
  id: string;
  content: string;
  model: string;
  finishReason?: string | null;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /**
   * The provider's raw payload.
   * May be omitted when `RedactionConfig.redactRawResponses` is true.
   */
  raw?: SerializableValue;
  /** How long the provider call took in ms. */
  durationMs?: number;
  capturedAt: number;
}

/** Result of a JSON repair pass. */
export interface CapturedRepair {
  /** The string fed into the repair pipeline. */
  originalInput: string;
  /** The repaired string — absent when `success` is false. */
  repairedOutput?: string;
  success: boolean;
  errorMessage?: string;
  capturedAt: number;
}

/** Result of normalising a raw provider response. */
export interface CapturedNormalization {
  /** The raw response that was normalized. */
  input: CapturedProviderResponse;
  output: {
    id: string;
    content: string;
    model: string;
    provider: string;
    finishReason: string | null;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      estimatedCost?: number;
    };
    /** Unix ms timestamp on the normalized response. */
    timestamp: number;
    processingTime?: number;
    metadata?: Record<string, SerializableValue>;
  };
  capturedAt: number;
}

/** Which validation subsystem produced this result. */
export type ValidationKind = 'schema' | 'semantic' | 'grounding' | 'custom';

/** A single issue surfaced by a validation pass. */
export interface CapturedValidationIssue {
  /** Validation-subsystem-specific issue type string. */
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  /** Dot-notation field path, if applicable. */
  path?: string;
}

/** Result of one validation pass. */
export interface CapturedValidation {
  kind: ValidationKind;
  passed: boolean;
  /** 0–1 score where available (e.g. semantic validation). */
  score?: number;
  issues: CapturedValidationIssue[];
  durationMs?: number;
  capturedAt: number;
}

/** A single issue found during hallucination detection. */
export interface CapturedHallucinationIssue {
  /** Hallucination type string (e.g. 'unsupported_claim'). */
  type: string;
  severity: string;
  description: string;
  /** The verbatim text flagged as potentially hallucinated. */
  problematicText?: string;
  /** Model confidence that this is a genuine hallucination, 0–1. */
  confidence: number;
}

/** Result of one hallucination-detection pass. */
export interface CapturedHallucinationCheck {
  /** Composite hallucination risk score, 0–1. */
  hallucinationScore: number;
  isHallucinated: boolean;
  /** Human-readable risk band ('low' | 'medium' | 'high' | 'critical'). */
  riskLevel: string;
  issues: CapturedHallucinationIssue[];
  durationMs?: number;
  capturedAt: number;
}

/** One retry attempt. */
export interface CapturedRetry {
  /** 1-based retry attempt number. */
  attempt: number;
  errorMessage: string;
  /** Delay waited before this attempt, in ms. */
  delayMs: number;
  /** Backoff strategy that produced the delay (e.g. 'exponential'). */
  strategy: string;
  capturedAt: number;
}

/** Terminal error that caused the request to fail. */
export interface CapturedError {
  /** ErrorType string or plain error class name. */
  type: string;
  message: string;
  /** Stack trace — may be omitted in production builds. */
  stack?: string;
  /** Any structured extra detail from ErrorDetails or similar. */
  details?: Record<string, SerializableValue>;
  capturedAt: number;
}

// ---------------------------------------------------------------------------
// Core snapshot
// ---------------------------------------------------------------------------

export type SnapshotStatus = 'success' | 'failure' | 'partial';

/**
 * A complete, serializable record of one request's lifecycle through
 * OpenGuard's pipeline.
 */
export interface DebugSnapshot {
  /** Unique snapshot identifier (`snap_<time>_<random>`). */
  id: string;
  /** Correlates this snapshot with external request/trace IDs. */
  requestId: string;
  /** Unix ms when collection began (i.e. when the collector was created). */
  capturedAt: number;
  /** Total wall-clock duration from collection start to `complete()`, in ms. */
  durationMs?: number;
  status: SnapshotStatus;

  /** Provider name set via `collector.setProvider()`. */
  provider?: string;
  /** Model name set via `collector.setModel()`. */
  model?: string;

  /** Outgoing request (may be redacted per `RedactionConfig.redactPrompts`). */
  request?: CapturedRequest;
  /** Raw provider response. */
  providerResponse?: CapturedProviderResponse;
  /** JSON repair outcome, if a repair pass was run. */
  repair?: CapturedRepair;
  /** Normalization outcome, if normalization was run. */
  normalization?: CapturedNormalization;
  /** All validation passes that were run (zero or more). */
  validations: CapturedValidation[];
  /** All hallucination-detection passes that were run (zero or more). */
  hallucinationChecks: CapturedHallucinationCheck[];
  /** Individual retry attempts (zero or more). */
  retries: CapturedRetry[];
  /** Terminal error, present when `status === 'failure'`. */
  error?: CapturedError;

  /** Arbitrary string labels for querying / filtering. */
  tags?: string[];
  /** Custom key-value pairs for application-specific metadata. */
  attributes?: Record<string, SerializableValue>;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Controls how sensitive data is removed from snapshots before storage.
 *
 * Redaction runs at `add()` time — the in-flight collector is never mutated.
 */
export interface RedactionConfig {
  /**
   * Master switch. When false all other options are ignored and no
   * redaction is applied. Default: **true**.
   */
  enabled?: boolean;

  /**
   * Additional field names (case-insensitive; hyphens/spaces normalised to
   * underscores) whose values are replaced with `replacement`.
   *
   * The built-in list already covers: `apiKey`, `api_key`, `authorization`,
   * `password`, `token`, `secret`, `credential`, `auth`, `bearer`,
   * `privateKey`, `x-api-key`, `x-auth-token`.
   */
  fields?: string[];

  /**
   * Extra regex patterns matched against **string** values inside the
   * snapshot.  Matches are replaced with `replacement`.
   *
   * Built-in patterns cover: OpenAI `sk-…` keys, `Bearer …` tokens,
   * GitHub `ghp_…` PATs, and Google `AIza…` API keys.
   */
  patterns?: RegExp[];

  /**
   * Text substituted for every redacted value. Default: `'[REDACTED]'`.
   */
  replacement?: string;

  /**
   * Replace the entire `request.prompt` content with `replacement`.
   * Useful when prompts may contain PII. Default: **false**.
   */
  redactPrompts?: boolean;

  /**
   * Remove `providerResponse.raw` entirely before storage.
   * Raw payloads often mirror the prompt and can be large. Default: **false**.
   */
  redactRawResponses?: boolean;

  /**
   * Hook called for every scalar value in the snapshot tree.
   * Return the value unchanged to skip redaction, or return a replacement.
   * Runs **after** the field-name and pattern checks.
   */
  customRedactor?: (key: string, value: SerializableValue) => SerializableValue;
}

export type RetentionPolicy = 'all' | 'failures-only' | 'sampled';

/**
 * Controls how many snapshots the store keeps and for how long.
 */
export interface RetentionConfig {
  /**
   * Maximum number of snapshots held in memory.
   * When the limit is reached the **oldest** snapshot is evicted.
   * Default: **100**.
   */
  maxSnapshots?: number;

  /**
   * Discard snapshots older than this many milliseconds.
   * Checked lazily on every `add()` and `getAll()` call.
   * Omit (or set to 0) to never expire by age.
   */
  maxAgeMs?: number;

  /**
   * Coarse filter applied before a snapshot is stored:
   * - `'all'` — store every snapshot (default).
   * - `'failures-only'` — only store snapshots where `status === 'failure'`.
   * - `'sampled'` — store a random fraction controlled by `sampleRate`.
   */
  policy?: RetentionPolicy;

  /**
   * Fraction of snapshots to keep when `policy === 'sampled'`. 0–1.
   * Default: **0.1** (10 %).
   */
  sampleRate?: number;
}

/** Top-level configuration for `SnapshotStore`. */
export interface SnapshotStoreConfig {
  retention?: RetentionConfig;
  redaction?: RedactionConfig;
}
