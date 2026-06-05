/**
 * ObservabilityQueryEngine
 *
 * Framework-agnostic query layer over a `StorageRegistry`.  Each of the five
 * public methods translates an `ObservabilityFilter` into one or more
 * store queries, computes derived analytics in memory, and returns a fully
 * typed, serializable result.
 *
 * Design constraints:
 * - No HTTP / no framework dependencies
 * - All methods are async and return plain objects
 * - Analytics are computed over at most `ANALYTICS_FETCH_LIMIT` raw records
 *   per query (default 10 000).  For larger datasets use a database adapter
 *   that pushes aggregation down to the storage layer.
 */

import type { StorageRegistry } from '../storage/registry.js';
import type { MetricQuery, SnapshotQuery, TraceQuery } from '../storage/types.js';

import type {
  ObservabilityFilter,
  MetricsResult,
  TracesResult,
  TraceSummary,
  ProviderTraceSummary,
  ValidationFailuresResult,
  ValidationIssueSummary,
  ValidationFailureSummary,
  HallucinationReportsResult,
  HallucinationIssueSummary,
  HallucinationReportSummary,
  ProviderHallucinationSummary,
  ProviderReliabilityResult,
  ProviderStats,
  NumericSummary,
  ScoreDistribution,
  LatencyAnalytics,
  TokenAnalytics,
  RetryAnalytics,
  ValidationFailureAnalytics,
  HallucinationAnalytics,
  ProviderFailureAnalytics,
  TimeRange,
} from './types.js';

import type { Trace } from '../tracing/types.js';
import type { DebugSnapshot } from '../debug/types.js';
import type {
  Metric,
  LatencyMetric,
  TokenUsageMetric,
  RetryMetric,
  ValidationFailureMetric,
  HallucinationMetric,
  ProviderFailureMetric,
} from '../metrics/types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum number of raw records fetched per analytics query.
 * Prevents unbounded memory consumption when stores hold millions of records.
 * Increase this value or push aggregation into the storage adapter for
 * production deployments with very large datasets.
 */
const ANALYTICS_FETCH_LIMIT = 10_000;

// ---------------------------------------------------------------------------
// Internal numeric helpers
// ---------------------------------------------------------------------------

