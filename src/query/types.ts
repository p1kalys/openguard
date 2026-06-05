/**
 * Observability query API — filter and result types
 *
 * All result types are plain-object serializable (JSON round-trip safe).
 * Every query method accepts an `ObservabilityFilter` and returns a
 * typed analytics result.
 */

import type { TimeRange } from '../storage/types.js';

// Re-export so callers only need to import from one place
export type { TimeRange };

// ---------------------------------------------------------------------------
// Shared filter
// ---------------------------------------------------------------------------

/**
 * Common filter used across all five query methods.
 *
 * All fields are optional and ANDed together. Omitting a field means
 * "match everything" for that dimension.
 */
export interface ObservabilityFilter {
  /** Restrict results to a specific provider (e.g. `'openai'`). */
  provider?: string;
  /** Restrict results to a specific model (e.g. `'gpt-4o'`). */
  model?: string;
  /** Inclusive unix-ms time range. */
  timeRange?: TimeRange;
  /**
   * Restrict metrics-based results to a specific request type
   * (maps to `MetricDimensions.requestType`).
   */
  requestType?: string;
  /**
   * Maximum number of items in list-type fields (e.g. `items`, `slowest`,
   * `topIssues`). Default: **20**.
   */
  limit?: number;
  /**
   * Offset for list-type fields. Default: **0**.
   * Used together with `limit` for pagination of list results.
   */
  offset?: number;
}

// ---------------------------------------------------------------------------
// Shared sub-types
// ---------------------------------------------------------------------------

/** Percentile-annotated statistics for a numeric series. */
export interface NumericSummary {
  count: number;
  min: number;
  max: number;
  avg: number;
  median: number;
  p95: number;
  p99: number;
}

/** Three-bucket score distribution (0–0.4 / 0.4–0.7 / 0.7–1). */
export interface ScoreDistribution {
  low: number;
  medium: number;
  high: number;
}

// ---------------------------------------------------------------------------
// 1. Metrics result
// ---------------------------------------------------------------------------

export interface LatencyAnalytics {
  /** Latency statistics across all stages. */
  overall: NumericSummary;
  /** Per-stage breakdown (`total`, `provider`, `validation`, `normalization`). */
  byStage: Record<string, NumericSummary>;
}

export interface TokenAnalytics {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  avgPromptTokens: number;
  avgCompletionTokens: number;
  avgTotalTokens: number;
}

export interface RetryAnalytics {
  totalRetryEvents: number;
  /** Number of distinct requests that triggered at least one retry. */
  requestsWithRetries: number;
  avgAttemptsPerRetryRequest: number;
  /** Count of retry events grouped by error reason. */
  byReason: Record<string, number>;
}

export interface ValidationFailureAnalytics {
  total: number;
  criticalCount: number;
  criticalRate: number;
  /** Count grouped by `validationType`. */
  byType: Record<string, number>;
}

export interface HallucinationAnalytics {
  totalChecks: number;
  detectionCount: number;
  detectionRate: number;
  avgScore: number;
  scoreDistribution: ScoreDistribution;
}

export interface ProviderFailureAnalytics {
  total: number;
  avgAttemptsBeforeFailure: number;
  /** Count grouped by failure stage. */
  byStage: Record<string, number>;
}

/**
 * Aggregated analytics view over a set of metric events.
 */
export interface MetricsResult {
  /** Echoed filter used to produce this result. */
  filter: ObservabilityFilter;
  /** Effective time range (may be derived from data when not supplied in filter). */
  timeRange: TimeRange;
  totalEvents: number;
  latency: LatencyAnalytics;
  tokens: TokenAnalytics;
  retries: RetryAnalytics;
  validationFailures: ValidationFailureAnalytics;
  hallucinations: HallucinationAnalytics;
  providerFailures: ProviderFailureAnalytics;
}

// ---------------------------------------------------------------------------
// 2. Traces result
// ---------------------------------------------------------------------------

/** Condensed view of a single trace for list/summary display. */
export interface TraceSummary {
  traceId: string;
  requestId: string;
  provider?: string;
  model?: string;
  status: string;
  startTime: number;
  durationMs?: number;
  spanCount: number;
  totalTokens?: number;
  errorMessage?: string;
}

/** Per-provider breakdown inside a traces result. */
export interface ProviderTraceSummary {
  provider: string;
  totalTraces: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  avgDurationMs: number;
}

