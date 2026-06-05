/**
 * File-based storage adapters (Node.js)
 *
 * Layout on disk:
 *
 *   {baseDir}/
 *     traces/
 *       {traceId}.json       — one JSON file per trace
 *     snapshots/
 *       {snapshotId}.json    — one JSON file per snapshot
 *     metrics.ndjson         — newline-delimited JSON, one metric per line
 *
 * Design rationale:
 * - Per-record files for traces/snapshots give O(1) get-by-ID without loading
 *   the whole collection into memory.
 * - NDJSON for metrics allows lock-free, low-overhead appends at high write
 *   rates while still supporting full scans for queries.
 * - All public methods are async (return Promises); directory creation is done
 *   synchronously at construction time because it is a one-shot operation.
 *
 * Intended for: development, CI, local tooling, single-process servers.
 * NOT intended for: high-concurrency production writes, distributed deployments.
 *
 * Node.js requirement:
 *   This module uses `node:fs/promises` and `node:path` and will not work in
 *   browser or edge runtimes.  Import only when running in Node.js.
 */

import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';

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

function paginate<T>(items: T[], offset = 0, limit = 100): PagedResult<T> {
  const total = items.length;
  const sliced = items.slice(offset, offset + limit);
  return { items: sliced, total, offset, limit, hasMore: offset + limit < total };
}

function inRange(timestamp: number, range: { start: number; end: number }): boolean {
  return timestamp >= range.start && timestamp <= range.end;
}

/** Sanitise an ID so it is safe to embed in a filename. */
function safeFilename(id: string): string {
  return id.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
}

/**
 * Read all `*.json` files from a directory and parse them as `T`.
 * Files that fail to parse are silently skipped — a corrupted record should
 * never prevent the remaining records from being readable.
 */
async function readAllJson<T>(dir: string): Promise<T[]> {
  let names: string[];
  try {
    names = await fsp.readdir(dir);
  } catch {
    return [];
  }

  const results = await Promise.all(
    names
      .filter((n) => n.endsWith('.json'))
      .map(async (n): Promise<T | null> => {
        try {
          const raw = await fsp.readFile(path.join(dir, n), 'utf-8');
          return JSON.parse(raw) as T;
        } catch {
          return null;
        }
      }),
  );

  return results.filter((r) => r !== null) as T[];
}

/**
 * Read all lines from an NDJSON file and parse them as `T`.
 * Blank lines and lines that fail to parse are silently skipped.
 */
async function readAllNdjson<T>(filePath: string): Promise<T[]> {
  let raw: string;
  try {
    raw = await fsp.readFile(filePath, 'utf-8');
  } catch {
    return [];
  }

  const results: T[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      results.push(JSON.parse(trimmed) as T);
    } catch {
      // Skip malformed lines
    }
  }
  return results;
}

/**
 * Remove all `*.json` files in a directory (non-recursive).
 * Errors on individual files are silently ignored.
 */
async function clearJsonDir(dir: string): Promise<void> {
  let names: string[];
  try {
    names = await fsp.readdir(dir);
  } catch {
    return;
  }

  await Promise.all(
    names
      .filter((n) => n.endsWith('.json'))
      .map((n) => fsp.unlink(path.join(dir, n)).catch(() => undefined)),
  );
}

// ---------------------------------------------------------------------------
// FileTraceStore
// ---------------------------------------------------------------------------

/**
 * File-backed `ITraceStore`.
 *
 * Each trace is stored as `{baseDir}/{traceId}.json`.
 * `queryTraces` reads all files on every call — suitable for dev/CI volumes
 * (up to ~10 k records).  For larger datasets use a database adapter.
 */
export class FileTraceStore implements ITraceStore {
  private readonly _dir: string;

  constructor(baseDir: string) {
    this._dir = path.join(baseDir, 'traces');
    fs.mkdirSync(this._dir, { recursive: true });
  }

  async saveTrace(trace: Trace): Promise<void> {
    const file = path.join(this._dir, `${safeFilename(trace.traceId)}.json`);
    await fsp.writeFile(file, JSON.stringify(trace), 'utf-8');
  }

  async getTrace(traceId: string): Promise<Trace | undefined> {
    const file = path.join(this._dir, `${safeFilename(traceId)}.json`);
    try {
      const raw = await fsp.readFile(file, 'utf-8');
      return JSON.parse(raw) as Trace;
    } catch {
      return undefined;
    }
  }

