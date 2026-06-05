/**
 * Observability Query API
 *
 * Framework-agnostic query layer for metrics, traces, validation failures,
 * hallucination reports, and provider reliability analytics.
 *
 * Sub-path import (tree-shakable):
 * ```ts
 * import { observabilityQuery, ObservabilityQueryEngine } from 'openguard/query';
 * ```
 *
 * Main entry also re-exports everything:
 * ```ts
 * import { observabilityQuery } from 'openguard';
 * ```
 */

// Engine + global singleton
export { ObservabilityQueryEngine, observabilityQuery } from './engine.js';

// Filter and all result/analytics types
export type {
  // Shared
  ObservabilityFilter,
  TimeRange,
  NumericSummary,
  ScoreDistribution,

  // 1. Metrics
  MetricsResult,
  LatencyAnalytics,
  TokenAnalytics,
  RetryAnalytics,
  ValidationFailureAnalytics,
  HallucinationAnalytics,
  ProviderFailureAnalytics,

  // 2. Traces
  TracesResult,
  TraceSummary,
  ProviderTraceSummary,

  // 3. Validation failures
  ValidationFailuresResult,
  ValidationIssueSummary,
  ValidationFailureSummary,

  // 4. Hallucination reports
  HallucinationReportsResult,
  HallucinationIssueSummary,
  HallucinationReportSummary,
  ProviderHallucinationSummary,

  // 5. Provider reliability
  ProviderReliabilityResult,
  ProviderStats,
} from './types.js';
