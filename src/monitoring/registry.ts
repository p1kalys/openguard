/**
 * AppRegistry — register applications and record per-app metrics.
 *
 * Each registered application gets its own `MetricsCollector` instance so
 * metrics are scoped by application without polluting the global collector.
 */

import { MetricsCollector } from '../metrics/collector.js';
import type { AppContext, MonitoringFilter } from './types.js';

// ---------------------------------------------------------------------------
// AppRegistry
// ---------------------------------------------------------------------------

/**
 * Central registry for application contexts and their associated metric stores.
 *
 * ```ts
 * const registry = new AppRegistry();
 *
 * registry.register({
 *   appId: 'chat-api',
 *   appName: 'Chat API',
 *   team: 'platform',
 *   project: 'llm-gateway',
 *   environment: 'production',
 * });
 *
 * const col = registry.getCollector('chat-api');
 * col.recordLatency({ provider: 'openai', model: 'gpt-4o' }, 240, 'total');
 * ```
 */
export class AppRegistry {
  private readonly _contexts  = new Map<string, AppContext>();
  private readonly _collectors = new Map<string, MetricsCollector>();

  /** Maximum metrics kept per application collector (default: 10 000). */
  private readonly _maxMetricsPerApp: number;

  constructor(maxMetricsPerApp = 10_000) {
    this._maxMetricsPerApp = maxMetricsPerApp;
  }

  // ── Registration ──────────────────────────────────────────────────────────

  /**
   * Register an application.  Re-registering the same `appId` updates the
   * context but **preserves** the existing metric collector so no data is lost.
   */
  register(context: AppContext): void {
    this._contexts.set(context.appId, { ...context });
    if (!this._collectors.has(context.appId)) {
      this._collectors.set(context.appId, new MetricsCollector(this._maxMetricsPerApp));
    }
  }

  /**
   * Remove an application and discard its metrics.
   * Returns `true` if the app was registered, `false` otherwise.
   */
  unregister(appId: string): boolean {
    const existed = this._contexts.has(appId);
    this._contexts.delete(appId);
    this._collectors.delete(appId);
    return existed;
  }

  // ── Lookup ────────────────────────────────────────────────────────────────

  /** Returns the context for a registered app, or `undefined`. */
  getApp(appId: string): AppContext | undefined {
    const ctx = this._contexts.get(appId);
    return ctx ? { ...ctx } : undefined;
  }

  /**
   * Returns all registered app contexts matching the optional filter.
   * Result order follows registration order.
   */
  getApps(filter?: MonitoringFilter): AppContext[] {
    let apps = [...this._contexts.values()];

    if (filter?.team)        apps = apps.filter((a) => a.team        === filter.team);
    if (filter?.project)     apps = apps.filter((a) => a.project     === filter.project);
    if (filter?.environment) apps = apps.filter((a) => a.environment === filter.environment);
    if (filter?.appId)       apps = apps.filter((a) => a.appId       === filter.appId);

    return apps.map((a) => ({ ...a }));
  }

  /** Returns the number of registered applications. */
  get size(): number {
    return this._contexts.size;
  }

  // ── Metric collectors ─────────────────────────────────────────────────────

  /**
   * Returns the `MetricsCollector` for the given app.
   * Throws if the app has not been registered.
   */
  getCollector(appId: string): MetricsCollector {
    const col = this._collectors.get(appId);
    if (!col) {
      throw new Error(`AppRegistry: app "${appId}" is not registered`);
    }
    return col;
  }

  /**
   * Returns all collectors whose apps match the optional filter.
   * Useful for cross-app aggregation.
   */
  getCollectors(filter?: MonitoringFilter): Map<string, MetricsCollector> {
    const apps   = this.getApps(filter);
    const result = new Map<string, MetricsCollector>();
    for (const app of apps) {
      const col = this._collectors.get(app.appId);
      if (col) result.set(app.appId, col);
    }
    return result;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Clear metrics for a specific application without unregistering it.
   * Returns `false` if the app is not registered.
   */
  clearMetrics(appId: string): boolean {
    const col = this._collectors.get(appId);
    if (!col) return false;
    col.clear();
    return true;
  }

  /** Clear all registrations and their metrics. */
  clear(): void {
    this._contexts.clear();
    this._collectors.clear();
  }
}

// ---------------------------------------------------------------------------
// Global singleton
// ---------------------------------------------------------------------------

/**
 * Application-wide `AppRegistry` instance.
 * Construct your own for isolated test environments.
 */
export const appRegistry = new AppRegistry();