  async queryTraces(query: TraceQuery = {}): Promise<PagedResult<Trace>> {
    let items = await readAllJson<Trace>(this._dir);

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
    const file = path.join(this._dir, `${safeFilename(traceId)}.json`);
    try {
      await fsp.unlink(file);
      return true;
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
    await clearJsonDir(this._dir);
  }
}

// ---------------------------------------------------------------------------
// FileMetricStore
// ---------------------------------------------------------------------------

/**
 * File-backed `IMetricStore`.
 *
 * Metrics are written to `{baseDir}/metrics.ndjson` as newline-delimited JSON.
 * Appends are O(1); queries are O(n) full-file reads.
 *
 * A `compact(keepFn)` helper is provided to rewrite the file keeping only the
 * records that satisfy a predicate (e.g. drop metrics older than 7 days).
 */
export class FileMetricStore implements IMetricStore {
  private readonly _file: string;

  constructor(baseDir: string) {
    fs.mkdirSync(baseDir, { recursive: true });
    this._file = path.join(baseDir, 'metrics.ndjson');
  }

  async saveMetric(metric: Metric): Promise<void> {
    await fsp.appendFile(this._file, JSON.stringify(metric) + '\n', 'utf-8');
  }

  async saveMetrics(metrics: Metric[]): Promise<void> {
    if (metrics.length === 0) return;
    const lines = metrics.map((m) => JSON.stringify(m)).join('\n') + '\n';
    await fsp.appendFile(this._file, lines, 'utf-8');
  }

  async queryMetrics(query: MetricQuery = {}): Promise<PagedResult<Metric>> {
    let items = await readAllNdjson<Metric>(this._file);

    if (query.metricTypes?.length) {
      const allowed = new Set(query.metricTypes);
      items = items.filter((m) => allowed.has(m.metricType));
    }
    if (query.dimensions) {
      const { provider, model, requestType } = query.dimensions;
      if (provider    !== undefined) items = items.filter((m) => m.dimensions.provider    === provider);
      if (model       !== undefined) items = items.filter((m) => m.dimensions.model       === model);
      if (requestType !== undefined) items = items.filter((m) => m.dimensions.requestType === requestType);
    }
    if (query.timeRange !== undefined) {
      items = items.filter((m) => inRange(m.timestamp, query.timeRange!));
    }

    items.sort((a, b) => b.timestamp - a.timestamp);
    return paginate(items, query.offset, query.limit);
  }

  async clear(): Promise<void> {
    try {
      await fsp.writeFile(this._file, '', 'utf-8');
    } catch {
      // File may not exist yet — that is fine
    }
  }

  /**
   * Rewrite the metrics file keeping only records for which `keepFn` returns
   * `true`.  Call this periodically to prune old data and reclaim disk space.
   *
   * @example
   * const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
   * await store.compact(m => m.timestamp >= cutoff);
   */
  async compact(keepFn: (metric: Metric) => boolean): Promise<void> {
    const all = await readAllNdjson<Metric>(this._file);
    const kept = all.filter(keepFn);
    const content = kept.map((m) => JSON.stringify(m)).join('\n');
    await fsp.writeFile(this._file, content ? content + '\n' : '', 'utf-8');
  }
}

// ---------------------------------------------------------------------------
// FileSnapshotStore
// ---------------------------------------------------------------------------

/**
 * File-backed `ISnapshotStore`.
 *
 * Each snapshot is stored as `{baseDir}/{snapshotId}.json`.
 * `querySnapshots` reads all files on every call — suitable for dev/CI volumes.
 */
export class FileSnapshotStore implements ISnapshotStore {
  private readonly _dir: string;

  constructor(baseDir: string) {
    this._dir = path.join(baseDir, 'snapshots');
    fs.mkdirSync(this._dir, { recursive: true });
  }

  async saveSnapshot(snapshot: DebugSnapshot): Promise<void> {
    const file = path.join(this._dir, `${safeFilename(snapshot.id)}.json`);
    await fsp.writeFile(file, JSON.stringify(snapshot), 'utf-8');
  }

  async getSnapshot(id: string): Promise<DebugSnapshot | undefined> {
    const file = path.join(this._dir, `${safeFilename(id)}.json`);
    try {
      const raw = await fsp.readFile(file, 'utf-8');
      return JSON.parse(raw) as DebugSnapshot;
    } catch {
      return undefined;
    }
  }

  async querySnapshots(query: SnapshotQuery = {}): Promise<PagedResult<DebugSnapshot>> {
    let items = await readAllJson<DebugSnapshot>(this._dir);

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
      items = items.filter((s) =>
        query.tags!.every((tag) => s.tags?.includes(tag)),
      );
    }
    if (query.timeRange !== undefined) {
      items = items.filter((s) => inRange(s.capturedAt, query.timeRange!));
    }

    items.sort((a, b) => b.capturedAt - a.capturedAt);
    return paginate(items, query.offset, query.limit);
  }

  async deleteSnapshot(id: string): Promise<boolean> {
    const file = path.join(this._dir, `${safeFilename(id)}.json`);
    try {
      await fsp.unlink(file);
      return true;
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
    await clearJsonDir(this._dir);
  }
}
