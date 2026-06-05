# Observability Query API

Sub-path import: `openguard/query`

Framework-agnostic query layer over a `StorageRegistry`. Provides normalized analytics for traces, metrics, validation failures, hallucination reports, and per-provider reliability.

## Quick Start

```ts
import { ObservabilityQueryEngine } from 'openguard/query';
import { createFileStorage } from 'openguard/storage';

const storage = createFileStorage('./data/openguard');
const engine  = new ObservabilityQueryEngine(storage);
```

## Query Methods

### `queryTraces(filter)`

```ts
const result = await engine.queryTraces({
  provider:    'openai',
  timeRange:   { start: Date.now() - 3_600_000, end: Date.now() },
  offset: 0,
  limit:  20,
});
// result: PagedResult<Trace> + analytics: { avgDurationMs, p95DurationMs, successRate, ... }
```

### `queryMetrics(filter)`

```ts
const result = await engine.queryMetrics({
  provider:   'openai',
  model:      'gpt-4o',
  metricType: 'latency',
  timeRange:  { start: ..., end: ... },
});
// result: PagedResult<Metric> + summary statistics
```

### `queryValidationFailures(filter)`

Returns paginated validation failure metrics with aggregated counts by `validationType`.

```ts
const result = await engine.queryValidationFailures({ provider: 'openai' });
```

### `queryHallucinationReports(filter)`

Returns paginated hallucination metrics with aggregate score statistics.

```ts
const result = await engine.queryHallucinationReports({
  timeRange: { start: ..., end: ... },
});
```

### `queryProviderReliability(filter?)`

Returns per-provider reliability summaries: `totalRequests`, `successRate`, `retryRate`, `avgDurationMs`, `p95DurationMs`, `hallucinationRate`, `validationFailureRate`.

```ts
const reliability = await engine.queryProviderReliability();
// reliability: Record<string, ProviderReliabilitySummary>
```

## Filter Shape (`ObservabilityFilter`)

```ts
interface ObservabilityFilter {
  provider?:    string;
  model?:       string;
  requestType?: string;
  metricType?:  string;
  timeRange?:   { start: number; end: number };
  offset?:      number;   // default 0
  limit?:       number;   // default 50
}
```

## Notes

- `queryTraces` issues two parallel store queries: one over the full matching set for analytics, one at the requested `offset`/`limit` for the page items. This ensures `total` is always accurate regardless of pagination position.
- Retry counting uses `attempt === 1` events as the proxy for "distinct retried requests" (consistent with the 1-based attempt convention in the event system).
- `queryProviderReliability` reports `totalRequests = 0` (not `1`) for providers that exist in the metrics store but have no associated traces.
