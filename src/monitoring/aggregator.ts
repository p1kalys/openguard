/**
 * MonitoringAggregator
 *
 * Reads per-app `MetricsCollector` instances from an `AppRegistry` and
 * computes `AppProfile`, `TeamReport`, and `ProjectReport` analytics.
 *
 * All computation is synchronous and in-memory — no I/O, no framework deps.
 */

import type { MetricsCollector } from '../metrics/collector.js';
import type { Metric } from '../metrics/types.js';
import type { AppRegistry }      from './registry.js';
import type {
  AppContext,
  AppMetrics,
  AppProfile,
  TeamReport,
  ProjectReport,
  MonitoringFilter,
  Environment,
} from './types.js';

// ---------------------------------------------------------------------------
// Internal numeric helpers
// ---------------------------------------------------------------------------

function safeRate(num: number, den: number): number {
  return den === 0 ? 0 : num / den;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo  = Math.floor(idx);
  const hi  = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// ---------------------------------------------------------------------------
// Core per-app computation
// ---------------------------------------------------------------------------

function applyTimeFilter(metrics: Metric[], timeRange?: { start: number; end: number }): Metric[] {
  if (!timeRange) return metrics;
  return metrics.filter((m) => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end);
}

function computeAppMetrics(collector: MetricsCollector, timeRange?: { start: number; end: number }): AppMetrics {
  const raw     = applyTimeFilter(collector.getAll(), timeRange);

  // ── Latency ──────────────────────────────────────────────────────────────
  const latencyTotal = raw.filter((m) => m.metricType === 'latency' && (m as any).data.stage === 'total');
  const durations    = latencyTotal.map((m) => (m as any).data.duration as number);
  const sorted       = [...durations].sort((a, b) => a - b);

  const requestCount = latencyTotal.length;
  const avgLatencyMs = requestCount > 0
    ? durations.reduce((s, v) => s + v, 0) / requestCount
    : 0;
  const p95LatencyMs = percentile(sorted, 95);

  // ── Tokens ───────────────────────────────────────────────────────────────
  const tokenEvents = raw.filter((m) => m.metricType === 'token.usage');
  const totalTokens = tokenEvents.reduce((s, m) => s + ((m as any).data.totalTokens as number), 0);

  // ── Failures ─────────────────────────────────────────────────────────────
  const providerFailures  = raw.filter((m) => m.metricType === 'provider.failure');
  const errorCount        = providerFailures.length;
  const successCount      = Math.max(0, requestCount - errorCount);

  // ── Retries ───────────────────────────────────────────────────────────────
  const retryEvents = raw.filter((m) => m.metricType === 'retry');
  const retryRate   = Math.min(1, safeRate(retryEvents.length, requestCount));

  // ── Validation failures ───────────────────────────────────────────────────
  const valFailEvents         = raw.filter((m) => m.metricType === 'validation.failure');
  const validationFailureRate = Math.min(1, safeRate(valFailEvents.length, requestCount));

  // ── Hallucination ─────────────────────────────────────────────────────────
  const hallucEvents  = raw.filter((m) => m.metricType === 'hallucination');
  const hallucChecks  = hallucEvents.length;
  const hallucDetected = hallucEvents.filter((m) => (m as any).data.detected).length;
  const hallucinationDetectionRate = safeRate(hallucDetected, hallucChecks);

  // ── Reliability score (0 – 100) ───────────────────────────────────────────
  const successRate      = safeRate(successCount, Math.max(requestCount, 1));
  const reliabilityScore = requestCount === 0 ? 0 : Math.round(Math.min(100, Math.max(0,
    successRate                       * 40 +
    (1 - retryRate)                   * 20 +
    (1 - validationFailureRate)       * 20 +
    (1 - hallucinationDetectionRate)  * 20,
  )));

  return {
    requestCount,
    successCount,
    errorCount,
    successRate,
    avgLatencyMs,
    p95LatencyMs,
    totalTokens,
    avgTokensPerRequest: safeRate(totalTokens, requestCount),
    retryRate,
    validationFailureRate,
    hallucinationDetectionRate,
    reliabilityScore,
  };
}

// ---------------------------------------------------------------------------
// Cross-app summary
// ---------------------------------------------------------------------------

function summariseProfiles(profiles: AppProfile[]): AppMetrics {
  if (profiles.length === 0) {
    return {
      requestCount: 0, successCount: 0, errorCount: 0, successRate: 0,
      avgLatencyMs: 0, p95LatencyMs: 0, totalTokens: 0, avgTokensPerRequest: 0,
      retryRate: 0, validationFailureRate: 0, hallucinationDetectionRate: 0,
      reliabilityScore: 0,
    };
  }

  const n = profiles.length;
  const ms = profiles.map((p) => p.metrics);

  const requestCount  = ms.reduce((s, m) => s + m.requestCount,  0);
  const successCount  = ms.reduce((s, m) => s + m.successCount,  0);
  const errorCount    = ms.reduce((s, m) => s + m.errorCount,    0);
  const totalTokens   = ms.reduce((s, m) => s + m.totalTokens,   0);

  // Average the rates across apps
  const avgLatencyMs              = ms.reduce((s, m) => s + m.avgLatencyMs,              0) / n;
  const p95LatencyMs              = ms.reduce((s, m) => s + m.p95LatencyMs,              0) / n;
  const retryRate                 = ms.reduce((s, m) => s + m.retryRate,                 0) / n;
  const validationFailureRate     = ms.reduce((s, m) => s + m.validationFailureRate,     0) / n;
  const hallucinationDetectionRate = ms.reduce((s, m) => s + m.hallucinationDetectionRate, 0) / n;
  const successRate               = safeRate(successCount, Math.max(requestCount, 1));
  const reliabilityScore          = Math.round(ms.reduce((s, m) => s + m.reliabilityScore, 0) / n);

  return {
    requestCount,
    successCount,
    errorCount,
    successRate,
    avgLatencyMs,
    p95LatencyMs,
    totalTokens,
    avgTokensPerRequest: safeRate(totalTokens, requestCount),
    retryRate,
    validationFailureRate,
    hallucinationDetectionRate,
    reliabilityScore,
  };
}

// ---------------------------------------------------------------------------
// MonitoringAggregator
// ---------------------------------------------------------------------------

/**
 * Computes application-level and cross-application reliability analytics from
 * an `AppRegistry`.
 *
 * ```ts
 * const registry = new AppRegistry();
 * registry.register({ appId: 'chat', team: 'platform', ... });
 * registry.getCollector('chat').recordLatency({ provider: 'openai' }, 240, 'total');
 *
 * const agg = new MonitoringAggregator(registry);
 * const profile = agg.getAppProfile('chat');
 * const report  = agg.getTeamReport('platform');
 * ```
 */
export class MonitoringAggregator {
  private readonly _registry: AppRegistry;

  constructor(registry: AppRegistry) {
    this._registry = registry;
  }

  // ── Single-app ────────────────────────────────────────────────────────────

  /**
   * Compute the reliability profile for one registered application.
   * Throws if the app is not registered.
   */
  getAppProfile(appId: string, filter?: Pick<MonitoringFilter, 'timeRange'>): AppProfile {
    const context   = this._registry.getApp(appId);
    if (!context) throw new Error(`MonitoringAggregator: app "${appId}" is not registered`);

    const collector = this._registry.getCollector(appId);
    return {
      context,
      metrics:    computeAppMetrics(collector, filter?.timeRange),
      computedAt: Date.now(),
    };
  }

  // ── Multi-app helpers ─────────────────────────────────────────────────────

  private _buildProfiles(filter?: MonitoringFilter): AppProfile[] {
    const collectors = this._registry.getCollectors(filter);
    const profiles: AppProfile[] = [];

    for (const [appId, collector] of collectors) {
      const context = this._registry.getApp(appId)!;
      profiles.push({
        context,
        metrics:    computeAppMetrics(collector, filter?.timeRange),
        computedAt: Date.now(),
      });
    }

    // Deterministic order: highest reliability first
    return profiles.sort((a, b) => b.metrics.reliabilityScore - a.metrics.reliabilityScore);
  }

  private static _rankApps(profiles: AppProfile[]) {
    const withRequests = profiles.filter((p) => p.metrics.requestCount > 0);
    if (withRequests.length === 0) return { bestApp: undefined, worstApp: undefined, fastestApp: undefined };

    const best    = withRequests[0].context.appId;  // already sorted desc by reliabilityScore
    const worst   = withRequests.length > 1 ? withRequests[withRequests.length - 1].context.appId : undefined;
    const fastest = [...withRequests].sort((a, b) => a.metrics.avgLatencyMs - b.metrics.avgLatencyMs)[0].context.appId;

    return { bestApp: best, worstApp: worst, fastestApp: fastest };
  }

  // ── Team report ───────────────────────────────────────────────────────────

  /**
   * Aggregate reliability metrics for all applications belonging to `team`.
   *
   * An optional `environment` or `timeRange` further narrows the scope.
   */
  getTeamReport(
    team: string,
    options?: { environment?: Environment; timeRange?: { start: number; end: number } },
  ): TeamReport {
    const filter: MonitoringFilter = { team, ...options };
    const profiles  = this._buildProfiles(filter);
    const { bestApp, worstApp, fastestApp } = MonitoringAggregator._rankApps(profiles);

    return {
      team,
      environment: options?.environment,
      apps:        profiles,
      summary:     summariseProfiles(profiles),
      bestApp,
      worstApp,
      fastestApp,
      computedAt:  Date.now(),
    };
  }

  // ── Project report ────────────────────────────────────────────────────────

  /**
   * Aggregate reliability metrics for all applications belonging to `project`.
   *
   * An optional `environment` or `timeRange` further narrows the scope.
   */
  getProjectReport(
    project: string,
    options?: { environment?: Environment; timeRange?: { start: number; end: number } },
  ): ProjectReport {
    const filter: MonitoringFilter = { project, ...options };
    const profiles  = this._buildProfiles(filter);
    const { bestApp, worstApp, fastestApp } = MonitoringAggregator._rankApps(profiles);

    return {
      project,
      environment: options?.environment,
      apps:        profiles,
      summary:     summariseProfiles(profiles),
      bestApp,
      worstApp,
      fastestApp,
      computedAt:  Date.now(),
    };
  }

  // ── Fleet overview ────────────────────────────────────────────────────────

  /**
   * Return profiles for every registered application matching the filter,
   * sorted by `reliabilityScore` descending.
   */
  getAllProfiles(filter?: MonitoringFilter): AppProfile[] {
    return this._buildProfiles(filter);
  }
}

// ---------------------------------------------------------------------------
// Global singleton
// ---------------------------------------------------------------------------

import { appRegistry } from './registry.js';

/**
 * Application-wide `MonitoringAggregator` bound to the global `appRegistry`.
 * Construct your own for isolated test environments.
 */
export const monitoringAggregator = new MonitoringAggregator(appRegistry);
