/**
 * Metrics aggregation logic
 */

import type {
  Metric,
  MetricDimensions,
  MetricFilter,
  AggregatedMetrics,
  NumericStats,
  ValidationFailureStats,
  RetryStats,
  HallucinationStats,
  ProviderFailureStats,
  LatencyStats,
  TokenUsageStats,
  ConfidenceStats,
} from './types.js';

/**
 * Calculate numeric statistics from an array of numbers
 */
function calculateNumericStats(values: number[]): NumericStats {
  if (values.length === 0) {
    return {
      count: 0,
      sum: 0,
      min: 0,
      max: 0,
      avg: 0,
      median: 0,
      p95: 0,
      p99: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, v) => acc + v, 0);
  const count = values.length;

  const percentile = (p: number): number => {
    const index = Math.ceil((p / 100) * count) - 1;
    return sorted[Math.max(0, index)];
  };

  const median = count % 2 === 0
    ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
    : sorted[Math.floor(count / 2)];

  return {
    count,
    sum,
    min: sorted[0],
    max: sorted[count - 1],
    avg: sum / count,
    median,
    p95: percentile(95),
    p99: percentile(99),
  };
}

/**
 * Aggregate validation failure metrics
 */
function aggregateValidationFailures(metrics: Metric[]): ValidationFailureStats {
  const validationMetrics = metrics.filter((m): m is any => m.metricType === 'validation.failure');
  
  const byType: Record<string, number> = {};
  let critical = 0;

  for (const metric of validationMetrics) {
    byType[metric.data.validationType] = (byType[metric.data.validationType] || 0) + 1;
    if (metric.data.critical) critical++;
  }

  return {
    total: validationMetrics.length,
    critical,
    byType,
  };
}

/**
 * Aggregate retry metrics
 */
function aggregateRetries(metrics: Metric[]): RetryStats {
  const retryMetrics = metrics.filter((m): m is any => m.metricType === 'retry');
  
  const byReason: Record<string, number> = {};
  const requestAttempts = new Map<string, number>();

  for (const metric of retryMetrics) {
    byReason[metric.data.reason] = (byReason[metric.data.reason] || 0) + 1;
    
    const key = `${metric.dimensions.provider}-${metric.dimensions.model}`;
    requestAttempts.set(key, Math.max(requestAttempts.get(key) || 0, metric.data.attempt));
  }

  const totalRetries = retryMetrics.length;
  const uniqueRequests = requestAttempts.size;
  const avgRetries = uniqueRequests > 0 ? totalRetries / uniqueRequests : 0;

  return {
    total: totalRetries,
    requestsWithRetries: uniqueRequests,
    avgRetries,
    byReason,
  };
}

/**
 * Aggregate hallucination metrics
 */
function aggregateHallucinations(metrics: Metric[]): HallucinationStats {
  const hallucinationMetrics = metrics.filter((m): m is any => m.metricType === 'hallucination');
  
  const scores = hallucinationMetrics.map((m) => m.data.score);
  const detections = hallucinationMetrics.filter((m) => m.data.detected).length;

  let low = 0, medium = 0, high = 0;
  for (const score of scores) {
    if (score < 0.3) low++;
    else if (score < 0.7) medium++;
    else high++;
  }

  const stats = calculateNumericStats(scores);

  return {
    total: hallucinationMetrics.length,
    detections,
    detectionRate: hallucinationMetrics.length > 0 ? detections / hallucinationMetrics.length : 0,
    avgScore: stats.avg,
    scoreDistribution: { low, medium, high },
  };
}

/**
 * Aggregate provider failure metrics
 */
function aggregateProviderFailures(metrics: Metric[]): ProviderFailureStats {
  const failureMetrics = metrics.filter((m): m is any => m.metricType === 'provider.failure');
  
  const byStage: Record<string, number> = {};
  const attempts = failureMetrics.map((m) => m.data.attempts);

  for (const metric of failureMetrics) {
    byStage[metric.data.stage] = (byStage[metric.data.stage] || 0) + 1;
  }

  const stats = calculateNumericStats(attempts);

  return {
    total: failureMetrics.length,
    byStage,
    avgAttempts: stats.avg,
  };
}

/**
 * Aggregate latency metrics
 */
function aggregateLatency(metrics: Metric[]): LatencyStats {
  const latencyMetrics = metrics.filter((m): m is any => m.metricType === 'latency');
  
  const durations = latencyMetrics.map((m) => m.data.duration);
  const byStage: Record<string, number[]> = {};

  for (const metric of latencyMetrics) {
    if (!byStage[metric.data.stage]) {
      byStage[metric.data.stage] = [];
    }
    byStage[metric.data.stage].push(metric.data.duration);
  }

  const byStageStats: Record<string, NumericStats> = {};
  for (const [stage, values] of Object.entries(byStage)) {
    byStageStats[stage] = calculateNumericStats(values);
  }

  return {
    ...calculateNumericStats(durations),
    byStage: byStageStats,
  };
}

/**
 * Aggregate token usage metrics
 */
