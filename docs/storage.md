# Storage Abstraction Layer

Sub-path import: `openguard/storage`

Pluggable storage backends for traces, metrics, and debug snapshots. Two adapters ship out of the box; the interface is designed for extension to PostgreSQL, ClickHouse, S3, or any other backend.

## Adapters

| Adapter | Description |
|---------|-------------|
| In-memory | `Map`/`Array`-backed; data lives for process lifetime. Good for development and testing. |
| File-based | NDJSON file for metrics; per-record JSON files for traces and snapshots. Good for local persistence and CLI tools. |

## Storage Registry

```ts
import {
  createMemoryStorage,
  createFileStorage,
  observabilityStorage,   // process-wide singleton (in-memory)
} from 'openguard/storage';

const mem  = createMemoryStorage();
const file = createFileStorage('./data/openguard');
```

### `StorageRegistry` shape

```ts
interface StorageRegistry {
  traces:    ITraceStore;
  metrics:   IMetricStore;
  snapshots: ISnapshotStore;
}
```

## Event-driven Auto-persist

`attachStorageToEvents` wires a `StorageRegistry` to the global event bus so traces are persisted automatically whenever a request completes or fails.

```ts
import { attachStorageToEvents } from 'openguard/storage';
import { eventEmitter } from 'openguard/events';

const storage   = createFileStorage('./data/openguard');
const { detach } = attachStorageToEvents(eventEmitter, storage);

// On shutdown:
detach();
```

> **Order matters**: `attachStorageToEvents` registers the tracing integration first so the trace is fully finalized before the storage handler runs.

## One-shot Flush Helpers

```ts
import {
  flushMetricsToStore,
  flushTracesToStore,
} from 'openguard/storage';
import { metricsCollector } from 'openguard/metrics';
import { globalTracer } from 'openguard/tracing';

await flushMetricsToStore(metricsCollector.getAll(), storage.metrics);
await flushTracesToStore(globalTracer, storage.traces);
```

## Store Interfaces

All stores follow these query patterns:

```ts
// ITraceStore
store.saveTrace(trace)
store.queryTraces(query: TraceQuery): Promise<PagedResult<Trace>>
store.getTrace(traceId): Promise<Trace | undefined>

// IMetricStore
store.saveMetrics(metrics[])
store.queryMetrics(query: MetricQuery): Promise<PagedResult<Metric>>
store.compact(keepFn)              // FileMetricStore only

// ISnapshotStore
store.saveSnapshot(snapshot)
store.querySnapshots(query: SnapshotQuery): Promise<PagedResult<DebugSnapshot>>
```

### `PagedResult<T>`

```ts
interface PagedResult<T> {
  items:   T[];
  total:   number;
  offset:  number;
  limit:   number;
  hasMore: boolean;
}
```

## Custom Backend

Implement `ITraceStore`, `IMetricStore`, and/or `ISnapshotStore` and pass instances to `new StorageRegistry(...)`:

```ts
import { StorageRegistry } from 'openguard/storage';

const registry = new StorageRegistry(
  new MyPostgresTraceStore(pool),
  new MyPostgresMetricStore(pool),
  createMemoryStorage().snapshots,   // keep snapshots in-memory
);
```
