/**
 * Reliability metrics type definitions
 */

/**
 * Metric aggregation dimensions
 */
export interface MetricDimensions {
  /** Provider name (e.g., 'openai', 'anthropic') */
  provider?: string;
  /** Model name (e.g., 'gpt-4', 'claude-3') */
  model?: string;
  /** Request type (e.g., 'completion', 'validation') */
  requestType?: string;
}

/**
 * Base metric structure
 */
export interface BaseMetric {
  /** Timestamp when metric was recorded */
  timestamp: number;
  /** Dimensions for aggregation */
  dimensions: MetricDimensions;
}

/**
 * Validation failure metric
 */
export interface ValidationFailureMetric extends BaseMetric {
  metricType: 'validation.failure';
  data: {
    /** Validation type that failed */
    validationType: string;
    /** Error message */
    error?: string;
    /** Whether this was a critical failure */
    critical: boolean;
  };
}

/**
 * Retry count metric
 */
export interface RetryMetric extends BaseMetric {
  metricType: 'retry';
  data: {
    /** Attempt number */
    attempt: number;
    /** Maximum retries allowed */
    maxRetries: number;
    /** Reason for retry */
    reason: string;
    /** Delay before next retry in milliseconds */
    delay: number;
  };
}

/**
 * Hallucination rate metric
 */
export interface HallucinationMetric extends BaseMetric {
  metricType: 'hallucination';
  data: {
    /** Hallucination score (0-1) */
    score: number;
    /** Whether hallucination was detected */
    detected: boolean;
    /** Confidence level */
    confidence: number;
  };
}

/**
 * Provider failure metric
 */
export interface ProviderFailureMetric extends BaseMetric {
  metricType: 'provider.failure';
  data: {
    /** Stage where failure occurred */
    stage: 'provider' | 'validation' | 'normalization' | 'timeout' | 'unknown';
    /** Error message */
    error: string;
    /** Total attempts before failure */
    attempts: number;
  };
}

/**
 * Latency metric
 */
export interface LatencyMetric extends BaseMetric {
  metricType: 'latency';
  data: {
    /** Duration in milliseconds */
    duration: number;
    /** Operation stage */
    stage: 'total' | 'provider' | 'validation' | 'normalization';
  };
}

/**
 * Token usage metric
 */
export interface TokenUsageMetric extends BaseMetric {
  metricType: 'token.usage';
  data: {
    /** Prompt tokens used */
    promptTokens: number;
    /** Completion tokens used */
    completionTokens: number;
    /** Total tokens used */
    totalTokens: number;
  };
}

/**
 * Confidence score metric
 */
export interface ConfidenceMetric extends BaseMetric {
  metricType: 'confidence';
  data: {
    /** Confidence score (0-1) */
    score: number;
    /** Source of confidence score */
    source: string;
  };
}

/**
 * Union type of all metrics
 */
export type Metric =
  | ValidationFailureMetric
  | RetryMetric
  | HallucinationMetric
  | ProviderFailureMetric
  | LatencyMetric
  | TokenUsageMetric
  | ConfidenceMetric;

/**
 * Aggregated statistics for numeric metrics
 */
export interface NumericStats {
  /** Count of samples */
  count: number;
  /** Sum of values */
  sum: number;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Average value */
  avg: number;
  /** Median value */
  median: number;
  /** 95th percentile */
  p95: number;
  /** 99th percentile */
  p99: number;
}

/**
 * Aggregated validation failure stats
 */
export interface ValidationFailureStats {
  /** Total validation failures */
  total: number;
  /** Critical failures */
  critical: number;
  /** Failures by validation type */
  byType: Record<string, number>;
}

/**
 * Aggregated retry stats
 */
export interface RetryStats {
  /** Total retry attempts */
  total: number;
  /** Requests that required retries */
  requestsWithRetries: number;
  /** Average retries per request */
  avgRetries: number;
  /** Retries by reason */
  byReason: Record<string, number>;
}

/**
 * Aggregated hallucination stats
 */
export interface HallucinationStats {
  /** Total hallucination checks */
  total: number;
  /** Detections */
  detections: number;
  /** Detection rate */
  detectionRate: number;
  /** Average score */
  avgScore: number;
  /** Score distribution */
  scoreDistribution: {
    low: number;    // 0-0.3
    medium: number; // 0.3-0.7
    high: number;   // 0.7-1.0
  };
}

/**
 * Aggregated provider failure stats
 */
export interface ProviderFailureStats {
  /** Total failures */
  total: number;
  /** Failures by stage */
  byStage: Record<string, number>;
  /** Average attempts before failure */
  avgAttempts: number;
}

/**
 * Aggregated latency stats
 */
export interface LatencyStats extends NumericStats {
  /** Latency by stage */
  byStage: Record<string, NumericStats>;
}

/**
 * Aggregated token usage stats
 */
export interface TokenUsageStats {
  /** Total prompt tokens */
  totalPromptTokens: number;
  /** Total completion tokens */
  totalCompletionTokens: number;
  /** Total tokens */
  totalTokens: number;
  /** Average per request */
  avgPerRequest: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Aggregated confidence stats
 */
export interface ConfidenceStats {
  /** Total confidence scores */
  total: number;
  /** Average confidence */
  avg: number;
  /** Score distribution */
  distribution: {
    low: number;    // 0-0.3
    medium: number; // 0.3-0.7
    high: number;   // 0.7-1.0
  };
  /** By source */
  bySource: Record<string, NumericStats>;
}

/**
 * Complete aggregated metrics
 */
export interface AggregatedMetrics {
  /** Dimensions for this aggregation */
  dimensions: MetricDimensions;
  /** Time range */
  timeRange: {
    start: number;
    end: number;
  };
  /** Validation failure stats */
  validationFailures: ValidationFailureStats;
  /** Retry stats */
  retries: RetryStats;
  /** Hallucination stats */
  hallucinations: HallucinationStats;
  /** Provider failure stats */
  providerFailures: ProviderFailureStats;
  /** Latency stats */
  latency: LatencyStats;
  /** Token usage stats */
  tokenUsage: TokenUsageStats;
  /** Confidence stats */
  confidence: ConfidenceStats;
}

/**
 * Metric filter options
 */
export interface MetricFilter {
  /** Time range */
  timeRange?: {
    start: number;
    end: number;
  };
  /** Dimension filters */
  dimensions?: MetricDimensions;
  /** Metric types to include */
  metricTypes?: Metric['metricType'][];
}
