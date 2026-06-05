# OpenGuard Reliability Metrics Engine

A provider-agnostic metrics system for tracking reliability metrics without vendor lock-in telemetry systems.

## Overview

The metrics engine provides comprehensive tracking of reliability metrics across all OpenGuard operations, with support for aggregation by provider, model, and request type.

## Tracked Metrics

- **Validation Failures** - Track validation failures by type and severity
- **Retry Counts** - Monitor retry attempts and reasons
- **Hallucination Rates** - Track hallucination detection scores and rates
- **Provider Failures** - Monitor provider failures by stage
- **Latency** - Track operation latency with percentiles
- **Token Usage** - Monitor token consumption
- **Confidence Scores** - Track confidence score distributions

## Usage

### Enable Automatic Metric Collection

```typescript
import { enableEventMetrics } from 'openguard';

// Enable automatic metric collection from events
enableEventMetrics();
```

### Manual Metric Recording

```typescript
import { metricsCollector } from 'openguard';

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
```

### Aggregate Metrics

```typescript
import { metricsAggregator, metricsCollector } from 'openguard';

// Get all metrics
const metrics = metricsCollector.getAll();

// Aggregate by provider
const openaiMetrics = metricsAggregator.aggregateByProvider(metrics, 'openai');

// Aggregate by model
const gpt4Metrics = metricsAggregator.aggregateByModel(metrics, 'gpt-4');

// Aggregate by request type
const completionMetrics = metricsAggregator.aggregateByRequestType(metrics, 'completion');

// Aggregate all by provider
const allByProvider = metricsAggregator.aggregateAllByProvider(metrics);
for (const [provider, aggregated] of allByProvider) {
  console.log(`${provider}:`, aggregated);
}
```

### Access Aggregated Metrics

```typescript
// Access latency statistics
console.log('Average latency:', aggregated.latency.avg);
console.log('P95 latency:', aggregated.latency.p95);
console.log('P99 latency:', aggregated.latency.p99);

// Access token usage
console.log('Total tokens:', aggregated.tokenUsage.totalTokens);
console.log('Avg per request:', aggregated.tokenUsage.avgPerRequest);

// Access validation failures
console.log('Total failures:', aggregated.validationFailures.total);
console.log('By type:', aggregated.validationFailures.byType);

// Access hallucination stats
console.log('Detection rate:', aggregated.hallucinations.detectionRate);
console.log('Average score:', aggregated.hallucinations.avgScore);
```

### Filter Metrics

```typescript
import { metricsCollector } from 'openguard';

// Filter by time range
const recentMetrics = metricsCollector.getFiltered({
  timeRange: {
    start: Date.now() - 3600000, // Last hour
    end: Date.now(),
  },
});

// Filter by dimensions
const providerMetrics = metricsCollector.getFiltered({
  dimensions: { provider: 'openai' },
});

// Filter by metric type
const latencyMetrics = metricsCollector.getFiltered({
  metricTypes: ['latency'],
});
```

## Metric Dimensions

Metrics can be aggregated by:

- **Provider** - The AI provider (e.g., 'openai', 'anthropic', 'gemini')
- **Model** - The specific model (e.g., 'gpt-4', 'claude-3-opus')
- **Request Type** - The type of operation (e.g., 'completion', 'validation')

## Normalized Metric Structures

All aggregated metrics follow a consistent structure:

```typescript
interface AggregatedMetrics {
  dimensions: MetricDimensions;
  timeRange: { start: number; end: number };
  validationFailures: ValidationFailureStats;
  retries: RetryStats;
  hallucinations: HallucinationStats;
  providerFailures: ProviderFailureStats;
  latency: LatencyStats;
  tokenUsage: TokenUsageStats;
  confidence: ConfidenceStats;
}
```

## Provider-Agnostic Design

The metrics engine is designed to be provider-agnostic:

- No vendor-specific telemetry SDKs
- Normalized metric structures across all providers
- Flexible dimension system for any provider
- No vendor lock-in

## Best Practices

1. **Enable event metrics** for automatic collection
2. **Use dimensions** consistently for better aggregation
3. **Regular aggregation** to prevent unbounded metric growth
4. **Filter by time range** for relevant metrics
5. **Monitor percentiles** (P95, P99) for latency outliers

## Example: Custom Monitoring

```typescript
import { metricsCollector, metricsAggregator, enableEventMetrics } from 'openguard';

// Enable automatic collection
enableEventMetrics();

// Periodically check metrics
setInterval(() => {
  const metrics = metricsCollector.getAll();
  const aggregated = metricsAggregator.aggregateByDimensions(metrics, {});

  // Alert on high failure rate
  if (aggregated.validationFailures.total > 10) {
    console.warn('High validation failure rate detected');
  }

  // Alert on slow latency
  if (aggregated.latency.p95 > 5000) {
    console.warn('High P95 latency detected');
  }

  // Clear old metrics
  metricsCollector.clear();
}, 60000); // Every minute
```

## Example: Provider Comparison

```typescript
import { metricsAggregator, metricsCollector } from 'openguard';

const metrics = metricsCollector.getAll();
const byProvider = metricsAggregator.aggregateAllByProvider(metrics);

for (const [provider, aggregated] of byProvider) {
  console.log(`\n=== ${provider} ===`);
  console.log(`Avg Latency: ${aggregated.latency.avg}ms`);
  console.log(`P95 Latency: ${aggregated.latency.p95}ms`);
  console.log(`Total Tokens: ${aggregated.tokenUsage.totalTokens}`);
  console.log(`Validation Failures: ${aggregated.validationFailures.total}`);
  console.log(`Hallucination Rate: ${(aggregated.hallucinations.detectionRate * 100).toFixed(2)}%`);
}
```
