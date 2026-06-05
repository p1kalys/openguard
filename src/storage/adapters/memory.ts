/**
 * In-memory storage adapters
 *
 * All three adapters keep data in plain JavaScript Maps / Arrays.
 * They are:
 *   - Zero-dependency
 *   - Runtime-agnostic (browser, Node, Deno, Bun)
 *   - Suitable for testing, development, and short-lived serverless functions
 *
 * Data does not survive process restarts.  For persistent storage use the
 * file adapter or a database-backed adapter.
 */

import type { Trace } from '../../tracing/types.js';
import type { Metric } from '../../metrics/types.js';
import type { DebugSnapshot } from '../../debug/types.js';
import type {
  ITraceStore,
  IMetricStore,
  ISnapshotStore,
  TraceQuery,
  MetricQuery,
  SnapshotQuery,
  PagedResult,
} from '../types.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Slice an already-filtered, already-sorted array into a `PagedResult`.
 * `offset` defaults to 0; `limit` defaults to 100.
 */
function paginate<T>(items: T[], offset = 0, limit = 100): PagedResult<T> {
  const total = items.length;
  const sliced = items.slice(offset, offset + limit);
  return { items: sliced, total, offset, limit, hasMore: offset + limit < total };
}

/** Return true when `timestamp` is within the inclusive range [start, end]. */
function inRange(timestamp: number, range: { start: number; end: number }): boolean {
  return timestamp >= range.start && timestamp <= range.end;
}

// ---------------------------------------------------------------------------
// MemoryTraceStore
// ---------------------------------------------------------------------------

/**
 * In-memory `ITraceStore` backed by a `Map<traceId, Trace>`.
 *
 * Query complexity: O(n) scan over all stored traces.
 * Results are returned newest-first (descending `startTime`).
 */
export class MemoryTraceStore implements ITraceStore {
  private readonly _map = new Map<string, Trace>();

  async saveTrace(trace: Trace): Promise<void> {
    this._map.set(trace.traceId, trace);
  }

  async getTrace(traceId: string): Promise<Trace | undefined> {
    return this._map.get(traceId);
  }

  async queryTraces(query: TraceQuery = {}): Promise<PagedResult<Trace>> {
    let items: Trace[] = [...this._map.values()];

    if (query.requestId !== undefined) {
      items = items.filter((t) => t.requestId === query.requestId);
    }
    if (query.status !== undefined) {
      items = items.filter((t) => t.status === query.status);
    }
    if (query.provider !== undefined) {
      items = items.filter((t) => t.provider?.name === query.provider);
    }
    if (query.model !== undefined) {
      items = items.filter((t) => t.provider?.model === query.model);
    }
    if (query.timeRange !== undefined) {
      items = items.filter((t) => inRange(t.startTime, query.timeRange!));
    }

    items.sort((a, b) => b.startTime - a.startTime);
    return paginate(items, query.offset, query.limit);
  }

  async deleteTrace(traceId: string): Promise<boolean> {
    return this._map.delete(traceId);
  }

  async clear(): Promise<void> {
    this._map.clear();
  }

  /** Number of traces currently held. Useful for diagnostics. */
  size(): number {
    return this._map.size;
  }
}

// ---------------------------------------------------------------------------
// MemoryMetricStore
// ---------------------------------------------------------------------------

/**
 * In-memory `IMetricStore` backed by a plain array.
 *
 * Metrics are append-only: there is no update or delete method.
 * Query complexity: O(n) scan.
 * Results are returned newest-first (descending `timestamp`).
 */
export class MemoryMetricStore implements IMetricStore {
  private _metrics: Metric[] = [];

  async saveMetric(metric: Metric): Promise<void> {
    this._metrics.push(metric);
  }

  async saveMetrics(metrics: Metric[]): Promise<void> {
    for (const m of metrics) this._metrics.push(m);
  }

  async queryMetrics(query: MetricQuery = {}): Promise<PagedResult<Metric>> {
    let items: Metric[] = [...this._metrics];

    if (query.metricTypes?.length) {
      const allowed = new Set(query.metricTypes);
      items = items.filter((m) => allowed.has(m.metricType));
    }
    if (query.dimensions) {
      const { provider, model, requestType } = query.dimensions;
      if (provider     !== undefined) items = items.filter((m) => m.dimensions.provider     === provider);
      if (model        !== undefined) items = items.filter((m) => m.dimensions.model        === model);
      if (requestType  !== undefined) items = items.filter((m) => m.dimensions.requestType  === requestType);
    }
    if (query.timeRange !== undefined) {
      items = items.filter((m) => inRange(m.timestamp, query.timeRange!));
    }

    items.sort((a, b) => b.timestamp - a.timestamp);
    return paginate(items, query.offset, query.limit);
  }

  async clear(): Promise<void> {
    this._metrics = [];
  }

  /** Number of metric events currently held. */
  size(): number {
    return this._metrics.length;
  }
}

// ---------------------------------------------------------------------------
// MemorySnapshotStore
// ---------------------------------------------------------------------------

/**
 * In-memory `ISnapshotStore` backed by a `Map<id, DebugSnapshot>`.
 *
 * Query complexity: O(n) scan.
 * Results are returned newest-first (descending `capturedAt`).
 */
export class MemorySnapshotStore implements ISnapshotStore {
  private readonly _map = new Map<string, DebugSnapshot>();

  async saveSnapshot(snapshot: DebugSnapshot): Promise<void> {
    this._map.set(snapshot.id, snapshot);
  }

  async getSnapshot(id: string): Promise<DebugSnapshot | undefined> {
    return this._map.get(id);
  }

  async querySnapshots(query: SnapshotQuery = {}): Promise<PagedResult<DebugSnapshot>> {
    let items: DebugSnapshot[] = [...this._map.values()];

    if (query.requestId !== undefined) {
      items = items.filter((s) => s.requestId === query.requestId);
    }
    if (query.status !== undefined) {
      items = items.filter((s) => s.status === query.status);
    }
    if (query.provider !== undefined) {
      items = items.filter((s) => s.provider === query.provider);
    }
    if (query.model !== undefined) {
      items = items.filter((s) => s.model === query.model);
    }
    if (query.tags?.length) {
      // All supplied tags must be present (AND semantics)
      items = items.filter((s) =>
        query.tags!.every((tag) => s.tags?.includes(tag))
      );
    }
    if (query.timeRange !== undefined) {
      items = items.filter((s) => inRange(s.capturedAt, query.timeRange!));
    }

    items.sort((a, b) => b.capturedAt - a.capturedAt);
    return paginate(items, query.offset, query.limit);
  }

  async deleteSnapshot(id: string): Promise<boolean> {
    return this._map.delete(id);
  }

  async clear(): Promise<void> {
    this._map.clear();
  }

  /** Number of snapshots currently held. */
  size(): number {
    return this._map.size;
  }
}
