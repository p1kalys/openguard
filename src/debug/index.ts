/**
 * OpenGuard Debugging Snapshot System
 *
 * Captures a full, serializable record of every phase in a request's
 * lifecycle — raw provider response, JSON repair, normalization, validation
 * failures, hallucination reports, and retries — and stores them in a bounded
 * in-memory store with configurable redaction and retention.
 *
 * ── Quick start ─────────────────────────────────────────────────────────────
 *
 * Manual instrumentation (wrap your own pipeline):
 * ```ts
 * import { snapshotStore, fromProviderResponse, fromNormalization } from 'openguard/debug';
 *
 * const col = snapshotStore.collect('req-abc');
 *
 * const raw = await provider.generate(request);
 * col.setProviderResponse(fromProviderResponse(raw, elapsedMs));
 *
 * const norm = normalizer.normalize(raw);
 * col.setNormalization(fromNormalization(col.providerResponse!, norm));
 *
 * const valResult = validateSchema(schema, JSON.parse(norm.content));
 * col.addValidation(fromValidationResult(valResult, 'schema'));
 *
 * const snapshot = col.complete();   // committed to the store
 * console.log(snapshot.status);      // 'success' | 'failure'
 * ```
 *
 * Creating an isolated store (e.g. per test or per tenant):
 * ```ts
 * import { SnapshotStore } from 'openguard/debug';
 *
 * const store = new SnapshotStore({
 *   retention: { maxSnapshots: 50, policy: 'failures-only' },
 *   redaction: { redactPrompts: true, redactRawResponses: true },
 * });
 * ```
 *
 * Exporting all snapshots to JSON:
 * ```ts
 * const json = snapshotStore.export();
 * fs.writeFileSync('debug-dump.json', json);
 * ```
 */

// Re-export everything from the three implementation modules
export * from './types.js';
export {
  generateSnapshotId,
  SnapshotStore,
  SnapshotCollector,
  snapshotStore,
} from './snapshot.js';
export { resolveRedactionConfig, redactSnapshot } from './redactor.js';

// ---------------------------------------------------------------------------
// Adapter helpers — convert live OpenGuard types → Captured* phase objects
// ---------------------------------------------------------------------------
//
// These functions act as the bridge between the statically-typed OpenGuard
// pipeline objects and the plain-object CapturedXxx types stored in snapshots.
// They are intentionally thin: they copy only the fields that are useful for
// debugging and that survive JSON serialization.

import type { GenerateResponse } from '../providers/base.js';
import type { NormalizedResponse } from '../core/normalization.js';
import type { OpenGuardResult, ErrorResult } from '../errors/result.js';

import type {
  CapturedError,
  CapturedHallucinationCheck,
  CapturedNormalization,
  CapturedProviderResponse,
  CapturedRepair,
  CapturedRetry,
  CapturedValidation,
  SerializableValue,
  ValidationKind,
} from './types.js';

// ── Provider response ─────────────────────────────────────────────────────

/**
 * Convert a raw `GenerateResponse` to a `CapturedProviderResponse`.
 *
 * @param response   The provider response to capture.
 * @param durationMs Optional wall-clock time for the provider call in ms.
 */
export function fromProviderResponse(
  response: GenerateResponse,
  durationMs?: number,
): CapturedProviderResponse {
  return {
    id: response.id,
    content: response.content,
    model: response.model,
    finishReason: response.finishReason ?? null,
    usage: response.usage
      ? {
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens,
        }
      : undefined,
    // Serialise `raw` only when it can be represented as a SerializableValue.
    // Non-serializable objects are silently dropped to keep snapshots clean.
    raw: trySerialize(response.raw),
    durationMs,
    capturedAt: Date.now(),
  };
}

// ── Normalization ─────────────────────────────────────────────────────────

/**
 * Build a `CapturedNormalization` from the input (raw) and output (normalized)
 * sides of a normalization step.
 *
 * @param input  The `CapturedProviderResponse` already captured for this request.
 * @param output The `NormalizedResponse` produced by the normalizer.
 */
export function fromNormalization(
  input: CapturedProviderResponse,
  output: NormalizedResponse,
): CapturedNormalization {
  return {
    input,
    output: {
      id: output.id,
      content: output.content,
      model: output.model,
      provider: output.provider,
      finishReason: output.finishReason ?? null,
      usage: output.usage
        ? {
            promptTokens: output.usage.promptTokens,
            completionTokens: output.usage.completionTokens,
            totalTokens: output.usage.totalTokens,
            estimatedCost: output.usage.estimatedCost,
          }
        : undefined,
      timestamp: output.timestamp,
      processingTime: output.processingTime,
      metadata: output.metadata
        ? (trySerialize(output.metadata) as Record<string, SerializableValue> | undefined)
        : undefined,
    },
    capturedAt: Date.now(),
  };
}

// ── OpenGuardResult → validation capture ─────────────────────────────────

/**
 * Convert an `OpenGuardResult` from schema / semantic / grounding validation
 * into a `CapturedValidation`.
 *
 * Works with any `OpenGuardResult<unknown>`:
 * - `success: true`  → `passed: true`, no issues
 * - `success: false` → `passed: false`, issues derived from `error.validationIssues`
 *
 * @param result The result returned by `validateSchema()`, semantic validator, etc.
 * @param kind   Which subsystem produced this result.
 * @param durationMs Optional duration of the validation call.
 */
