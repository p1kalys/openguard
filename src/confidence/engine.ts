/**
 * Core confidence aggregation engine for OpenGuard
 */

import {
  ConfidenceAggregationResult,
  ConfidenceAggregationConfig,
  ConfidenceScore,
  ConfidenceSource,
  DEFAULT_CONFIDENCE_CONFIG
} from './types.js';

/**
 * Confidence aggregation engine
 */
export class ConfidenceAggregationEngine {
  private config: ConfidenceAggregationConfig;

  constructor(config: Partial<ConfidenceAggregationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIDENCE_CONFIG, ...config };
  }

  /**
   * Aggregate confidence scores from multiple sources
   */
  aggregateConfidence(scores: ConfidenceScore[]): ConfidenceAggregationResult {
    const startTime = Date.now();

    // Filter scores by thresholds
    const filteredScores = this.filterScoresByThresholds(scores);

    // Normalize scores if configured
    const normalizedScores = this.config.normalizeScores
      ? this.normalizeScores(filteredScores)
      : filteredScores;

    // Apply aggregation strategy
    const aggregatedScore = this.applyAggregationStrategy(normalizedScores);

    // Calculate confidence level
    const confidenceLevel = this.calculateConfidenceLevel(aggregatedScore);

    // Create detailed breakdown
    const breakdown = this.calculateBreakdown(normalizedScores);

    return {
      aggregatedScore,
      individualScores: scores,
      strategy: this.config.strategy,
      confidenceLevel,
      breakdown,
      metadata: {
        timestamp: Date.now(),
        processingTime: Date.now() - startTime,
        sourceCount: normalizedScores.length,
        excludedSources: scores
          .filter(s => !normalizedScores.includes(s))
          .map(s => s.source),
        normalized: this.config.normalizeScores || false,
      },
    };
  }

  /**
   * Filter scores based on min/max thresholds
   */
  private filterScoresByThresholds(scores: ConfidenceScore[]): ConfidenceScore[] {
    return scores.filter(score => {
      const aboveMin = this.config.minThreshold == null || score.rawScore >= this.config.minThreshold!;
      const belowMax = this.config.maxThreshold == null || score.rawScore <= this.config.maxThreshold!;
      return aboveMin && belowMax;
    });
  }

  /**
   * Normalize scores to 0-1 range
   */
  private normalizeScores(scores: ConfidenceScore[]): ConfidenceScore[] {
    if (scores.length === 0) return scores;

    const rawScores = scores.map(s => s.rawScore);
    const minScore = Math.min(...rawScores);
    const maxScore = Math.max(...rawScores);
    const range = maxScore - minScore;

    if (range === 0) return scores; // All scores are the same

    return scores.map(score => ({
      ...score,
      rawScore: (score.rawScore - minScore) / range,
    }));
  }

  /**
   * Apply aggregation strategy to normalized scores
   */
  private applyAggregationStrategy(scores: ConfidenceScore[]): number {
    if (scores.length === 0) return 0;

    switch (this.config.strategy) {
      case 'weighted_average':
        return this.calculateWeightedAverage(scores);
      case 'minimum':
        return Math.min(...scores.map(s => s.weightedScore));
      case 'maximum':
        return Math.max(...scores.map(s => s.weightedScore));
      case 'harmonic_mean':
        return this.calculateHarmonicMean(scores);
      case 'geometric_mean':
        return this.calculateGeometricMean(scores);
      case 'custom':
        if (this.config.customAggregator) {
          return this.config.customAggregator(scores);
        }
        return this.calculateWeightedAverage(scores); // Fallback
      default:
        return this.calculateWeightedAverage(scores);
    }
  }

  /**
   * Calculate weighted average of scores
   */
  private calculateWeightedAverage(scores: ConfidenceScore[]): number {
    if (scores.length === 0) return 0;

    const totalWeightedScore = scores.reduce((sum, score) => sum + score.weightedScore, 0);
    const totalWeight = scores.reduce((sum, score) => sum + score.weight, 0);

    return totalWeightedScore / totalWeight;
  }

  /**
   * Calculate harmonic mean of scores
   */
  private calculateHarmonicMean(scores: ConfidenceScore[]): number {
    if (scores.length === 0) return 0;

    const reciprocalSum = scores.reduce((sum, score) => sum + (1 / score.weightedScore), 0);
    return scores.length / reciprocalSum;
  }

  /**
   * Calculate geometric mean of scores
   */
  private calculateGeometricMean(scores: ConfidenceScore[]): number {
    if (scores.length === 0) return 0;

    const product = scores.reduce((prod, score) => prod * score.weightedScore, 1);
    return Math.pow(product, 1 / scores.length);
  }

  /**
   * Calculate confidence level classification
   */
  private calculateConfidenceLevel(score: number): 'very_low' | 'low' | 'medium' | 'high' | 'very_high' {
    if (score < 0.2) return 'very_low';
    if (score < 0.4) return 'low';
    if (score < 0.6) return 'medium';
    if (score < 0.8) return 'high';
    return 'very_high';
  }

  /**
   * Calculate detailed breakdown for explainability
   */
  private calculateBreakdown(scores: ConfidenceScore[]): any {
    const breakdown: any = {};

    if (scores.length === 0) return breakdown;

    const weightedScores = scores.map(s => s.weightedScore);

    switch (this.config.strategy) {
      case 'weighted_average':
        breakdown.weightedAverage = this.calculateWeightedAverage(scores);
        break;
      case 'minimum':
        breakdown.minimum = Math.min(...weightedScores);
        break;
      case 'maximum':
        breakdown.maximum = Math.max(...weightedScores);
        break;
      case 'harmonic_mean':
        breakdown.harmonicMean = this.calculateHarmonicMean(scores);
        break;
      case 'geometric_mean':
        breakdown.geometricMean = this.calculateGeometricMean(scores);
        break;
      case 'custom':
        if (this.config.customAggregator) {
          breakdown.custom = this.config.customAggregator(scores);
        }
        break;
    }

    return breakdown;
  }

  /**
   * Add individual confidence score
   */
  addConfidenceScore(
    source: ConfidenceSource,
    rawScore: number,
    metadata?: any
  ): ConfidenceScore {
    const weight = this.config.sourceWeights[source] || 0;
    const weightedScore = rawScore * weight;

    return {
      source,
      rawScore,
      weight,
      weightedScore,
      metadata,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ConfidenceAggregationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): ConfidenceAggregationConfig {
    return { ...this.config };
  }

  /**
   * Calculate contribution of each source to final score
   */
  calculateSourceContributions(scores: ConfidenceScore[]): Record<ConfidenceSource, number> {
    const contributions: Record<ConfidenceSource, number> = {} as any;
    const totalWeightedScore = scores.reduce((sum, score) => sum + score.weightedScore, 0);

    for (const score of scores) {
      if (totalWeightedScore > 0) {
        contributions[score.source] = (score.weightedScore / totalWeightedScore) * 100;
      } else {
        contributions[score.source] = 0;
      }
    }

    return contributions;
  }

  /**
   * Get confidence score for specific source
   */
  getSourceScore(scores: ConfidenceScore[], source: ConfidenceSource): number | null {
    const sourceScore = scores.find(s => s.source === source);
    return sourceScore ? sourceScore.rawScore : null;
  }

  /**
   * Explain aggregation result
   */
  explainResult(result: ConfidenceAggregationResult): string {
    const explanations: string[] = [];

    explanations.push(`Aggregated Score: ${result.aggregatedScore.toFixed(3)}`);
    explanations.push(`Confidence Level: ${result.confidenceLevel}`);
    explanations.push(`Strategy: ${result.strategy}`);
    explanations.push(`Sources: ${result.metadata.sourceCount}`);

    if (result.metadata.excludedSources.length > 0) {
      explanations.push(`Excluded Sources: ${result.metadata.excludedSources.join(', ')}`);
    }

    // Explain breakdown
    if (result.breakdown.weightedAverage !== undefined) {
      explanations.push(`Weighted Average: ${result.breakdown.weightedAverage.toFixed(3)}`);
    }
    if (result.breakdown.minimum !== undefined) {
      explanations.push(`Minimum: ${result.breakdown.minimum.toFixed(3)}`);
    }
    if (result.breakdown.maximum !== undefined) {
      explanations.push(`Maximum: ${result.breakdown.maximum.toFixed(3)}`);
    }
    if (result.breakdown.harmonicMean !== undefined) {
      explanations.push(`Harmonic Mean: ${result.breakdown.harmonicMean.toFixed(3)}`);
    }
    if (result.breakdown.geometricMean !== undefined) {
      explanations.push(`Geometric Mean: ${result.breakdown.geometricMean.toFixed(3)}`);
    }

    return explanations.join(' | ');
  }
}
