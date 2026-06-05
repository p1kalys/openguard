/**
 * PluginRegistry — manages registered plugins and executes hook pipelines.
 *
 * Transform hooks run sequentially: each plugin receives the output of the
 * previous plugin, so plugins can build on each other's modifications.
 *
 * Observer hooks also run sequentially (predictable order, easier to debug).
 *
 * Hook errors never propagate to the caller.  Set `registry.onError` to
 * capture them; the default is a `console.error` call.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *
 * ```ts
 * import { pluginRegistry } from 'openguard/plugins';
 *
 * pluginRegistry.register(myPlugin);
 *
 * // In your request pipeline:
 * const request = await pluginRegistry.runBeforeRequest(rawRequest, {
 *   requestId, provider: 'openai', attempt: 0,
 * });
 *
 * const response = await provider.generate(request);
 *
 * const finalResponse = await pluginRegistry.runAfterResponse(response, {
 *   requestId, request, provider: 'openai', attempt: 0, durationMs: 120,
 * });
 * ```
 */

import type { GenerateRequest, GenerateResponse } from '../providers/base.js';
import type {
  OpenGuardPlugin,
  BeforeRequestContext,
  AfterResponseContext,
  BeforeValidationContext,
  AfterValidationContext,
  BeforeRetryContext,
  AfterRetryContext,
  BeforeCompletionContext,
} from './types.js';

// ---------------------------------------------------------------------------
// PluginRegistry
// ---------------------------------------------------------------------------

export class PluginRegistry {
  private readonly _plugins = new Map<string, OpenGuardPlugin>();

  /**
   * Called whenever a plugin hook throws.
   * Defaults to `console.error`; replace to route errors to your logger.
   *
   * @example
   * ```ts
   * pluginRegistry.onError = (plugin, hook, err) =>
   *   logger.warn({ plugin: plugin.name, hook }, err);
   * ```
   */
  onError: (plugin: OpenGuardPlugin, hook: string, error: unknown) => void = (
    plugin,
    hook,
    error
  ) => {
    console.error(`[PluginRegistry] ${plugin.name}@${plugin.version} – ${hook} threw:`, error);
  };

  // ── Registration ──────────────────────────────────────────────────────────

  /**
   * Register a plugin.
   * Re-registering the same `name` replaces the previous version.
   */
  register(plugin: OpenGuardPlugin): this {
    this._plugins.set(plugin.name, { ...plugin });
    return this;
  }

  /**
   * Remove a plugin by name.
   * Returns `true` when removed, `false` when not found.
   */
  unregister(name: string): boolean {
    return this._plugins.delete(name);
  }

  /** Retrieve a registered plugin by name. */
  get(name: string): OpenGuardPlugin | undefined {
    return this._plugins.get(name);
  }

  /** All registered plugins in registration order. */
  list(): OpenGuardPlugin[] {
    return [...this._plugins.values()];
  }

  /** Number of registered plugins. */
  get size(): number {
    return this._plugins.size;
  }

  /** Remove all registered plugins. */
  clear(): void {
    this._plugins.clear();
  }

  // ── Transform hooks ───────────────────────────────────────────────────────

  /**
   * Run `beforeRequest` across all plugins.
   *
   * @param request The original request.
   * @param meta    Everything except `request` (filled by the caller).
   * @returns The final (possibly modified) request.
   */
  async runBeforeRequest(
    request: GenerateRequest,
    meta: Omit<BeforeRequestContext, 'request'>
  ): Promise<GenerateRequest> {
    let current = request;
    for (const plugin of this._plugins.values()) {
      if (!plugin.beforeRequest) continue;
      try {
        const result = await plugin.beforeRequest({ ...meta, request: current });
        if (result != null) current = result;
      } catch (err) {
        this.onError(plugin, 'beforeRequest', err);
      }
    }
    return current;
  }

  /**
   * Run `afterResponse` across all plugins.
   *
   * @param response The raw provider response.
   * @param meta     Everything except `response`.
   * @returns The final (possibly modified) response.
   */
  async runAfterResponse(
    response: GenerateResponse,
    meta: Omit<AfterResponseContext, 'response'>
  ): Promise<GenerateResponse> {
    let current = response;
    for (const plugin of this._plugins.values()) {
      if (!plugin.afterResponse) continue;
      try {
        const result = await plugin.afterResponse({ ...meta, response: current });
        if (result != null) current = result;
      } catch (err) {
        this.onError(plugin, 'afterResponse', err);
      }
    }
    return current;
  }

  /**
   * Run `beforeCompletion` across all plugins.
   *
   * @param response The response about to be returned as the final result.
   * @param meta     Everything except `response`.
   * @returns The final (possibly modified) response.
   */
  async runBeforeCompletion(
    response: GenerateResponse,
    meta: Omit<BeforeCompletionContext, 'response'>
  ): Promise<GenerateResponse> {
    let current = response;
    for (const plugin of this._plugins.values()) {
      if (!plugin.beforeCompletion) continue;
      try {
        const result = await plugin.beforeCompletion({ ...meta, response: current });
        if (result != null) current = result;
      } catch (err) {
        this.onError(plugin, 'beforeCompletion', err);
      }
    }
    return current;
  }

  // ── Observer hooks ────────────────────────────────────────────────────────

  /** Run `beforeValidation` across all plugins. */
  async runBeforeValidation(ctx: BeforeValidationContext): Promise<void> {
    for (const plugin of this._plugins.values()) {
      if (!plugin.beforeValidation) continue;
      try {
        await plugin.beforeValidation(ctx);
      } catch (err) {
        this.onError(plugin, 'beforeValidation', err);
      }
    }
  }

  /** Run `afterValidation` across all plugins. */
  async runAfterValidation(ctx: AfterValidationContext): Promise<void> {
    for (const plugin of this._plugins.values()) {
      if (!plugin.afterValidation) continue;
      try {
        await plugin.afterValidation(ctx);
      } catch (err) {
        this.onError(plugin, 'afterValidation', err);
      }
    }
  }

  /** Run `beforeRetry` across all plugins. */
  async runBeforeRetry(ctx: BeforeRetryContext): Promise<void> {
    for (const plugin of this._plugins.values()) {
      if (!plugin.beforeRetry) continue;
      try {
        await plugin.beforeRetry(ctx);
      } catch (err) {
        this.onError(plugin, 'beforeRetry', err);
      }
    }
  }

  /** Run `afterRetry` across all plugins. */
  async runAfterRetry(ctx: AfterRetryContext): Promise<void> {
    for (const plugin of this._plugins.values()) {
      if (!plugin.afterRetry) continue;
      try {
        await plugin.afterRetry(ctx);
      } catch (err) {
        this.onError(plugin, 'afterRetry', err);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Global singleton
// ---------------------------------------------------------------------------

/**
 * Application-wide `PluginRegistry`.
 * Construct your own for isolated scopes (e.g. tests, per-tenant pipelines).
 */
export const pluginRegistry = new PluginRegistry();
