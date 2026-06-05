/**
 * OpenGuard Plugin SDK — type definitions
 *
 * A plugin is a plain object that satisfies `OpenGuardPlugin`.
 * No class required, no lifecycle methods, no DI.
 *
 * Hooks split into two categories:
 *
 *   Transform hooks  (beforeRequest, afterResponse, beforeCompletion)
 *     Return a new value to replace the current one, or return `void` to
 *     leave it unchanged.  Plugins run sequentially so each plugin's
 *     output becomes the next plugin's input.
 *
 *   Observer hooks   (beforeValidation, afterValidation, beforeRetry, afterRetry)
 *     Return value is ignored.  Useful for logging, metrics, and alerting.
 *     Plugins also run sequentially to preserve deterministic ordering.
 *
 * All hooks are optional and can be async.
 * A hook that throws does not abort the pipeline — errors are forwarded to
 * `PluginRegistry.onError` (if set) or silently ignored.
 */

import type { GenerateRequest, GenerateResponse } from '../providers/base.js';

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** A value or a Promise of that value. */
export type MaybePromise<T> = T | Promise<T>;

// ---------------------------------------------------------------------------
// Plugin metadata
// ---------------------------------------------------------------------------

/** Required metadata every plugin must declare. */
export interface PluginMeta {
  /** Unique plugin identifier (used as the registry key). */
  name: string;
  /** Semver version string, e.g. `"1.0.0"`. */
  version: string;
  /** Plugin author name or contact. */
  author?: string;
  /** Human-readable description of what the plugin does. */
  description?: string;
}

// ---------------------------------------------------------------------------
// Hook context types
// ---------------------------------------------------------------------------

/**
 * Context passed to `beforeRequest`.
 * The `request` field is what will be sent to the provider after all
 * `beforeRequest` hooks run.  Return a modified copy to change it.
 */
export interface BeforeRequestContext {
  /** Unique identifier for this request lifecycle. */
  requestId: string;
  /** The request about to be sent. */
  request: GenerateRequest;
  /** Provider name (e.g. `"openai"`). */
  provider: string;
  /** 0-based attempt index (0 = first attempt, 1 = first retry, …). */
  attempt: number;
}

/**
 * Context passed to `afterResponse`.
 * Return a modified `GenerateResponse` to replace the raw provider response
 * before it reaches validation or the next stage.
 */
export interface AfterResponseContext {
  requestId: string;
  /** The original request (read-only; transform via `beforeRequest`). */
  readonly request: GenerateRequest;
  /** The response just received from the provider. */
  response: GenerateResponse;
  provider: string;
  attempt: number;
  /** Wall-clock ms elapsed since the start of this attempt. */
  durationMs: number;
}

/**
 * Context passed to `beforeValidation`.
 * Observer only — return value is ignored.
 */
export interface BeforeValidationContext {
  requestId: string;
  /** Response that is about to be validated. */
  readonly response: GenerateResponse;
  /** Validator identifier (e.g. `"schema"`, `"semantic"`, `"grounding"`). */
  validationType: string;
  provider: string;
}

/**
 * Context passed to `afterValidation`.
 * Observer only — return value is ignored.
 */
export interface AfterValidationContext {
  requestId: string;
  readonly response: GenerateResponse;
  validationType: string;
  /** Whether the validator passed. */
  passed: boolean;
  /** Failure message when `passed === false`. */
  error?: string;
  provider: string;
}

/**
 * Context passed to `beforeRetry`.
 * Observer only — the retry decision has already been made.
 */
export interface BeforeRetryContext {
  requestId: string;
  /** 1-based retry number (1 = first retry). */
  attempt: number;
  maxRetries: number;
  /** Human-readable reason for the retry. */
  reason: string;
  /** Milliseconds the engine will wait before the next attempt. */
  delayMs: number;
  /** Error that triggered the retry. */
  error: Error;
  provider: string;
}

/**
 * Context passed to `afterRetry`.
 * Observer only — fires after a retry attempt resolves.
 */
export interface AfterRetryContext {
  requestId: string;
  /** 1-based retry number that just completed. */
  attempt: number;
  maxRetries: number;
  provider: string;
  /** `true` when the retry attempt succeeded. */
  succeeded: boolean;
  /** Present when `succeeded === true`. */
  readonly response?: GenerateResponse;
  /** Present when `succeeded === false`. */
  error?: Error;
}

/**
 * Context passed to `beforeCompletion`.
 * Return a modified `GenerateResponse` to alter the final value returned
 * to the caller (e.g. to add metadata or normalise the content field).
 */
export interface BeforeCompletionContext {
  requestId: string;
  /** The response that will be returned as the final result. */
  response: GenerateResponse;
  provider: string;
  /** Total provider call attempts across all retries. */
  totalAttempts: number;
  /** Wall-clock ms elapsed since `beforeRequest` fired. */
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Plugin interface
// ---------------------------------------------------------------------------

/**
 * A third-party OpenGuard plugin.
 *
 * @example Minimal plugin
 * ```ts
 * import type { OpenGuardPlugin } from 'openguard/plugins';
 *
 * export const myPlugin: OpenGuardPlugin = {
 *   name: 'my-logger',
 *   version: '1.0.0',
 *   author:  'Alice',
 *   description: 'Logs every request and response',
 *
 *   beforeRequest(ctx) {
 *     console.log(`[${ctx.requestId}] → ${ctx.provider}`);
 *   },
 *
 *   afterResponse(ctx) {
 *     console.log(`[${ctx.requestId}] ← ${ctx.durationMs}ms`);
 *   },
 * };
 * ```
 *
 * @example Request transform
 * ```ts
 * export const temperaturePlugin: OpenGuardPlugin = {
 *   name: 'force-temperature',
 *   version: '0.1.0',
 *   beforeRequest(ctx) {
 *     return { ...ctx.request, temperature: 0 }; // enforce deterministic output
 *   },
 * };
 * ```
 */
export interface OpenGuardPlugin extends PluginMeta {
  // ── Transform hooks ─────────────────────────────────────────────────────
  /** Called before the request is sent. Return a modified request to replace it. */
  beforeRequest?(ctx: BeforeRequestContext): MaybePromise<GenerateRequest | void>;

  /** Called after a raw response is received. Return a modified response to replace it. */
  afterResponse?(ctx: AfterResponseContext): MaybePromise<GenerateResponse | void>;

  /** Called just before returning the final result. Return a modified response to replace it. */
  beforeCompletion?(ctx: BeforeCompletionContext): MaybePromise<GenerateResponse | void>;

  // ── Observer hooks ───────────────────────────────────────────────────────
  /** Called before a validation pass runs. */
  beforeValidation?(ctx: BeforeValidationContext): MaybePromise<void>;

  /** Called after a validation pass completes. */
  afterValidation?(ctx: AfterValidationContext): MaybePromise<void>;

  /** Called when a retry has been triggered (before the delay). */
  beforeRetry?(ctx: BeforeRetryContext): MaybePromise<void>;

  /** Called after a retry attempt resolves (success or failure). */
  afterRetry?(ctx: AfterRetryContext): MaybePromise<void>;
}
