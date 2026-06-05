/**
 * OpenGuard Storage Abstraction Layer
 *
 * Pluggable persistence for OpenGuard's three observability pillars:
 * traces, metrics, and debug snapshots.
 *
 * ── Sub-path import (tree-shakable) ─────────────────────────────────────────
 * ```ts
 * import { createMemoryStorage, createFileStorage, StorageRegistry } from 'openguard/storage';
 * import type { ITraceStore, IMetricStore, ISnapshotStore, TraceQuery } from 'openguard/storage';
 * ```
 *
 * ── Implementing a custom backend ───────────────────────────────────────────
 * Implement one or more of the store interfaces and pass them to StorageRegistry:
 * ```ts
 * import type { ITraceStore } from 'openguard/storage';
 *
 * class ClickHouseTraceStore implements ITraceStore {
 *   async saveTrace(trace: Trace) { ... }
 *   async getTrace(id: string)    { ... }
 *   async queryTraces(q?)         { ... }
 *   async deleteTrace(id: string) { ... }
 *   async clear()                 { ... }
 * }
 *
 * const storage = new StorageRegistry({ traces: new ClickHouseTraceStore(client) });
 * ```
 */

// Core interfaces and query types
export type {
  TimeRange,
  PagedResult,
  TraceQuery,
  MetricQuery,
  SnapshotQuery,
  ITraceStore,
  IMetricStore,
  ISnapshotStore,
  IObservabilityStore,
} from './types.js';

// In-memory adapters
export { MemoryTraceStore, MemoryMetricStore, MemorySnapshotStore } from './adapters/memory.js';

// File-based adapters (Node.js only)
export { FileTraceStore, FileMetricStore, FileSnapshotStore } from './adapters/file.js';

// Registry and factories
export {
  StorageRegistry,
  createMemoryStorage,
  createFileStorage,
  observabilityStorage,
} from './registry.js';
export type { StorageRegistryOptions } from './registry.js';