function numericSummary(values: number[]): NumericSummary {
  if (values.length === 0) {
    return { count: 0, min: 0, max: 0, avg: 0, median: 0, p95: 0, p99: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((s, v) => s + v, 0);
  return {
    count: n,
    min: sorted[0],
    max: sorted[n - 1],
    avg: sum / n,
    median: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

/** Linear-interpolation percentile over a *sorted* array. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function scoreDistribution(scores: number[]): ScoreDistribution {
  let low = 0, medium = 0, high = 0;
  for (const s of scores) {
    if (s < 0.4) low++;
    else if (s < 0.7) medium++;
    else high++;
  }
  return { low, medium, high };
}

function safeRate(num: number, den: number): number {
  return den === 0 ? 0 : num / den;
}

function effectiveTimeRange(items: Array<{ timestamp?: number; startTime?: number; capturedAt?: number }>): TimeRange {
  const timestamps = items.flatMap((x) => {
    const t = (x as { timestamp?: number }).timestamp
      ?? (x as { startTime?: number }).startTime
      ?? (x as { capturedAt?: number }).capturedAt;
    return t !== undefined ? [t] : [];
  });
  if (timestamps.length === 0) {
    const now = Date.now();
    return { start: now, end: now };
  }
  return { start: Math.min(...timestamps), end: Math.max(...timestamps) };
}

// ---------------------------------------------------------------------------
// Filter → store query converters
// ---------------------------------------------------------------------------

function toMetricQuery(f: ObservabilityFilter, types?: Metric['metricType'][]): MetricQuery {
  return {
    dimensions: {
      ...(f.provider     && { provider:    f.provider }),
      ...(f.model        && { model:       f.model }),
      ...(f.requestType  && { requestType: f.requestType }),
    },
    ...(types?.length && { metricTypes: types }),
    ...(f.timeRange && { timeRange: f.timeRange }),
    limit: ANALYTICS_FETCH_LIMIT,
    offset: 0,
  };
}

function toTraceQuery(f: ObservabilityFilter, pageOffset?: number, pageLimit?: number): TraceQuery {
  return {
    ...(f.provider  && { provider:  f.provider }),
    ...(f.model     && { model:     f.model }),
    ...(f.timeRange && { timeRange: f.timeRange }),
    limit:  pageLimit  ?? ANALYTICS_FETCH_LIMIT,
    offset: pageOffset ?? 0,
  };
}

function toSnapshotQuery(f: ObservabilityFilter, pageOffset?: number, pageLimit?: number): SnapshotQuery {
  return {
    ...(f.provider  && { provider:  f.provider }),
    ...(f.model     && { model:     f.model }),
    ...(f.timeRange && { timeRange: f.timeRange }),
    limit:  pageLimit  ?? ANALYTICS_FETCH_LIMIT,
    offset: pageOffset ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Trace → TraceSummary projection
// ---------------------------------------------------------------------------

function traceToSummary(t: Trace): TraceSummary {
  const errorSpan = t.spans.find((s) => s.error);
  return {
    traceId:    t.traceId,
    requestId:  t.requestId,
    provider:   t.provider?.name,
    model:      t.provider?.model,
    status:     t.status,
    startTime:  t.startTime,
    durationMs: t.duration,
    spanCount:  t.spans.length,
    totalTokens: t.provider?.tokens?.total,
    errorMessage: errorSpan?.error?.message,
  };
}

// ---------------------------------------------------------------------------
// ObservabilityQueryEngine
// ---------------------------------------------------------------------------

/**
 * Stateless query engine.  Pass a `StorageRegistry` at construction time.
 *
 * ```ts
 * import { ObservabilityQueryEngine } from 'openguard/query';
 * import { createMemoryStorage }       from 'openguard/storage';
 *
 * const engine = new ObservabilityQueryEngine(createMemoryStorage());
 *
 * const metrics  = await engine.queryMetrics({ provider: 'openai' });
 * const traces   = await engine.queryTraces({ timeRange: { start, end } });
 * const valFails = await engine.queryValidationFailures({ model: 'gpt-4o' });
 * const halluc   = await engine.queryHallucinationReports({});
 * const rel      = await engine.queryProviderReliability({});
 * ```
 */
export class ObservabilityQueryEngine {
  private readonly _storage: StorageRegistry;

  constructor(storage: StorageRegistry) {
    this._storage = storage;
  }

  // ── 1. queryMetrics ────────────────────────────────────────────────────────

  /**
   * Aggregate all metric events matching the filter into a single analytics view.
   *
   * Returns latency, token, retry, validation-failure, hallucination, and
   * provider-failure analytics computed over the matching metric set.
   */
  async queryMetrics(filter: ObservabilityFilter = {}): Promise<MetricsResult> {
    const raw = await this._storage.metrics.queryMetrics(toMetricQuery(filter));
    const metrics = raw.items;

    const latencyMetrics    = metrics.filter((m): m is LatencyMetric          => m.metricType === 'latency');
    const tokenMetrics      = metrics.filter((m): m is TokenUsageMetric       => m.metricType === 'token.usage');
    const retryMetrics      = metrics.filter((m): m is RetryMetric            => m.metricType === 'retry');
    const valFailMetrics    = metrics.filter((m): m is ValidationFailureMetric => m.metricType === 'validation.failure');
    const hallucMetrics     = metrics.filter((m): m is HallucinationMetric    => m.metricType === 'hallucination');
    const provFailMetrics   = metrics.filter((m): m is ProviderFailureMetric  => m.metricType === 'provider.failure');

    return {
      filter,
      timeRange: filter.timeRange ?? effectiveTimeRange(metrics),
      totalEvents: metrics.length,
      latency:          this._computeLatency(latencyMetrics),
      tokens:           this._computeTokens(tokenMetrics),
      retries:          this._computeRetries(retryMetrics),
      validationFailures: this._computeValFailures(valFailMetrics),
      hallucinations:   this._computeHallucinations(hallucMetrics),
      providerFailures: this._computeProviderFailures(provFailMetrics),
    };
  }

  // ── 2. queryTraces ─────────────────────────────────────────────────────────

  /**
   * Query and summarise request traces.
   *
   * Returns success/error counts, latency percentiles, per-provider breakdowns,
   * and the slowest traces alongside a paginated item list.
   */
  async queryTraces(filter: ObservabilityFilter = {}): Promise<TracesResult> {
    const limit  = filter.limit  ?? 20;
    const offset = filter.offset ?? 0;

    // Two fetches in parallel:
    //   analyticsPage — full window (up to ANALYTICS_FETCH_LIMIT) for aggregate stats
    //   itemsPage     — store-level pagination so items are correct beyond ANALYTICS_FETCH_LIMIT
    const [analyticsPage, itemsPage] = await Promise.all([
      this._storage.traces.queryTraces(toTraceQuery(filter)),
      this._storage.traces.queryTraces(toTraceQuery(filter, offset, limit)),
    ]);
    const all = analyticsPage.items;

    const durations = all.map((t) => t.duration ?? 0).filter((d) => d > 0);
    const latStats  = numericSummary(durations);

    const successCount = all.filter((t) => t.status === 'ok').length;
    const errorCount   = all.filter((t) => t.status === 'error').length;

    // Per-provider breakdown
    const byProvider: Record<string, ProviderTraceSummary> = {};
    for (const t of all) {
      const pName = t.provider?.name ?? 'unknown';
      if (!byProvider[pName]) {
        byProvider[pName] = { provider: pName, totalTraces: 0, successCount: 0, errorCount: 0, successRate: 0, avgDurationMs: 0 };
      }
      byProvider[pName].totalTraces++;
      if (t.status === 'ok')    byProvider[pName].successCount++;
      if (t.status === 'error') byProvider[pName].errorCount++;
    }
    for (const pName of Object.keys(byProvider)) {
      const p = byProvider[pName];
      const pDurations = all
        .filter((t) => (t.provider?.name ?? 'unknown') === pName && (t.duration ?? 0) > 0)
        .map((t) => t.duration!);
      p.successRate  = safeRate(p.successCount, p.totalTraces);
      p.avgDurationMs = pDurations.length > 0
        ? pDurations.reduce((s, v) => s + v, 0) / pDurations.length
        : 0;
    }

    // Slowest traces (from analytics window)
    const slowest = [...all]
      .filter((t) => t.duration !== undefined)
      .sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0))
      .slice(0, limit)
      .map(traceToSummary);

    return {
      filter,
      total:         analyticsPage.total,
      successCount,
      errorCount,
      successRate:   safeRate(successCount, all.length),
      avgDurationMs: latStats.avg,
      p95DurationMs: latStats.p95,
      byProvider,
      slowest,
      items:    itemsPage.items.map(traceToSummary),
      hasMore:  offset + limit < analyticsPage.total,
    };
  }

  // ── 3. queryValidationFailures ─────────────────────────────────────────────

  /**
   * Surface snapshots that contain at least one failed validation.
   *
   * Returns aggregate counts by kind, provider, and model, a ranked issue
   * summary, and a paginated list of recent failing snapshots.
   */
  async queryValidationFailures(filter: ObservabilityFilter = {}): Promise<ValidationFailuresResult> {
    const limit  = filter.limit  ?? 20;
    const offset = filter.offset ?? 0;

    // Fetch all snapshots (analytics ceiling)
    const allPage = await this._storage.snapshots.querySnapshots(toSnapshotQuery(filter));
    const allSnaps = allPage.items;

    // Keep only those with at least one failing validation
    const failing = allSnaps.filter((s) => s.validations.some((v) => !v.passed));

    const total        = failing.length;
    const criticalCount = failing.filter((s) =>
      s.validations.some((v) => !v.passed && v.issues.some((i) => i.severity === 'critical'))
    ).length;

    const byKind:     Record<string, number> = {};
    const byProvider: Record<string, number> = {};
    const byModel:    Record<string, number> = {};
    const issueMap:   Map<string, { count: number; criticalCount: number; providers: Set<string>; models: Set<string> }> = new Map();

    for (const snap of failing) {
      const p = snap.provider ?? 'unknown';
      const m = snap.model    ?? 'unknown';
      byProvider[p] = (byProvider[p] ?? 0) + 1;
      byModel[m]    = (byModel[m]    ?? 0) + 1;

      for (const v of snap.validations) {
        if (v.passed) continue;
        byKind[v.kind] = (byKind[v.kind] ?? 0) + 1;

        for (const issue of v.issues) {
          if (!issueMap.has(issue.type)) {
            issueMap.set(issue.type, { count: 0, criticalCount: 0, providers: new Set(), models: new Set() });
          }
          const entry = issueMap.get(issue.type)!;
          entry.count++;
          if (issue.severity === 'critical') entry.criticalCount++;
          entry.providers.add(p);
          entry.models.add(m);
        }
      }
    }

    const topIssues: ValidationIssueSummary[] = [...issueMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([type, e]) => ({
        issueType:    type,
        count:        e.count,
        criticalCount: e.criticalCount,
        criticalRate: safeRate(e.criticalCount, e.count),
        providers:    [...e.providers],
        models:       [...e.models],
      }));

    const pageItems: ValidationFailureSummary[] = failing
      .slice(offset, offset + limit)
      .map((s): ValidationFailureSummary => {
        const failedValidations = s.validations.filter((v) => !v.passed);
        const allIssues = failedValidations.flatMap((v) => v.issues);
        return {
          snapshotId:     s.id,
          requestId:      s.requestId,
          capturedAt:     s.capturedAt,
          provider:       s.provider,
          model:          s.model,
          firstIssue:     allIssues[0]?.message ?? 'validation failed',
          totalIssues:    allIssues.length,
          criticalIssues: allIssues.filter((i) => i.severity === 'critical').length,
        };
      });

    return {
      filter,
      total,
      criticalCount,
      criticalRate:  safeRate(criticalCount, total),
      byKind,
      byProvider,
      byModel,
      topIssues,
      items:   pageItems,
      hasMore: offset + limit < total,
    };
  }

  // ── 4. queryHallucinationReports ───────────────────────────────────────────

  /**
   * Analyse snapshots that include hallucination-detection checks.
   *
   * Returns detection rate, score distribution, per-provider breakdown, top
   * issue types, and a paginated list sorted by `hallucinationScore` descending.
   */
  async queryHallucinationReports(filter: ObservabilityFilter = {}): Promise<HallucinationReportsResult> {
    const limit  = filter.limit  ?? 20;
    const offset = filter.offset ?? 0;

    const allPage = await this._storage.snapshots.querySnapshots(toSnapshotQuery(filter));
    const allSnaps = allPage.items;

    // Only snapshots that ran at least one hallucination check
    const checked = allSnaps.filter((s) => s.hallucinationChecks.length > 0);

    const scores       = checked.flatMap((s) => s.hallucinationChecks.map((h) => h.hallucinationScore));
    const detected     = checked.filter((s) => s.hallucinationChecks.some((h) => h.isHallucinated));

    const byProvider: Record<string, ProviderHallucinationSummary> = {};
    const issueMap:   Map<string, { count: number; confidences: number[]; providers: Set<string> }> = new Map();

    for (const snap of checked) {
      const p = snap.provider ?? 'unknown';
      if (!byProvider[p]) {
        byProvider[p] = { provider: p, totalChecks: 0, detectionCount: 0, detectionRate: 0, avgScore: 0 };
      }
      const ps = byProvider[p];
      const pScores: number[] = [];

      for (const h of snap.hallucinationChecks) {
        ps.totalChecks++;
        pScores.push(h.hallucinationScore);
        if (h.isHallucinated) ps.detectionCount++;

        for (const issue of h.issues) {
          if (!issueMap.has(issue.type)) {
            issueMap.set(issue.type, { count: 0, confidences: [], providers: new Set() });
          }
          const e = issueMap.get(issue.type)!;
          e.count++;
          e.confidences.push(issue.confidence);
          e.providers.add(p);
        }
      }

      if (pScores.length > 0) {
        ps.avgScore = pScores.reduce((s, v) => s + v, 0) / pScores.length;
      }
    }

    for (const ps of Object.values(byProvider)) {
      ps.detectionRate = safeRate(ps.detectionCount, ps.totalChecks);
    }

    const topIssues: HallucinationIssueSummary[] = [...issueMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([type, e]) => ({
        issueType:       type,
        count:           e.count,
        avgConfidence:   e.confidences.length > 0
          ? e.confidences.reduce((s, v) => s + v, 0) / e.confidences.length
          : 0,
        providers:       [...e.providers],
      }));

    // Sort by highest score, then paginate
    const sorted = [...checked].sort((a, b) => {
      const aMax = Math.max(...a.hallucinationChecks.map((h) => h.hallucinationScore));
      const bMax = Math.max(...b.hallucinationChecks.map((h) => h.hallucinationScore));
      return bMax - aMax;
    });

    const pageItems: HallucinationReportSummary[] = sorted
      .slice(offset, offset + limit)
      .map((s): HallucinationReportSummary => {
        const h = s.hallucinationChecks[0];
        return {
          snapshotId:         s.id,
          requestId:          s.requestId,
          capturedAt:         s.capturedAt,
          provider:           s.provider,
          model:              s.model,
          hallucinationScore: h.hallucinationScore,
          isHallucinated:     h.isHallucinated,
          riskLevel:          h.riskLevel,
          issueCount:         h.issues.length,
        };
      });

    const avgScore = scores.length > 0
      ? scores.reduce((s, v) => s + v, 0) / scores.length
      : 0;

    return {
      filter,
      totalChecks:     checked.length,
      detectionCount:  detected.length,
      detectionRate:   safeRate(detected.length, checked.length),
      avgScore,
      scoreDistribution: scoreDistribution(scores),
      byProvider,
      topIssues,
      items:   pageItems,
      hasMore: offset + limit < checked.length,
    };
  }

  // ── 5. queryProviderReliability ────────────────────────────────────────────

  /**
   * Build a per-provider reliability profile by joining trace, metric, and
   * snapshot data.
   *
   * Each `ProviderStats` entry contains success/error rates, latency
   * percentiles, retry rates, token usage, and a composite reliability score.
   */
  async queryProviderReliability(filter: ObservabilityFilter = {}): Promise<ProviderReliabilityResult> {
    // Fetch all three data sources in parallel
    const [tracePage, metricPage, snapPage] = await Promise.all([
      this._storage.traces.queryTraces(toTraceQuery(filter)),
      this._storage.metrics.queryMetrics(toMetricQuery(filter)),
      this._storage.snapshots.querySnapshots(toSnapshotQuery(filter)),
    ]);

    const traces    = tracePage.items;
    const metrics   = metricPage.items;
    const snapshots = snapPage.items;

    // Collect every provider name seen across all three sources
    const providerNames = new Set<string>([
      ...traces.map((t) => t.provider?.name ?? 'unknown'),
      ...metrics.map((m) => m.dimensions.provider ?? 'unknown'),
      ...snapshots.map((s) => s.provider ?? 'unknown'),
    ]);

    // Only include providers that had at least some activity in the filter window
    // Drop 'unknown' unless it's the only provider
    const realProviders = [...providerNames].filter((p) => p !== 'unknown');
    const effectiveProviders = realProviders.length > 0 ? realProviders : [...providerNames];

    const providerStats: ProviderStats[] = effectiveProviders.map((provider) => {
      // ── Traces ──────────────────────────────────────────────────────────
      const pTraces = traces.filter((t) => (t.provider?.name ?? 'unknown') === provider);
      const models  = [...new Set(pTraces.map((t) => t.provider?.model).filter((m): m is string => m !== undefined))];

      const successCount = pTraces.filter((t) => t.status === 'ok').length;
      const errorCount   = pTraces.filter((t) => t.status === 'error').length;
      const durations    = pTraces.map((t) => t.duration ?? 0).filter((d) => d > 0);
      const latStats     = numericSummary(durations);

      // ── Metrics ──────────────────────────────────────────────────────────
      const pMetrics  = metrics.filter((m) => (m.dimensions.provider ?? 'unknown') === provider);

      const latMs   = (pMetrics.filter((m): m is LatencyMetric => m.metricType === 'latency') as LatencyMetric[])
        .map((m) => m.data.duration);
      const retries = (pMetrics.filter((m): m is RetryMetric  => m.metricType === 'retry')   as RetryMetric[]);
      const tokens  = (pMetrics.filter((m): m is TokenUsageMetric => m.metricType === 'token.usage') as TokenUsageMetric[]);

      // Combine latencies from traces and latency metrics
      const allLatencies = [...durations, ...latMs];
      const combinedLat  = numericSummary(allLatencies);

      const totalTokens   = tokens.reduce((s, m) => s + m.data.totalTokens, 0);
      const totalRequests = pTraces.length;
      // Use attempt===1 count as proxy for distinct retry-sequences (same convention as _computeRetries)
      const retrySequences = retries.filter((m) => m.data.attempt === 1).length;
      const retryRate      = safeRate(retrySequences, Math.max(totalRequests, 1));

      // ── Snapshots ────────────────────────────────────────────────────────
      const pSnaps = snapshots.filter((s) => (s.provider ?? 'unknown') === provider);
      const snapsWithValFail  = pSnaps.filter((s) => s.validations.some((v) => !v.passed));
      const snapsWithHallucin = pSnaps.filter((s) => s.hallucinationChecks.some((h) => h.isHallucinated));

      const validationFailureRate = safeRate(snapsWithValFail.length,  pSnaps.length);
      const hallucinationDetRate  = safeRate(snapsWithHallucin.length, pSnaps.filter((s) => s.hallucinationChecks.length > 0).length);

      // Composite reliability score (0–100)
      const denom = Math.max(totalRequests, 1);
      const reliability =
        safeRate(successCount, denom) * 40 +
        (1 - retryRate)               * 20 +
        (1 - validationFailureRate)   * 20 +
        (1 - hallucinationDetRate)    * 20;

      return {
        provider,
        models,
        totalRequests,
        successCount,
        errorCount,
        successRate:               safeRate(successCount, denom),
        errorRate:                 safeRate(errorCount,   denom),
        avgLatencyMs:              combinedLat.avg,
        p95LatencyMs:              combinedLat.p95,
        retryRate,
        avgTokensPerRequest:       safeRate(totalTokens, denom),
        totalTokens,
        hallucinationDetectionRate: hallucinationDetRate,
        validationFailureRate,
        reliabilityScore:          Math.round(Math.min(100, Math.max(0, reliability))),
      };
    });

    // Sort by reliability score descending
    providerStats.sort((a, b) => b.reliabilityScore - a.reliabilityScore);

    const withTraces = providerStats.filter((p) => p.totalRequests > 0);

    return {
      filter,
      providers:         providerStats,
      bestProvider:      providerStats[0]?.provider,
      fastestProvider:   withTraces.length > 0
        ? withTraces.slice().sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)[0].provider
        : undefined,
      mostUsedProvider:  withTraces.length > 0
        ? withTraces.slice().sort((a, b) => b.totalRequests - a.totalRequests)[0].provider
        : undefined,
    };
  }

  // ── Private metric analytics helpers ──────────────────────────────────────

  private _computeLatency(metrics: LatencyMetric[]): LatencyAnalytics {
    const all = metrics.map((m) => m.data.duration);
    const stages = new Map<string, number[]>();
    for (const m of metrics) {
      const bucket = stages.get(m.data.stage) ?? [];
      bucket.push(m.data.duration);
      stages.set(m.data.stage, bucket);
    }
    const byStage: Record<string, import('./types.js').NumericSummary> = {};
    for (const [stage, vals] of stages) {
      byStage[stage] = numericSummary(vals);
    }
    return { overall: numericSummary(all), byStage };
  }

  private _computeTokens(metrics: TokenUsageMetric[]): TokenAnalytics {
    const n = metrics.length || 1;
    const tp = metrics.reduce((s, m) => s + m.data.promptTokens,     0);
    const tc = metrics.reduce((s, m) => s + m.data.completionTokens, 0);
    const tt = metrics.reduce((s, m) => s + m.data.totalTokens,       0);
    return {
      totalPromptTokens:      tp,
      totalCompletionTokens:  tc,
      totalTokens:            tt,
      avgPromptTokens:        tp / n,
      avgCompletionTokens:    tc / n,
      avgTotalTokens:         tt / n,
    };
  }

  private _computeRetries(metrics: RetryMetric[]): RetryAnalytics {
    const byReason: Record<string, number> = {};
    for (const m of metrics) {
      byReason[m.data.reason] = (byReason[m.data.reason] ?? 0) + 1;
    }
    // Each attempt===1 event marks the start of a new retry sequence for a request.
    // Attempts are 1-based (per the event system convention).
    const requestsWithRetries = metrics.filter((m) => m.data.attempt === 1).length;
    return {
      totalRetryEvents:           metrics.length,
      requestsWithRetries,
      avgAttemptsPerRetryRequest: requestsWithRetries > 0
        ? safeRate(metrics.length, requestsWithRetries)
        : 0,
      byReason,
    };
  }

  private _computeValFailures(metrics: ValidationFailureMetric[]): ValidationFailureAnalytics {
    const byType: Record<string, number> = {};
    let critical = 0;
    for (const m of metrics) {
      byType[m.data.validationType] = (byType[m.data.validationType] ?? 0) + 1;
      if (m.data.critical) critical++;
    }
    return {
      total:         metrics.length,
      criticalCount: critical,
      criticalRate:  safeRate(critical, metrics.length),
      byType,
    };
  }

  private _computeHallucinations(metrics: HallucinationMetric[]): HallucinationAnalytics {
    const scores    = metrics.map((m) => m.data.score);
    const detected  = metrics.filter((m) => m.data.detected);
    const avgScore  = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
    return {
      totalChecks:       metrics.length,
      detectionCount:    detected.length,
      detectionRate:     safeRate(detected.length, metrics.length),
      avgScore,
      scoreDistribution: scoreDistribution(scores),
    };
  }

  private _computeProviderFailures(metrics: ProviderFailureMetric[]): ProviderFailureAnalytics {
    const byStage: Record<string, number> = {};
    for (const m of metrics) {
      byStage[m.data.stage] = (byStage[m.data.stage] ?? 0) + 1;
    }
    const avgAttempts = metrics.length > 0
      ? metrics.reduce((s, m) => s + m.data.attempts, 0) / metrics.length
      : 0;
    return { total: metrics.length, avgAttemptsBeforeFailure: avgAttempts, byStage };
  }
}

// ---------------------------------------------------------------------------
// Global default engine (uses global observabilityStorage)
// ---------------------------------------------------------------------------

/**
 * Application-wide query engine bound to the default `observabilityStorage`
 * singleton.  Construct your own `ObservabilityQueryEngine` for isolated
 * test environments or custom storage backends.
 *
 * @example
 * ```ts
 * import { observabilityQuery } from 'openguard/query';
 * const metrics = await observabilityQuery.queryMetrics({ provider: 'openai' });
 * ```
 */
import { observabilityStorage } from '../storage/registry.js';
export const observabilityQuery = new ObservabilityQueryEngine(observabilityStorage);
