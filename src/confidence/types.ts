/**
 * Types and interfaces for confidence aggregation engine
 */

/**
 * Source of confidence score
 */
export type ConfidenceSource =
  | 'schema_validation'
  | 'repair_operation'
  | 'retry_operation'
  | 'semantic_validation'
  | 'hallucination_check'
  | 'grounding_validation'
  | 'self_verification'
  | 'reliability_scoring';

/**
 * Individual confidence score from a specific source
 */
export interface ConfidenceScore {
  /** Source of the confidence score */
  source: ConfidenceSource;
  /** Raw confidence value (0-1) */
  rawScore: number;
  /** Weight applied to this score */
  weight: number;
  /** Weighted confidence contribution */
  weightedScore: number;
  /** Additional metadata about the score */
  metadata?: {
    /** Number of issues found */
    issueCount?: number;
    /** Severity of issues */
    severity?: 'low' | 'medium' | 'high' | 'critical';
    /** Processing time in milliseconds */
    processingTime?: number;
    /** Additional source-specific data */
    [key: string]: any;
  };
}

/**
 * Aggregation strategy for combining confidence scores
 */
export type AggregationStrategy =
  | 'weighted_average'
  | 'minimum'
  | 'maximum'
  | 'harmonic_mean'
  | 'geometric_mean'
  | 'custom';

/**
 * Confidence aggregation configuration
 */
export interface ConfidenceAggregationConfig {
  /** Strategy for aggregating scores */
  strategy: AggregationStrategy;
  /** Weights for different sources (sum to 1.0) */
  sourceWeights: Record<ConfidenceSource, number>;
  /** Minimum confidence threshold */
  minThreshold?: number;
  /** Maximum confidence threshold */
  maxThreshold?: number;
  /** Whether to normalize scores before aggregation */
  normalizeScores?: boolean;
  /** Custom aggregation function */
  customAggregator?: (scores: ConfidenceScore[]) => number;
}

/**
 * Detailed aggregation result with breakdown
 */
export interface ConfidenceAggregationResult {
  /** Final aggregated confidence score (0-1) */
  aggregatedScore: number;
  /** Individual scores from each source */
  individualScores: ConfidenceScore[];
  /** Aggregation strategy used */
  strategy: AggregationStrategy;
  /** Confidence level classification */
  confidenceLevel: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  /** Detailed scoring breakdown */
  breakdown: {
    /** Weighted average calculation */
    weightedAverage?: number;
    /** Minimum score */
    minimum?: number;
    /** Maximum score */
    maximum?: number;
    /** Harmonic mean */
    harmonicMean?: number;
    /** Geometric mean */
    geometricMean?: number;
    /** Custom result */
    custom?: number;
  };
  /** Aggregation metadata */
  metadata: {
    /** Timestamp of aggregation */
    timestamp: number;
    /** Processing time in milliseconds */
    processingTime: number;
    /** Number of sources included */
    sourceCount: number;
    /** Sources excluded due to thresholds */
    excludedSources: ConfidenceSource[];
    /** Normalization applied */
    normalized: boolean;
  };
}

/**
 * Default confidence aggregation configuration
 */
export const DEFAULT_CONFIDENCE_CONFIG: ConfidenceAggregationConfig = {
  strategy: 'weighted_average',
  sourceWeights: {
    schema_validation: 0.2,
    repair_operation: 0.15,
    retry_operation: 0.1,
    semantic_validation: 0.2,
    hallucination_check: 0.15,
    grounding_validation: 0.1,
    self_verification: 0.1,
    reliability_scoring: 0.1,
  },
  minThreshold: 0.0,
  maxThreshold: 1.0,
  normalizeScores: false,
};
