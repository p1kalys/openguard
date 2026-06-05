/**
 * Metrics collector for reliability tracking
 */

import type {
  Metric,
  MetricDimensions,
  MetricFilter,
  ValidationFailureMetric,
  RetryMetric,
  HallucinationMetric,
  ProviderFailureMetric,
  LatencyMetric,
  TokenUsageMetric,
  ConfidenceMetric,
} from './types.js';

/**
 * Metrics collector that stores and aggregates metrics
 */
export class MetricsCollector {
  private metrics: Metric[] = [];
  private maxMetrics: number;

  constructor(maxMetrics: number = 10000) {
    this.maxMetrics = maxMetrics;
  }

  /**
   * Record a metric
   */
  record(metric: Metric): void {
    this.metrics.push(metric);

    // Prevent unbounded growth
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  /**
   * Record validation failure
   */
  recordValidationFailure(
    dimensions: MetricDimensions,
    validationType: string,
    error?: string,
    critical: boolean = false
  ): void {
    const metric: ValidationFailureMetric = {
      timestamp: Date.now(),
      dimensions,
      metricType: 'validation.failure',
      data: {
        validationType,
        error,
        critical,
      },
    };
    this.record(metric);
  }

  /**
   * Record retry
   */
  recordRetry(
    dimensions: MetricDimensions,
    attempt: number,
    maxRetries: number,
    reason: string,
    delay: number
  ): void {
    const metric: RetryMetric = {
      timestamp: Date.now(),
      dimensions,
      metricType: 'retry',
      data: {
        attempt,
        maxRetries,
        reason,
        delay,
      },
    };
    this.record(metric);
  }

  /**
   * Record hallucination check
   */
  recordHallucination(
    dimensions: MetricDimensions,
    score: number,
    detected: boolean,
    confidence: number
  ): void {
    const metric: HallucinationMetric = {
      timestamp: Date.now(),
      dimensions,
      metricType: 'hallucination',
      data: {
        score,
        detected,
        confidence,
      },
    };
    this.record(metric);
  }

  /**
   * Record provider failure
   */
  recordProviderFailure(
    dimensions: MetricDimensions,
    stage: ProviderFailureMetric['data']['stage'],
    error: string,
    attempts: number
  ): void {
    const metric: ProviderFailureMetric = {
      timestamp: Date.now(),
      dimensions,
      metricType: 'provider.failure',
      data: {
        stage,
        error,
        attempts,
      },
    };
    this.record(metric);
  }

  /**
   * Record latency
   */
  recordLatency(
    dimensions: MetricDimensions,
    duration: number,
    stage: LatencyMetric['data']['stage'] = 'total'
  ): void {
    const metric: LatencyMetric = {
      timestamp: Date.now(),
      dimensions,
      metricType: 'latency',
      data: {
        duration,
        stage,
      },
    };
    this.record(metric);
  }

  /**
   * Record token usage
   */
  recordTokenUsage(
    dimensions: MetricDimensions,
    promptTokens: number,
    completionTokens: number,
    totalTokens: number
  ): void {
    const metric: TokenUsageMetric = {
      timestamp: Date.now(),
      dimensions,
      metricType: 'token.usage',
      data: {
        promptTokens,
        completionTokens,
        totalTokens,
      },
    };
    this.record(metric);
  }

  /**
   * Record confidence score
   */
  recordConfidence(
    dimensions: MetricDimensions,
    score: number,
    source: string
  ): void {
    const metric: ConfidenceMetric = {
      timestamp: Date.now(),
      dimensions,
      metricType: 'confidence',
      data: {
        score,
        source,
      },
    };
    this.record(metric);
  }

  /**
   * Get all metrics
   */
  getAll(): Metric[] {
    return [...this.metrics];
  }

  /**
   * Get filtered metrics
   */
  getFiltered(filter: MetricFilter): Metric[] {
    let filtered = this.metrics;

    if (filter.timeRange) {
      filtered = filtered.filter(
        (m) => m.timestamp >= filter.timeRange!.start && m.timestamp <= filter.timeRange!.end
      );
    }

    if (filter.dimensions) {
      filtered = filtered.filter((m) => {
        const d = filter.dimensions!;
        if (d.provider && m.dimensions.provider !== d.provider) return false;
        if (d.model && m.dimensions.model !== d.model) return false;
        if (d.requestType && m.dimensions.requestType !== d.requestType) return false;
        return true;
      });
    }

    if (filter.metricTypes) {
      filtered = filtered.filter((m) => filter.metricTypes!.includes(m.metricType));
    }

    return filtered;
  }

  /**
   * Get metrics by dimensions
   */
  getByDimensions(dimensions: MetricDimensions): Metric[] {
    return this.getFiltered({ dimensions });
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Get metrics count
   */
  count(): number {
    return this.metrics.length;
  }
}

/**
 * Global metrics collector instance
 */
export const metricsCollector = new MetricsCollector();
