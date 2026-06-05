/**
 * OpenGuard Plugin SDK
 *
 * Build third-party plugins as plain objects — no classes, no DI, no lifecycle magic.
 *
 * ── Sub-path import ───────────────────────────────────────────────────────────
 * ```ts
 * import type { OpenGuardPlugin } from 'openguard/plugins';
 * import { pluginRegistry }       from 'openguard/plugins';
 * ```
 *
 * ── Writing a plugin ──────────────────────────────────────────────────────────
 * ```ts
 * import type { OpenGuardPlugin } from 'openguard/plugins';
 *
 * export const rateLimitPlugin: OpenGuardPlugin = {
 *   name:        'rate-limit-guard',
 *   version:     '1.0.0',
 *   author:      'platform-team',
 *   description: 'Enforces per-minute token budgets',
 *
 *   async beforeRequest(ctx) {
 *     await rateLimiter.check(ctx.provider);
 *     // Return nothing to leave the request unchanged.
 *   },
 *
 *   afterResponse(ctx) {
 *     rateLimiter.consume(ctx.response.usage?.totalTokens ?? 0);
 *   },
 * };
 * ```
 *
 * ── Using the registry ────────────────────────────────────────────────────────
 * ```ts
 * import { pluginRegistry } from 'openguard/plugins';
 *
 * pluginRegistry.register(rateLimitPlugin);
 *
 * // Inside your request pipeline:
 * const request  = await pluginRegistry.runBeforeRequest(rawRequest, { requestId, provider, attempt: 0 });
 * const response = await provider.generate(request);
 * const result   = await pluginRegistry.runAfterResponse(response, { requestId, request, provider, attempt: 0, durationMs });
 * ```
 */

// Core types
export type {
  MaybePromise,
  PluginMeta,
  OpenGuardPlugin,
  BeforeRequestContext,
  AfterResponseContext,
  BeforeValidationContext,
  AfterValidationContext,
  BeforeRetryContext,
  AfterRetryContext,
  BeforeCompletionContext,
} from './types.js';

// Registry
export { PluginRegistry, pluginRegistry } from './registry.js';
