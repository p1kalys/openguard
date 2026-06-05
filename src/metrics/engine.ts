/**
 * High-level Reliability Metrics Engine
 *
 * Provides a single entrypoint for recording, aggregating and exporting
 * normalized reliability metrics in a provider-agnostic way.
 */

import type {
  Metric,
  MetricDimensions,
  MetricFilter,
  AggregatedMetrics,
} from './types.js';
import { metricsCollector } from './collector.js';
import { metricsAggregator } from './aggregator.js';

export class ReliabilityMetricsEngine {
  private collector = metricsCollector;

  constructor() {}

  // Recording helpers (delegate to collector)
  recordValidationFailure(dimensions: MetricDimensions, validationType: string, error?: string, critical: boolean = false) {
    this.collector.recordValidationFailure(dimensions, validationType, error, critical);
  }

  recordRetry(dimensions: MetricDimensions, attempt: number, maxRetries: number, reason: string, delay: number) {
    this.collector.recordRetry(dimensions, attempt, maxRetries, reason, delay);
  }

  recordHallucination(dimensions: MetricDimensions, score: number, detected: boolean, confidence: number) {
    this.collector.recordHallucination(dimensions, score, detected, confidence);
  }

  recordProviderFailure(dimensions: MetricDimensions, stage: string, error: string, attempts: number) {
    this.collector.recordProviderFailure(dimensions, stage as any, error, attempts);
  }

  recordLatency(dimensions: MetricDimensions, duration: number, stage: string = 'total') {
    this.collector.recordLatency(dimensions, duration, stage as any);
  }

  recordTokenUsage(dimensions: MetricDimensions, promptTokens: number, completionTokens: number, totalTokens: number) {
    this.collector.recordTokenUsage(dimensions, promptTokens, completionTokens, totalTokens);
  }

  recordConfidence(dimensions: MetricDimensions, score: number, source: string) {
    this.collector.recordConfidence(dimensions, score, source);
  }

  // Basic retrieval
  getAllMetrics(): Metric[] {
    return this.collector.getAll();
  }

  getFiltered(filter: MetricFilter) {
    return this.collector.getFiltered(filter);
  }

  clear() {
    this.collector.clear();
  }

  count() {
    return this.collector.count();
  }

  // Aggregation helpers
  aggregateByDimensions(dimensions: Record<string, string | undefined>): AggregatedMetrics {
    const metrics = this.getAllMetrics();
    return metricsAggregator.aggregateByDimensions(metrics, dimensions as any);
  }

  aggregateByProvider(provider: string): AggregatedMetrics {
    const metrics = this.getAllMetrics();
    return metricsAggregator.aggregateByProvider(metrics, provider);
  }

  aggregateByModel(model: string): AggregatedMetrics {
    const metrics = this.getAllMetrics();
    return metricsAggregator.aggregateByModel(metrics, model);
  }

  aggregateByRequestType(requestType: string): AggregatedMetrics {
    const metrics = this.getAllMetrics();
    return metricsAggregator.aggregateByRequestType(metrics, requestType);
  }

  aggregateAllByProvider() {
    const metrics = this.getAllMetrics();
    return metricsAggregator.aggregateAllByProvider(metrics);
  }

  aggregateAllByModel() {
    const metrics = this.getAllMetrics();
    return metricsAggregator.aggregateAllByModel(metrics);
  }

  // Export normalized aggregated metrics as plain JSON
  exportAggregated(aggregated: AggregatedMetrics) {
    return JSON.parse(JSON.stringify(aggregated));
  }

  // Convenience: produce normalized aggregation for a given filter and optional grouping
  produce(filter?: MetricFilter, groupBy?: 'provider' | 'model' | 'requestType' | 'none') {
    const metrics = filter ? this.getFiltered(filter) : this.getAllMetrics();

    if (!groupBy || groupBy === 'none') {
      return metricsAggregator.aggregateByDimensions(metrics, {});
    }

    if (groupBy === 'provider') return metricsAggregator.aggregateAllByProvider(metrics);
    if (groupBy === 'model') return metricsAggregator.aggregateAllByModel(metrics);
    if (groupBy === 'requestType') {
      const types = metricsAggregator.getUniqueRequestTypes(metrics);
      const map = new Map<string, AggregatedMetrics>();
      for (const t of types) {
        map.set(t, metricsAggregator.aggregateByRequestType(metrics, t));
      }
      return map;
    }

    return metricsAggregator.aggregateByDimensions(metrics, {});
  }
}

export const reliabilityMetricsEngine = new ReliabilityMetricsEngine();
