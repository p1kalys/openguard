/**
 * StorageRegistry — composite store and factory utilities
 *
 * StorageRegistry holds one adapter per observability pillar and exposes them
 * through a uniform interface.  Because each pillar is independently injected
 * you can mix backends — e.g. traces in memory, metrics on disk — without any
 * special wiring.
 *
 * ── Typical usage ───────────────────────────────────────────────────────────
 *
 * All in memory (zero config):
 * ```ts
 * import { createMemoryStorage } from 'openguard/storage';
 * const storage = createMemoryStorage();
 * await storage.traces.saveTrace(trace);
 * ```
 *
 * All on disk (development / local tooling):
 * ```ts
 * import { createFileStorage } from 'openguard/storage';
 * const storage = createFileStorage('./observability');
 * ```
 *
 * Mixed — hot traces in memory, persistent snapshots on disk:
 * ```ts
 * import { StorageRegistry, MemoryTraceStore, MemoryMetricStore, FileSnapshotStore } from 'openguard/storage';
 * const storage = new StorageRegistry({
 *   traces:    new MemoryTraceStore(),
 *   metrics:   new MemoryMetricStore(),
 *   snapshots: new FileSnapshotStore('./observability'),
 * });
 * ```
 *
 * Custom backend (PostgreSQL, ClickHouse, S3, …):
 * ```ts
 * class PgTraceStore implements ITraceStore { ... }
 * const storage = new StorageRegistry({ traces: new PgTraceStore(pool) });
 * ```
 */

import {
  MemoryTraceStore,
  MemoryMetricStore,
  MemorySnapshotStore,
} from './adapters/memory.js';
import {
  FileTraceStore,
  FileMetricStore,
  FileSnapshotStore,
} from './adapters/file.js';
import type {
  ITraceStore,
  IMetricStore,
  ISnapshotStore,
} from './types.js';

// ---------------------------------------------------------------------------
// StorageRegistry
// ---------------------------------------------------------------------------

export interface StorageRegistryOptions {
  /**
   * Adapter used to store request traces.
   * Defaults to `MemoryTraceStore` when omitted.
   */
  traces?: ITraceStore;
  /**
   * Adapter used to store metric events.
   * Defaults to `MemoryMetricStore` when omitted.
   */
  metrics?: IMetricStore;
  /**
   * Adapter used to store debug pipeline snapshots.
   * Defaults to `MemorySnapshotStore` when omitted.
   */
  snapshots?: ISnapshotStore;
}

/**
 * Composes one `ITraceStore`, one `IMetricStore`, and one `ISnapshotStore`
 * into a single object.
 *
 * The three stores are independent: querying traces never touches the metric
 * or snapshot stores, and vice versa.  `clearAll()` calls `clear()` on all
 * three concurrently.
 */
export class StorageRegistry {
  readonly traces: ITraceStore;
  readonly metrics: IMetricStore;
  readonly snapshots: ISnapshotStore;

  constructor(options: StorageRegistryOptions = {}) {
    this.traces    = options.traces    ?? new MemoryTraceStore();
    this.metrics   = options.metrics   ?? new MemoryMetricStore();
    this.snapshots = options.snapshots ?? new MemorySnapshotStore();
  }

  /**
   * Clear all three stores concurrently.
   * Useful in test teardown or when resetting an observability pipeline.
   */
  async clearAll(): Promise<void> {
    await Promise.all([
      this.traces.clear(),
      this.metrics.clear(),
      this.snapshots.clear(),
    ]);
  }
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/**
 * Create a `StorageRegistry` backed entirely by in-memory adapters.
 *
 * - Zero dependencies, no I/O.
 * - Data is lost on process restart.
 * - Ideal for testing, development, and short-lived containers.
 */
export function createMemoryStorage(): StorageRegistry {
  return new StorageRegistry({
    traces:    new MemoryTraceStore(),
    metrics:   new MemoryMetricStore(),
    snapshots: new MemorySnapshotStore(),
  });
}

/**
 * Create a `StorageRegistry` backed entirely by file adapters.
 *
 * All three adapters share the same `baseDir`:
 * ```
 * {baseDir}/
 *   traces/{traceId}.json
 *   snapshots/{snapshotId}.json
 *   metrics.ndjson
 * ```
 *
 * Node.js-only: this calls `fs.mkdirSync` in the constructors.
 *
 * @param baseDir Absolute or relative path to the root observability directory.
 *   Will be created (with `recursive: true`) if it does not exist.
 */
export function createFileStorage(baseDir: string): StorageRegistry {
  return new StorageRegistry({
    traces:    new FileTraceStore(baseDir),
    metrics:   new FileMetricStore(baseDir),
    snapshots: new FileSnapshotStore(baseDir),
  });
}

// ---------------------------------------------------------------------------
// Global default singleton (in-memory)
// ---------------------------------------------------------------------------

/**
 * Application-wide `StorageRegistry` backed by in-memory adapters.
 *
 * Replace this singleton by re-assigning the module-level exports in your
 * application entry point, or inject your own `StorageRegistry` instance
 * directly into the components that need it.
 *
 * @example
 * ```ts
 * import { observabilityStorage } from 'openguard/storage';
 * // Swap to file-based at startup:
 * // (not possible — import singletons are live bindings in ESM)
 * // Instead, create your own and pass it around:
 * import { createFileStorage } from 'openguard/storage';
 * const storage = createFileStorage('./data/observability');
 * ```
 */
export const observabilityStorage: StorageRegistry = createMemoryStorage();
