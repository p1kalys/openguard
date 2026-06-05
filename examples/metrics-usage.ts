/**
 * Example usage of the OpenGuard Reliability Metrics Engine
 * 
 * This example demonstrates how to use the metrics engine for tracking
 * reliability metrics across OpenGuard operations.
 */

import {
  metricsCollector,
  metricsAggregator,
  enableEventMetrics,
  disableEventMetrics,
} from '../src/metrics/index.js';

// Example 1: Enable automatic metric collection
console.log('=== Example 1: Enable Automatic Metric Collection ===');
enableEventMetrics();
console.log('Automatic metric collection enabled');

// Example 2: Manual metric recording
console.log('\n=== Example 2: Manual Metric Recording ===');

// Record validation failure
metricsCollector.recordValidationFailure(
  { provider: 'openai', model: 'gpt-4' },
  'schema',
  'Invalid JSON structure',
  true
);

// Record latency
metricsCollector.recordLatency(
  { provider: 'openai', model: 'gpt-4' },
  1250,
  'total'
);

// Record token usage
metricsCollector.recordTokenUsage(
  { provider: 'openai', model: 'gpt-4' },
  100,
  200,
  300
);

// Record retry
metricsCollector.recordRetry(
  { provider: 'openai', model: 'gpt-4' },
  2,
  3,
  'Rate limit exceeded',
  2000
);

// Record hallucination check
metricsCollector.recordHallucination(
  { provider: 'openai', model: 'gpt-4' },
  0.15,
  false,
  0.85
);

// Record confidence score
metricsCollector.recordConfidence(
  { provider: 'openai', model: 'gpt-4' },
  0.92,
  'validation'
);

console.log('Metrics recorded successfully');

// Example 3: Aggregate metrics by provider
console.log('\n=== Example 3: Aggregate by Provider ===');
const metrics = metricsCollector.getAll();
const openaiMetrics = metricsAggregator.aggregateByProvider(metrics, 'openai');

console.log('OpenAI Metrics:');
console.log(`  Total Metrics: ${metrics.length}`);
console.log(`  Average Latency: ${openaiMetrics.latency.avg.toFixed(2)}ms`);
console.log(`  P95 Latency: ${openaiMetrics.latency.p95.toFixed(2)}ms`);
console.log(`  Total Tokens: ${openaiMetrics.tokenUsage.totalTokens}`);
console.log(`  Validation Failures: ${openaiMetrics.validationFailures.total}`);

// Example 4: Aggregate metrics by model
console.log('\n=== Example 4: Aggregate by Model ===');
const gpt4Metrics = metricsAggregator.aggregateByModel(metrics, 'gpt-4');

console.log('GPT-4 Metrics:');
console.log(`  Average Latency: ${gpt4Metrics.latency.avg.toFixed(2)}ms`);
console.log(`  Token Usage (avg): ${gpt4Metrics.tokenUsage.avgPerRequest.totalTokens.toFixed(0)} tokens/request`);
console.log(`  Hallucination Detection Rate: ${(gpt4Metrics.hallucinations.detectionRate * 100).toFixed(2)}%`);

// Example 5: Aggregate all metrics by provider
console.log('\n=== Example 5: Aggregate All by Provider ===');

// Add some metrics for another provider
metricsCollector.recordLatency({ provider: 'anthropic', model: 'claude-3' }, 980, 'total');
metricsCollector.recordTokenUsage({ provider: 'anthropic', model: 'claude-3' }, 150, 180, 330);

const allMetrics = metricsCollector.getAll();
const byProvider = metricsAggregator.aggregateAllByProvider(allMetrics);

for (const [provider, aggregated] of byProvider) {
  console.log(`\n${provider}:`);
  console.log(`  Avg Latency: ${aggregated.latency.avg.toFixed(2)}ms`);
  console.log(`  Total Tokens: ${aggregated.tokenUsage.totalTokens}`);
  console.log(`  Validation Failures: ${aggregated.validationFailures.total}`);
}

// Example 6: Filter metrics by time range
console.log('\n=== Example 6: Filter by Time Range ===');
const oneHourAgo = Date.now() - 3600000;
const recentMetrics = metricsCollector.getFiltered({
  timeRange: {
    start: oneHourAgo,
    end: Date.now(),
  },
});
console.log(`Metrics in last hour: ${recentMetrics.length}`);

// Example 7: Filter metrics by dimensions
console.log('\n=== Example 7: Filter by Dimensions ===');
const providerMetrics = metricsCollector.getFiltered({
  dimensions: { provider: 'openai' },
});
console.log(`OpenAI metrics: ${providerMetrics.length}`);

const modelMetrics = metricsCollector.getFiltered({
  dimensions: { model: 'gpt-4' },
});
console.log(`GPT-4 metrics: ${modelMetrics.length}`);

// Example 8: Filter metrics by type
console.log('\n=== Example 8: Filter by Metric Type ===');
const latencyMetrics = metricsCollector.getFiltered({
  metricTypes: ['latency'],
});
console.log(`Latency metrics: ${latencyMetrics.length}`);

const validationMetrics = metricsCollector.getFiltered({
  metricTypes: ['validation.failure'],
});
console.log(`Validation failure metrics: ${validationMetrics.length}`);

// Example 9: Get unique values
console.log('\n=== Example 9: Get Unique Values ===');
const providers = metricsAggregator.getUniqueProviders(allMetrics);
const models = metricsAggregator.getUniqueModels(allMetrics);
const requestTypes = metricsAggregator.getUniqueRequestTypes(allMetrics);

console.log(`Unique providers: ${providers.join(', ')}`);
console.log(`Unique models: ${models.join(', ')}`);
console.log(`Unique request types: ${requestTypes.join(', ')}`);

// Example 10: Custom monitoring with alerts
console.log('\n=== Example 10: Custom Monitoring ===');

function checkMetrics() {
  const metrics = metricsCollector.getAll();
  const aggregated = metricsAggregator.aggregateByDimensions(metrics, {});

  // Alert on high failure rate
  if (aggregated.validationFailures.total > 5) {
    console.warn('⚠️  High validation failure rate detected');
  }

  // Alert on slow latency
  if (aggregated.latency.p95 > 3000) {
    console.warn('⚠️  High P95 latency detected');
  }

  // Alert on high hallucination rate
  if (aggregated.hallucinations.detectionRate > 0.2) {
    console.warn('⚠️  High hallucination detection rate');
  }

  console.log('✅ Metrics check complete');
}

checkMetrics();

// Example 11: Clear metrics
console.log('\n=== Example 11: Clear Metrics ===');
console.log(`Metrics before clear: ${metricsCollector.count()}`);
metricsCollector.clear();
console.log(`Metrics after clear: ${metricsCollector.count()}`);

// Example 12: Disable automatic collection
console.log('\n=== Example 12: Disable Automatic Collection ===');
disableEventMetrics();
console.log('Automatic metric collection disabled');

console.log('\n=== Metrics Engine Examples Complete ===');
