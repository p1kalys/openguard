/**
 * OpenGuard Reliability Metrics Engine
 * 
 * A provider-agnostic metrics system for tracking reliability metrics
 * without vendor lock-in telemetry systems.
 */

// Type definitions
export type {
  MetricDimensions,
  BaseMetric,
  ValidationFailureMetric,
  RetryMetric,
  HallucinationMetric,
  ProviderFailureMetric,
  LatencyMetric,
  TokenUsageMetric,
  ConfidenceMetric,
  Metric,
  NumericStats,
  ValidationFailureStats,
  RetryStats,
  HallucinationStats,
  ProviderFailureStats,
  LatencyStats,
  TokenUsageStats,
  ConfidenceStats,
  AggregatedMetrics,
  MetricFilter,
} from './types.js';

// Metrics collector
export { MetricsCollector, metricsCollector } from './collector.js';

// Metrics aggregator
export { MetricsAggregator, metricsAggregator } from './aggregator.js';

// Event integration
export { enableEventMetrics, disableEventMetrics } from './integration.js';
