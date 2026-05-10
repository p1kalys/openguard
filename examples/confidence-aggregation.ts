/**
 * Example usage of OpenGuard confidence aggregation system
 */

import {
  quickConfidenceAggregation,
  createConfidenceAggregator,
  aggregateFromValidationSources,
  ConfidenceAggregationEngine,
  DEFAULT_CONFIDENCE_CONFIG
} from '../src/confidence/index.js';
import { ConfidenceScore, ConfidenceSource } from '../src/confidence/types.js';

async function demonstrateConfidenceAggregation() {
  console.log('=== OpenGuard Confidence Aggregation Examples ===\n');

  // Example 1: Basic confidence aggregation
  console.log('1. Basic Confidence Aggregation:');
  console.log('='.repeat(50));

  const scores1: ConfidenceScore[] = [
    { source: 'schema_validation' as ConfidenceSource, rawScore: 0.8, weight: 0.2, weightedScore: 0.16 },
    { source: 'semantic_validation' as ConfidenceSource, rawScore: 0.9, weight: 0.2, weightedScore: 0.18 },
    { source: 'hallucination_check' as ConfidenceSource, rawScore: 0.7, weight: 0.15, weightedScore: 0.105 },
    { source: 'grounding_validation' as ConfidenceSource, rawScore: 0.85, weight: 0.1, weightedScore: 0.085 },
  ];

  try {
    const result1 = quickConfidenceAggregation(scores1);
    console.log(`✅ Aggregation completed`);
    console.log(`Aggregated Score: ${result1.aggregatedScore.toFixed(3)}`);
    console.log(`Confidence Level: ${result1.confidenceLevel}`);
    console.log(`Strategy: ${result1.strategy}`);
    console.log(`Sources: ${result1.metadata.sourceCount}`);
    console.log(`Processing Time: ${result1.metadata.processingTime}ms`);
  } catch (error) {
    console.log(`❌ Aggregation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Example 2: Custom aggregation strategy
  console.log('2. Custom Aggregation Strategy - Harmonic Mean:');
  console.log('='.repeat(50));

  const customConfig = {
    strategy: 'harmonic_mean' as const,
    sourceWeights: {
      schema_validation: 0.3,
      repair_operation: 0.15,
      retry_operation: 0.1,
      semantic_validation: 0.25,
      hallucination_check: 0.2,
      grounding_validation: 0.15,
      self_verification: 0.1,
      reliability_scoring: 0.1,
    },
    minThreshold: 0.1,
    maxThreshold: 0.95,
    normalizeScores: true,
  };

  const scores2: ConfidenceScore[] = [
    { source: 'schema_validation' as ConfidenceSource, rawScore: 0.6, weight: 0.3, weightedScore: 0.18 },
    { source: 'semantic_validation' as ConfidenceSource, rawScore: 0.8, weight: 0.25, weightedScore: 0.2 },
    { source: 'hallucination_check' as ConfidenceSource, rawScore: 0.5, weight: 0.2, weightedScore: 0.1 },
    { source: 'grounding_validation' as ConfidenceSource, rawScore: 0.9, weight: 0.15, weightedScore: 0.135 },
    { source: 'reliability_scoring' as ConfidenceSource, rawScore: 0.7, weight: 0.1, weightedScore: 0.07 },
  ];

  try {
    const aggregator = createConfidenceAggregator(customConfig);
    const result2 = aggregator.aggregateConfidence(scores2);
    console.log(`Aggregated Score: ${result2.aggregatedScore.toFixed(3)}`);
    console.log(`Confidence Level: ${result2.confidenceLevel}`);
    console.log(`Strategy: ${result2.strategy}`);
    console.log(`Breakdown:`);
    console.log(`  Weighted Average: ${result2.breakdown.weightedAverage?.toFixed(3)}`);
    console.log(`  Harmonic Mean: ${result2.breakdown.harmonicMean?.toFixed(3)}`);
    console.log(`  Normalized: ${result2.metadata.normalized}`);
  } catch (error) {
    console.log(`❌ Custom aggregation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Example 3: Aggregation from validation sources
  console.log('3. Aggregation from Validation Sources:');
  console.log('='.repeat(50));

  const validationResults = {
    schemaValidation: {
      score: 0.85,
      issues: [{ severity: 'low', description: 'Minor schema issue' }],
    },
    semanticValidation: {
      passed: true,
      issues: [{ severity: 'medium', description: 'Semantic inconsistency' }],
    },
    hallucinationCheck: {
      hallucinationScore: 0.3,
      isHallucinated: false,
      issues: [{ severity: 'low', description: 'Potential speculation' }],
    },
    groundingValidation: {
      passed: true,
      issues: [],
    },
    reliabilityScoring: {
      score: 0.75,
      issues: [{ severity: 'medium', description: 'Reliability concern' }],
    },
  };

  try {
    const result3 = aggregateFromValidationSources(validationResults);
    console.log(`Aggregated Score: ${result3.aggregatedScore.toFixed(3)}`);
    console.log(`Confidence Level: ${result3.confidenceLevel}`);
    console.log(`Sources Included: ${result3.metadata.sourceCount}`);

    // Show individual scores
    console.log('\n📊 Individual Scores:');
    result3.individualScores.forEach((score: any, index: number) => {
      console.log(`  ${index + 1}. ${score.source}: ${score.rawScore.toFixed(3)} (weight: ${score.weight})`);
    });

    // Show source contributions
    const contributions = new ConfidenceAggregationEngine().calculateSourceContributions(result3.individualScores);
    console.log('\n💡 Source Contributions:');
    Object.entries(contributions).forEach(([source, contribution]) => {
      console.log(`  ${source}: ${contribution.toFixed(1)}%`);
    });
  } catch (error) {
    console.log(`❌ Validation aggregation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Example 4: Minimum strategy with thresholds
  console.log('4. Minimum Strategy with Thresholds:');
  console.log('='.repeat(50));

  const minConfig = {
    strategy: 'minimum' as const,
    sourceWeights: DEFAULT_CONFIDENCE_CONFIG.sourceWeights,
    minThreshold: 0.3,
    maxThreshold: 0.9,
  };

  const scores4: ConfidenceScore[] = [
    { source: 'schema_validation' as ConfidenceSource, rawScore: 0.2, weight: 0.2, weightedScore: 0.04 },
    { source: 'semantic_validation' as ConfidenceSource, rawScore: 0.4, weight: 0.2, weightedScore: 0.08 },
    { source: 'hallucination_check' as ConfidenceSource, rawScore: 0.1, weight: 0.15, weightedScore: 0.015 },
    { source: 'grounding_validation' as ConfidenceSource, rawScore: 0.8, weight: 0.1, weightedScore: 0.08 },
    { source: 'reliability_scoring' as ConfidenceSource, rawScore: 0.05, weight: 0.1, weightedScore: 0.005 },
  ];

  try {
    const minAggregator = createConfidenceAggregator(minConfig);
    const result4 = minAggregator.aggregateConfidence(scores4);
    console.log(`Aggregated Score: ${result4.aggregatedScore.toFixed(3)}`);
    console.log(`Confidence Level: ${result4.confidenceLevel}`);
    console.log(`Excluded Sources: ${result4.metadata.excludedSources.join(', ')}`);
    console.log(`Minimum Score: ${result4.breakdown.minimum?.toFixed(3)}`);
  } catch (error) {
    console.log(`❌ Minimum aggregation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Example 5: Custom aggregation function
  console.log('5. Custom Aggregation Function:');
  console.log('='.repeat(50));

  const customAggregator = createConfidenceAggregator({
    strategy: 'custom' as const,
    sourceWeights: DEFAULT_CONFIDENCE_CONFIG.sourceWeights,
    customAggregator: (scores) => {
      // Custom logic: prioritize highest scores but penalize outliers
      const validScores = scores.filter((s: any) => s.rawScore > 0.5);
      if (validScores.length === 0) return 0;

      const mean = validScores.reduce((sum: number, s: any) => sum + s.weightedScore, 0) / validScores.length;
      const max = Math.max(...validScores.map((s: any) => s.weightedScore));
      const outliers = validScores.filter((s: any) => Math.abs(s.weightedScore - mean) > 0.2);

      // Penalize for outliers
      const outlierPenalty = outliers.length * 0.1;
      return Math.max(0, max - outlierPenalty);
    },
  });

  const scores5: ConfidenceScore[] = [
    { source: 'schema_validation' as ConfidenceSource, rawScore: 0.9, weight: 0.2, weightedScore: 0.18 },
    { source: 'semantic_validation' as ConfidenceSource, rawScore: 0.8, weight: 0.2, weightedScore: 0.16 },
    { source: 'hallucination_check' as ConfidenceSource, rawScore: 0.95, weight: 0.15, weightedScore: 0.1425 },
    { source: 'grounding_validation' as ConfidenceSource, rawScore: 0.85, weight: 0.1, weightedScore: 0.085 },
    { source: 'reliability_scoring' as ConfidenceSource, rawScore: 0.3, weight: 0.1, weightedScore: 0.03 },
  ];

  try {
    const result5 = customAggregator.aggregateConfidence(scores5);
    console.log(`Aggregated Score: ${result5.aggregatedScore.toFixed(3)}`);
    console.log(`Confidence Level: ${result5.confidenceLevel}`);
    console.log(`Custom Result: ${result5.breakdown.custom?.toFixed(3)}`);
    console.log(`Explanation: ${customAggregator.explainResult(result5)}`);
  } catch (error) {
    console.log(`❌ Custom aggregation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Example 6: Explainability and debugging
  console.log('6. Explainability and Debugging:');
  console.log('='.repeat(50));

  const debugScores: ConfidenceScore[] = [
    { source: 'schema_validation' as ConfidenceSource, rawScore: 0.6, weight: 0.2, weightedScore: 0.12 },
    { source: 'semantic_validation' as ConfidenceSource, rawScore: 0.3, weight: 0.2, weightedScore: 0.06 },
    { source: 'hallucination_check' as ConfidenceSource, rawScore: 0.9, weight: 0.15, weightedScore: 0.135 },
    { source: 'grounding_validation' as ConfidenceSource, rawScore: 0.1, weight: 0.1, weightedScore: 0.01 },
  ];

  try {
    const debugAggregator = createConfidenceAggregator({
      strategy: 'weighted_average' as const,
      sourceWeights: DEFAULT_CONFIDENCE_CONFIG.sourceWeights,
      normalizeScores: false,
    });

    const debugResult = debugAggregator.aggregateConfidence(debugScores);
    console.log(`Aggregated Score: ${debugResult.aggregatedScore.toFixed(3)}`);
    console.log(`Confidence Level: ${debugResult.confidenceLevel}`);

    // Show detailed explanation
    const explanation = debugAggregator.explainResult(debugResult);
    console.log(`\n📋 Detailed Explanation:`);
    console.log(explanation);

    // Show source contributions
    const debugContributions = debugAggregator.calculateSourceContributions(debugScores);
    console.log(`\n💰 Source Contributions:`);
    Object.entries(debugContributions).forEach(([source, contribution]) => {
      console.log(`  ${source}: ${contribution.toFixed(1)}%`);
    });
  } catch (error) {
    console.log(`❌ Debug aggregation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎯 Confidence Aggregation Examples Complete!');
  console.log('\nKey features demonstrated:');
  console.log('✅ Multiple aggregation strategies');
  console.log('✅ Configurable source weights');
  console.log('✅ Threshold-based filtering');
  console.log('✅ Score normalization');
  console.log('✅ Custom aggregation functions');
  console.log('✅ Detailed breakdown and explainability');
  console.log('✅ Source contribution analysis');
  console.log('✅ Deterministic scoring methodology');
  console.log('✅ Integration with validation sources');
}

// Run demonstration
demonstrateConfidenceAggregation().catch(console.error);

export { demonstrateConfidenceAggregation };
