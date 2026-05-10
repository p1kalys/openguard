/**
 * Reliability scoring system for OpenGuard
 * Provides normalized confidence scores based on various quality metrics
 */

import { NormalizedResponse, NormalizedUsage } from '../types/normalized.js';
import { FinishReason } from '../types/types.js';

/**
 * Individual scoring factor results
 */
export interface ScoringFactor {
  /** Factor name */
  name: string;
  /** Score for this factor (0-1) */
  score: number;
  /** Weight applied to this factor */
  weight: number;
  /** Detailed metadata about the scoring */
  metadata: Record<string, any>;
}

/**
 * Schema validation scoring metadata
 */
export interface SchemaValidationMetadata {
  /** Whether JSON parsing succeeded */
  isValidJson: boolean;
  /** Whether schema validation passed */
  isValidSchema: boolean;
  /** Number of validation errors */
  errorCount: number;
  /** Validation error details */
  errors?: string[];
}

/**
 * Repair scoring metadata
 */
export interface RepairMetadata {
  /** Number of repair attempts */
  repairCount: number;
  /** Whether repair was successful */
  repairSuccessful: boolean;
  /** Original error type */
  originalError?: string;
}

/**
 * Retry scoring metadata
 */
export interface RetryMetadata {
  /** Number of retry attempts */
  retryCount: number;
  /** Maximum retries allowed */
  maxRetries: number;
  /** Whether retries were exhausted */
  retriesExhausted: boolean;
}

/**
 * Provider finish reason scoring metadata
 */
export interface FinishReasonMetadata {
  /** The finish reason */
  finishReason: FinishReason;
  /** Whether it's a successful finish */
  isSuccessful: boolean;
  /** Whether it was truncated */
  isTruncated: boolean;
}

/**
 * Response completeness scoring metadata
 */
export interface CompletenessMetadata {
  /** Response text length */
  responseLength: number;
  /** Expected minimum length */
  expectedMinLength: number;
  /** Whether response meets minimum length */
  meetsMinLength: boolean;
  /** Whether response appears complete */
  appearsComplete: boolean;
  /** Token usage ratio (output/total) */
  tokenUsageRatio?: number;
}

/**
 * Complete reliability scoring result
 */
export interface ReliabilityScore {
  /** Overall normalized score (0-1) */
  score: number;
  /** Confidence level classification */
  confidence: 'low' | 'medium' | 'high';
  /** Individual factor scores */
  factors: ScoringFactor[];
  /** Overall scoring metadata */
  metadata: {
    /** Timestamp of scoring */
    timestamp: number;
    /** Response being scored */
    response: NormalizedResponse;
    /** Scoring configuration used */
    config: ScoringConfig;
  };
}

/**
 * Scoring configuration
 */
export interface ScoringConfig {
  /** Weights for each scoring factor (should sum to 1) */
  weights: {
    schemaValidation: number;
    repair: number;
    retry: number;
    finishReason: number;
    completeness: number;
  };
  /** Thresholds for classification */
  thresholds: {
    low: number;
    medium: number;
  };
  /** Schema validation settings */
  schema: {
    /** Expected JSON schema (optional) */
    expectedSchema?: any;
    /** Whether to require valid JSON */
    requireValidJson: boolean;
  };
  /** Completeness settings */
  completeness: {
    /** Minimum expected response length */
    minLength: number;
    /** Whether to consider token usage */
    considerTokenUsage: boolean;
  };
}

/**
 * Scoring context for additional metadata
 */
export interface ScoringContext {
  /** Number of repair attempts */
  repairCount?: number;
  /** Original error that triggered repair */
  originalError?: string;
  /** Number of retry attempts */
  retryCount?: number;
  /** Maximum retries allowed */
  maxRetries?: number;
}

/**
 * Default scoring configuration
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: {
    schemaValidation: 0.3,
    repair: 0.2,
    retry: 0.15,
    finishReason: 0.2,
    completeness: 0.15,
  },
  thresholds: {
    low: 0.4,
    medium: 0.7,
  },
  schema: {
    requireValidJson: false,
  },
  completeness: {
    minLength: 10,
    considerTokenUsage: true,
  },
};