export interface TracesResult {
  filter: ObservabilityFilter;
  /** Total number of traces matching the filter (before list pagination). */
  total: number;
  successCount: number;
  errorCount: number;
  /** Success rate as a fraction (0–1). */
  successRate: number;
  avgDurationMs: number;
  p95DurationMs: number;
  /** Breakdown of totals per provider. */
  byProvider: Record<string, ProviderTraceSummary>;
  /** Slowest traces (by `durationMs`), up to `filter.limit` items. */
  slowest: TraceSummary[];
  /** Paginated list of matching traces (newest first). */
  items: TraceSummary[];
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// 3. Validation failures result
// ---------------------------------------------------------------------------

/** A single aggregated validation issue across many snapshots. */
export interface ValidationIssueSummary {
  /** Validation type string (e.g. `'SCHEMA_VALIDATION_ERROR'`). */
  issueType: string;
  count: number;
  criticalCount: number;
  /** Fraction of occurrences marked critical. */
  criticalRate: number;
  providers: string[];
  models: string[];
}

/** Single snapshot reduced to its validation failure info. */
export interface ValidationFailureSummary {
  snapshotId: string;
  requestId: string;
  capturedAt: number;
  provider?: string;
  model?: string;
  /** First failing issue message. */
  firstIssue: string;
  totalIssues: number;
  criticalIssues: number;
}

export interface ValidationFailuresResult {
  filter: ObservabilityFilter;
  /** Total snapshots that had at least one failed validation. */
  total: number;
  criticalCount: number;
  criticalRate: number;
  /** Count of failures grouped by validation kind (`schema`, `semantic`, …). */
  byKind: Record<string, number>;
  /** Count of failures grouped by provider. */
  byProvider: Record<string, number>;
  /** Count of failures grouped by model. */
  byModel: Record<string, number>;
  /** Top validation issue types ranked by frequency. */
  topIssues: ValidationIssueSummary[];
  /** Paginated list of recent snapshots with validation failures (newest first). */
  items: ValidationFailureSummary[];
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// 4. Hallucination reports result
// ---------------------------------------------------------------------------

/** A hallucination issue type aggregated across many snapshots. */
export interface HallucinationIssueSummary {
  issueType: string;
  count: number;
  avgConfidence: number;
  providers: string[];
}

/** Single snapshot reduced to its hallucination info. */
export interface HallucinationReportSummary {
  snapshotId: string;
  requestId: string;
  capturedAt: number;
  provider?: string;
  model?: string;
  hallucinationScore: number;
  isHallucinated: boolean;
  riskLevel: string;
  issueCount: number;
}

/** Per-provider hallucination breakdown. */
export interface ProviderHallucinationSummary {
  provider: string;
  totalChecks: number;
  detectionCount: number;
  detectionRate: number;
  avgScore: number;
}

export interface HallucinationReportsResult {
  filter: ObservabilityFilter;
  /** Total snapshots that include a hallucination check. */
  totalChecks: number;
  detectionCount: number;
  /** Fraction of checks where `isHallucinated === true`. */
  detectionRate: number;
  avgScore: number;
  scoreDistribution: ScoreDistribution;
  byProvider: Record<string, ProviderHallucinationSummary>;
  /** Top issue types ranked by frequency. */
  topIssues: HallucinationIssueSummary[];
  /** Paginated list of snapshots with hallucination data (highest-score first). */
  items: HallucinationReportSummary[];
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// 5. Provider reliability result
// ---------------------------------------------------------------------------

/** Complete reliability profile for a single provider. */
export interface ProviderStats {
  provider: string;
  /** All distinct models observed for this provider. */
  models: string[];
  totalRequests: number;
  successCount: number;
  errorCount: number;
  /** Fraction of successful traces (0–1). */
  successRate: number;
  /** Fraction of traces with errors (0–1). */
  errorRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  /** Fraction of requests that triggered at least one retry (0–1). */
  retryRate: number;
  avgTokensPerRequest: number;
  totalTokens: number;
  hallucinationDetectionRate: number;
  validationFailureRate: number;
  /**
   * Composite reliability score (0–100). Higher is better.
   * Weighted: successRate × 40 + (1 − retryRate) × 20 +
   *           (1 − validationFailureRate) × 20 +
   *           (1 − hallucinationDetectionRate) × 20.
   */
  reliabilityScore: number;
}

export interface ProviderReliabilityResult {
  filter: ObservabilityFilter;
  providers: ProviderStats[];
  /** Provider with the highest `reliabilityScore`. */
  bestProvider?: string;
  /** Provider with the lowest `avgLatencyMs` (among providers with > 0 requests). */
  fastestProvider?: string;
  /** Provider with the most total requests. */
  mostUsedProvider?: string;
}
