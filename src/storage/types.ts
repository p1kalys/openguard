/**
 * Storage abstraction interfaces for OpenGuard observability data
 *
 * Three orthogonal store interfaces cover the three observability pillars:
 *
 *   ITraceStore    — structured request traces with span trees
 *   IMetricStore   — append-only metric events
 *   ISnapshotStore — full pipeline debug snapshots
 *
 * Each interface is intentionally minimal so that third-party adapters (SQL,
 * ClickHouse, S3, Redis, …) can implement exactly what they support without
 * being forced to provide no-op stubs for the rest.
 *
 * A backend that covers all three pillars should implement IObservabilityStore,
 * which is simply the union of all three.
 *
 * Query types use plain filter objects — no fluent builders — to stay
 * portable across backend capabilities.
 */

import type { Trace, SpanStatus } from '../tracing/types.js';
import type { Metric, MetricDimensions } from '../metrics/types.js';
import type { DebugSnapshot, SnapshotStatus } from '../debug/types.js';

// ---------------------------------------------------------------------------
// Shared utility types
// ---------------------------------------------------------------------------

/** Inclusive unix-millisecond time range used by all three query types. */
export interface TimeRange {
  /** Lower bound (inclusive). Unix ms. */
  start: number;
  /** Upper bound (inclusive). Unix ms. */
  end: number;
}

/**
 * Standard pagination envelope returned by every `query*` method.
 *
 * `total` reflects the count *before* pagination so callers can compute
 * page counts without needing a separate `count()` call.
 */
export interface PagedResult<T> {
  items: T[];
  /** Total number of records matching the query (before slicing). */
  total: number;
  /** Echo of the applied offset. */
  offset: number;
  /** Echo of the effective limit (may be lower than requested if capped by backend). */
  limit: number;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Query types
// ---------------------------------------------------------------------------

/** Filter criteria for trace queries. All fields are optional and ANDed. */
export interface TraceQuery {
  /** Match traces whose `requestId` equals this value. */
  requestId?: string;
  /** Match traces with this terminal status. */
  status?: SpanStatus;
  /** Match traces where `provider.name` equals this value. */
  provider?: string;
  /** Match traces where `provider.model` equals this value. */
  model?: string;
  /** Keep only traces whose `startTime` falls inside this range. */
  timeRange?: TimeRange;
  /** Number of records to skip. Default: 0. */
  offset?: number;
  /** Maximum records to return. Default: 100. */
  limit?: number;
}

/** Filter criteria for metric queries. All fields are optional and ANDed. */
export interface MetricQuery {
  /**
   * Keep only metrics whose `metricType` is in this list.
   * An empty array is treated as "no filter" (all types returned).
   */
  metricTypes?: Metric['metricType'][];
  /**
   * Keep only metrics whose `dimensions` match every supplied field.
   * Omitted dimension fields are treated as wildcards.
   */
  dimensions?: Partial<MetricDimensions>;
  /** Keep only metrics whose `timestamp` falls inside this range. */
  timeRange?: TimeRange;
  /** Number of records to skip. Default: 0. */
  offset?: number;
  /** Maximum records to return. Default: 100. */
  limit?: number;
}

/** Filter criteria for snapshot queries. All fields are optional and ANDed. */
export interface SnapshotQuery {
  /** Match snapshots whose `requestId` equals this value. */
  requestId?: string;
  /** Match snapshots with this terminal status. */
  status?: SnapshotStatus;
  /** Match snapshots where `provider` equals this value. */
  provider?: string;
  /** Match snapshots where `model` equals this value. */
  model?: string;
  /**
   * Keep only snapshots that carry **all** of the supplied tags
   * (i.e. tags act as an AND filter, not OR).
   */
  tags?: string[];
  /** Keep only snapshots whose `capturedAt` falls inside this range. */
  timeRange?: TimeRange;
  /** Number of records to skip. Default: 0. */
  offset?: number;
  /** Maximum records to return. Default: 100. */
  limit?: number;
}

// ---------------------------------------------------------------------------
// Store interfaces
// ---------------------------------------------------------------------------

/**
 * Persistence interface for request traces.
 *
 * Implementing notes for custom backends:
 * - Use `traceId` as the primary key.
 * - `queryTraces` must return newest-first (descending `startTime`) by default.
 * - `deleteTrace` should return `false` (not throw) when the ID is unknown.
 */
export interface ITraceStore {
  /** Persist or overwrite a completed trace. */
  saveTrace(trace: Trace): Promise<void>;
  /** Retrieve a single trace by its `traceId`. Returns `undefined` if not found. */
  getTrace(traceId: string): Promise<Trace | undefined>;
  /** Query traces with optional filtering and pagination. */
  queryTraces(query?: TraceQuery): Promise<PagedResult<Trace>>;
  /** Remove a trace by `traceId`. Returns `true` when deleted, `false` when not found. */
  deleteTrace(traceId: string): Promise<boolean>;
  /** Remove all stored traces. */
  clear(): Promise<void>;
}

/**
 * Persistence interface for observability metrics.
 *
 * Implementing notes for custom backends:
 * - Metrics are append-only; there is intentionally no update or delete.
 * - `queryMetrics` must return newest-first (descending `timestamp`) by default.
 * - `saveMetrics` should be treated as an atomic batch — either all succeed or none do.
 */
export interface IMetricStore {
  /** Append a single metric event. */
  saveMetric(metric: Metric): Promise<void>;
  /** Append a batch of metric events. Prefer this over repeated `saveMetric` calls. */
  saveMetrics(metrics: Metric[]): Promise<void>;
  /** Query metrics with optional filtering and pagination. */
  queryMetrics(query?: MetricQuery): Promise<PagedResult<Metric>>;
  /** Remove all stored metrics. */
  clear(): Promise<void>;
}

/**
 * Persistence interface for debug pipeline snapshots.
 *
 * Implementing notes for custom backends:
 * - Use `id` as the primary key.
 * - `querySnapshots` must return newest-first (descending `capturedAt`) by default.
 * - `deleteSnapshot` should return `false` (not throw) when the ID is unknown.
 */
export interface ISnapshotStore {
  /** Persist or overwrite a debug snapshot. */
  saveSnapshot(snapshot: DebugSnapshot): Promise<void>;
  /** Retrieve a single snapshot by its `id`. Returns `undefined` if not found. */
  getSnapshot(id: string): Promise<DebugSnapshot | undefined>;
  /** Query snapshots with optional filtering and pagination. */
  querySnapshots(query?: SnapshotQuery): Promise<PagedResult<DebugSnapshot>>;
  /** Remove a snapshot by `id`. Returns `true` when deleted, `false` when not found. */
  deleteSnapshot(id: string): Promise<boolean>;
  /** Remove all stored snapshots. */
  clear(): Promise<void>;
}

/**
 * Combined interface for backends that implement all three observability pillars
 * in a single class (e.g. a PostgreSQL adapter with three tables, or an HTTP
 * collector that forwards everything to one endpoint).
 */
export interface IObservabilityStore extends ITraceStore, IMetricStore, ISnapshotStore {}
