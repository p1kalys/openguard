# Reliability Metrics Engine

Sub-path import: `openguard/metrics`

Provider-agnostic metrics tracking with aggregation by provider, model, and request type. No vendor telemetry SDKs required.

## Tracked Metric Types

- `validation_failure` — validation failures by type/severity
- `retry` — retry attempts and reasons
- `hallucination` — detection scores and rates
- `provider_failure` — provider errors by stage
- `latency` — operation latency (with P95/P99 percentiles)
- `token_usage` — prompt/completion/total token counts
- `confidence` — confidence score distributions

## Usage

### Automatic Collection (recommended)

```ts
import { enableEventMetrics } from 'openguard/metrics';

enableEventMetrics(); // hooks into the global event emitter
```

### Manual Recording

```ts
import { metricsCollector } from 'openguard/metrics';

metricsCollector.recordValidationFailure(
  { provider: 'openai', model: 'gpt-4' },
  'schema',
  'Invalid JSON structure',
  true                  // wasRetried
);

metricsCollector.recordLatency(
  { provider: 'openai', model: 'gpt-4' },
  1250,                 // ms
  'total'
);

metricsCollector.recordTokenUsage(
  { provider: 'openai', model: 'gpt-4' },
  100, 200, 300         // prompt, completion, total
);
```

### Aggregation

```ts
import { metricsCollector, metricsAggregator } from 'openguard/metrics';

const all = metricsCollector.getAll();

const openai   = metricsAggregator.aggregateByProvider(all, 'openai');
const gpt4     = metricsAggregator.aggregateByModel(all, 'gpt-4');
const byProv   = metricsAggregator.aggregateAllByProvider(all);
```

### Engine (convenience wrapper)

```ts
import { reliabilityMetricsEngine } from 'openguard/metrics';

reliabilityMetricsEngine.recordLatency({ provider: 'openai' }, 200);
const byProvider = reliabilityMetricsEngine.produce(undefined, 'provider');
const openai     = reliabilityMetricsEngine.aggregateByProvider('openai');
```

### Filtering

```ts
const recent = metricsCollector.getFiltered({
  timeRange: { start: Date.now() - 3_600_000, end: Date.now() },
  dimensions: { provider: 'openai' },
  metricTypes: ['latency'],
});
```

## Aggregated Metric Structure

```ts
interface AggregatedMetrics {
  dimensions: MetricDimensions;
  timeRange: { start: number; end: number };
  latency: { avg: number; p95: number; p99: number };
  tokenUsage: { totalTokens: number; avgPerRequest: number };
  validationFailures: { total: number; byType: Record<string, number> };
  retries: RetryStats;
  hallucinations: { detectionRate: number; avgScore: number };
  providerFailures: ProviderFailureStats;
  confidence: ConfidenceStats;
}
```

## Best Practices

- Call `enableEventMetrics()` once at application startup.
- Periodically call `metricsCollector.clear()` in long-running processes to prevent unbounded growth.
- Use P95/P99 latency (not average) to detect tail-latency regressions.