export function fromValidationResult(
  result: OpenGuardResult<unknown>,
  kind: ValidationKind,
  durationMs?: number,
): CapturedValidation {
  if (result.success) {
    return {
      kind,
      passed: true,
      issues: [],
      durationMs,
      capturedAt: Date.now(),
    };
  }

  const err = (result as ErrorResult).error;
  const issues = (err.validationIssues ?? []).map((msg) => ({
    type: err.type,
    message: msg,
    severity: 'error' as const,
  }));

  return {
    kind,
    passed: false,
    issues,
    durationMs,
    capturedAt: Date.now(),
  };
}

// ── Hallucination check ───────────────────────────────────────────────────

/**
 * Capture the result of a hallucination-detection pass.
 *
 * Accepts the `result` sub-object from `HallucinationDetectionResponse`
 * plus the `summary.riskLevel` field.
 *
 * @example
 * ```ts
 * const detection = await detector.detect(normalizedResponse);
 * col.addHallucinationCheck(fromHallucinationCheck(detection.result, detection.summary.riskLevel));
 * ```
 */
export function fromHallucinationCheck(
  result: {
    hallucinationScore: number;
    isHallucinated: boolean;
    issues: Array<{
      type: string;
      severity: string;
      description: string;
      problematicText?: string;
      confidence: number;
    }>;
  },
  riskLevel: string,
  durationMs?: number,
): CapturedHallucinationCheck {
  return {
    hallucinationScore: result.hallucinationScore,
    isHallucinated: result.isHallucinated,
    riskLevel,
    issues: result.issues.map((i) => ({
      type: i.type,
      severity: i.severity,
      description: i.description,
      problematicText: i.problematicText,
      confidence: i.confidence,
    })),
    durationMs,
    capturedAt: Date.now(),
  };
}

// ── JSON repair ───────────────────────────────────────────────────────────

/**
 * Capture the outcome of a JSON repair pass.
 *
 * @param result The `OpenGuardResult<string>` returned by `repairJson()`.
 * @param originalInput The raw string that was fed into the repair function.
 */
export function fromRepairResult(
  result: OpenGuardResult<string>,
  originalInput: string,
): CapturedRepair {
  if (result.success) {
    return {
      originalInput,
      repairedOutput: result.data,
      success: true,
      capturedAt: Date.now(),
    };
  }
  return {
    originalInput,
    success: false,
    errorMessage: (result as ErrorResult).error.message,
    capturedAt: Date.now(),
  };
}

// ── Retry ─────────────────────────────────────────────────────────────────

/**
 * Build a `CapturedRetry` from the arguments passed to a `RetryOptions.onRetry`
 * callback.
 *
 * ```ts
 * onRetry: (err, attempt, delayMs) => {
 *   col.addRetry(fromRetryAttempt(err, attempt, delayMs, 'exponential'));
 * }
 * ```
 */
export function fromRetryAttempt(
  error: unknown,
  attempt: number,
  delayMs: number,
  strategy: string,
): CapturedRetry {
  return {
    attempt,
    errorMessage: error instanceof Error ? error.message : String(error),
    delayMs,
    strategy,
    capturedAt: Date.now(),
  };
}

// ── Error ─────────────────────────────────────────────────────────────────

/**
 * Capture a terminal error from an `ErrorResult` (e.g. `RETRY_EXHAUSTED_ERROR`).
 */
export function fromErrorResult(result: ErrorResult): CapturedError {
  const err = result.error;
  return {
    type: err.type,
    message: err.message,
    details: {
      ...(err.retries          !== undefined && { retries:          err.retries }),
      ...(err.originalResponse !== undefined && { originalResponse: err.originalResponse }),
      ...(err.repairedResponse !== undefined && { repairedResponse: err.repairedResponse }),
      ...(err.provider         !== undefined && { provider:         err.provider }),
      timestamp: err.timestamp,
    } as Record<string, SerializableValue>,
    capturedAt: Date.now(),
  };
}

/**
 * Capture a terminal error from a plain `Error` or unknown thrown value.
 *
 * @param type  An error type label (e.g. `'PROVIDER_ERROR'`). Default: `'UNKNOWN_ERROR'`.
 */
export function fromThrownError(
  error: unknown,
  type = 'UNKNOWN_ERROR',
  includeStack = false,
): CapturedError {
  const isErr = error instanceof Error;
  return {
    type,
    message: isErr ? error.message : String(error),
    ...(includeStack && isErr && error.stack ? { stack: error.stack } : {}),
    capturedAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Internal utility
// ---------------------------------------------------------------------------

/** Attempt to coerce an unknown value to `SerializableValue`. Returns undefined on failure. */
function trySerialize(value: unknown): SerializableValue | undefined {
  if (value === undefined) return undefined;
  try {
    // Round-trip through JSON to strip non-serializable parts (functions, class instances, etc.)
    return JSON.parse(JSON.stringify(value)) as SerializableValue;
  } catch {
    return undefined;
  }
}
