/**
 * Main reliability scoring orchestrator
 */

// Re-export types and constants
export {
  ReliabilityScore,
  ScoringConfig,
  DEFAULT_SCORING_CONFIG,
  ScoringFactor,
  ScoringContext,
  SchemaValidationMetadata,
  RepairMetadata,
  RetryMetadata,
  FinishReasonMetadata,
  CompletenessMetadata
} from './types.js';

import {
  ReliabilityScore,
  ScoringConfig,
  DEFAULT_SCORING_CONFIG,
  ScoringFactor,
  ScoringContext
} from './types.js';
import { NormalizedResponse } from '../types/normalized.js';
import {
  scoreSchemaValidation,
  scoreRepair,
  scoreRetry,
  scoreFinishReason,
  scoreCompleteness
} from './scorers.js';

/**
 * Calculate reliability score for a normalized response
 */
export function calculateReliabilityScore(
  response: NormalizedResponse,
  config: Partial<ScoringConfig> = {},
  context: ScoringContext = {}
): ReliabilityScore {
  const finalConfig = { ...DEFAULT_SCORING_CONFIG, ...config };

  // Calculate individual factor scores
  const factors: ScoringFactor[] = [
    scoreSchemaValidation(response, finalConfig),
    scoreRepair(response, finalConfig, context.repairCount, context.originalError),
    scoreRetry(response, context.retryCount || 0, context.maxRetries || 3, finalConfig),
    scoreFinishReason(response, finalConfig),
    scoreCompleteness(response, finalConfig),
  ];

  // Calculate weighted average score
  let totalScore = 0;
  let totalWeight = 0;

  for (const factor of factors) {
    totalScore += factor.score * factor.weight;
    totalWeight += factor.weight;
  }

  const normalizedScore = totalWeight > 0 ? totalScore / totalWeight : 0;

  // Determine confidence level
  let confidence: 'low' | 'medium' | 'high';
  if (normalizedScore >= finalConfig.thresholds.medium) {
    confidence = 'high';
  } else if (normalizedScore >= finalConfig.thresholds.low) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    score: Math.round(normalizedScore * 10000) / 10000, // Round to 4 decimal places
    confidence,
    factors,
    metadata: {
      timestamp: Date.now(),
      response,
      config: finalConfig,
    },
  };
}

/**
 * Quick scoring function with minimal parameters
 */
export function quickScore(
  response: NormalizedResponse,
  context?: ScoringContext
): ReliabilityScore {
  return calculateReliabilityScore(response, {}, context);
}

/**
 * Batch scoring for multiple responses
 */
export function batchScore(
  responses: NormalizedResponse[],
  config: Partial<ScoringConfig> = {},
  contexts?: ScoringContext[]
): ReliabilityScore[] {
  return responses.map((response, index) =>
    calculateReliabilityScore(
      response,
      config,
      contexts?.[index] || {}
    )
  );
}

/**
 * Get average score from a batch of scores
 */
export function getAverageScore(scores: ReliabilityScore[]): number {
  if (scores.length === 0) return 0;

  const total = scores.reduce((sum, score) => sum + score.score, 0);
  return Math.round((total / scores.length) * 10000) / 10000;
}

/**
 * Filter scores by confidence level
 */
export function filterByConfidence(
  scores: ReliabilityScore[],
  confidence: 'low' | 'medium' | 'high'
): ReliabilityScore[] {
  return scores.filter(score => score.confidence === confidence);
}

/**
 * Get scoring summary statistics
 */
export interface ScoringSummary {
  total: number;
  average: number;
  min: number;
  max: number;
  high: number;
  medium: number;
  low: number;
}

export function getScoringSummary(scores: ReliabilityScore[]): ScoringSummary {
  if (scores.length === 0) {
    return {
      total: 0,
      average: 0,
      min: 0,
      max: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
  }

  const scoreValues = scores.map(s => s.score);

  return {
    total: scores.length,
    average: getAverageScore(scores),
    min: Math.min(...scoreValues),
    max: Math.max(...scoreValues),
    high: filterByConfidence(scores, 'high').length,
    medium: filterByConfidence(scores, 'medium').length,
    low: filterByConfidence(scores, 'low').length,
  };
}