function aggregateTokenUsage(metrics: Metric[]): TokenUsageStats {
  const tokenMetrics = metrics.filter((m): m is any => m.metricType === 'token.usage');
  
  const totalPromptTokens = tokenMetrics.reduce((acc, m) => acc + m.data.promptTokens, 0);
  const totalCompletionTokens = tokenMetrics.reduce((acc, m) => acc + m.data.completionTokens, 0);
  const totalTokens = tokenMetrics.reduce((acc, m) => acc + m.data.totalTokens, 0);

  const count = tokenMetrics.length;

  return {
    totalPromptTokens,
    totalCompletionTokens,
    totalTokens,
    avgPerRequest: {
      promptTokens: count > 0 ? totalPromptTokens / count : 0,
      completionTokens: count > 0 ? totalCompletionTokens / count : 0,
      totalTokens: count > 0 ? totalTokens / count : 0,
    },
  };
}

/**
 * Aggregate confidence metrics
 */
function aggregateConfidence(metrics: Metric[]): ConfidenceStats {
  const confidenceMetrics = metrics.filter((m): m is any => m.metricType === 'confidence');
  
  const scores = confidenceMetrics.map((m) => m.data.score);
  const bySource: Record<string, number[]> = {};

  for (const metric of confidenceMetrics) {
    if (!bySource[metric.data.source]) {
      bySource[metric.data.source] = [];
    }
    bySource[metric.data.source].push(metric.data.score);
  }

  let low = 0, medium = 0, high = 0;
  for (const score of scores) {
    if (score < 0.3) low++;
    else if (score < 0.7) medium++;
    else high++;
  }

  const bySourceStats: Record<string, NumericStats> = {};
  for (const [source, values] of Object.entries(bySource)) {
    bySourceStats[source] = calculateNumericStats(values);
  }

  const stats = calculateNumericStats(scores);

  return {
    total: confidenceMetrics.length,
    avg: stats.avg,
    distribution: { low, medium, high },
    bySource: bySourceStats,
  };
}

/**
 * Metrics aggregator
 */
export class MetricsAggregator {
  /**
   * Aggregate metrics by dimensions
   */
  aggregateByDimensions(
    metrics: Metric[],
    dimensions: MetricDimensions
  ): AggregatedMetrics {
    const filtered = metrics.filter((m) => {
      if (dimensions.provider && m.dimensions.provider !== dimensions.provider) return false;
      if (dimensions.model && m.dimensions.model !== dimensions.model) return false;
      if (dimensions.requestType && m.dimensions.requestType !== dimensions.requestType) return false;
      return true;
    });

    const timestamps = filtered.map((m) => m.timestamp);
    const timeRange = timestamps.length > 0
      ? { start: Math.min(...timestamps), end: Math.max(...timestamps) }
      : { start: 0, end: 0 };

    return {
      dimensions,
      timeRange,
      validationFailures: aggregateValidationFailures(filtered),
      retries: aggregateRetries(filtered),
      hallucinations: aggregateHallucinations(filtered),
      providerFailures: aggregateProviderFailures(filtered),
      latency: aggregateLatency(filtered),
      tokenUsage: aggregateTokenUsage(filtered),
      confidence: aggregateConfidence(filtered),
    };
  }

  /**
   * Aggregate metrics by provider
   */
  aggregateByProvider(metrics: Metric[], provider: string): AggregatedMetrics {
    return this.aggregateByDimensions(metrics, { provider });
  }

  /**
   * Aggregate metrics by model
   */
  aggregateByModel(metrics: Metric[], model: string): AggregatedMetrics {
    return this.aggregateByDimensions(metrics, { model });
  }

  /**
   * Aggregate metrics by request type
   */
  aggregateByRequestType(metrics: Metric[], requestType: string): AggregatedMetrics {
    return this.aggregateByDimensions(metrics, { requestType });
  }

  /**
   * Get all unique providers
   */
  getUniqueProviders(metrics: Metric[]): string[] {
    const providers = new Set<string>();
    for (const metric of metrics) {
      if (metric.dimensions.provider) {
        providers.add(metric.dimensions.provider);
      }
    }
    return Array.from(providers);
  }

  /**
   * Get all unique models
   */
  getUniqueModels(metrics: Metric[]): string[] {
    const models = new Set<string>();
    for (const metric of metrics) {
      if (metric.dimensions.model) {
        models.add(metric.dimensions.model);
      }
    }
    return Array.from(models);
  }

  /**
   * Get all unique request types
   */
  getUniqueRequestTypes(metrics: Metric[]): string[] {
    const types = new Set<string>();
    for (const metric of metrics) {
      if (metric.dimensions.requestType) {
        types.add(metric.dimensions.requestType);
      }
    }
    return Array.from(types);
  }

  /**
   * Aggregate all metrics grouped by provider
   */
  aggregateAllByProvider(metrics: Metric[]): Map<string, AggregatedMetrics> {
    const providers = this.getUniqueProviders(metrics);
    const result = new Map<string, AggregatedMetrics>();

    for (const provider of providers) {
      result.set(provider, this.aggregateByProvider(metrics, provider));
    }

    return result;
  }

  /**
   * Aggregate all metrics grouped by model
   */
  aggregateAllByModel(metrics: Metric[]): Map<string, AggregatedMetrics> {
    const models = this.getUniqueModels(metrics);
    const result = new Map<string, AggregatedMetrics>();

    for (const model of models) {
      result.set(model, this.aggregateByModel(metrics, model));
    }

    return result;
  }
}

/**
 * Global metrics aggregator instance
 */
export const metricsAggregator = new MetricsAggregator();
