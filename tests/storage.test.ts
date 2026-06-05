/**
 * Storage abstraction layer tests
 *
 * Each store type (trace, metric, snapshot) is tested against both adapters
 * (memory and file) using a shared contract suite so behavioural parity is
 * guaranteed.  Registry and factory helpers are tested separately.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';

import {
  MemoryTraceStore,
  MemoryMetricStore,
  MemorySnapshotStore,
  FileTraceStore,
  FileMetricStore,
  FileSnapshotStore,
  StorageRegistry,
  createMemoryStorage,
  createFileStorage,
  observabilityStorage,
} from '../src/storage/index.js';

import type {
  ITraceStore,
  IMetricStore,
  ISnapshotStore,
} from '../src/storage/index.js';

import type { Trace, SpanStatus } from '../src/tracing/types.js';
import type { Metric } from '../src/metrics/types.js';
import type { DebugSnapshot } from '../src/debug/types.js';

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

let _traceSeq = 0;
let _metricSeq = 0;
let _snapSeq = 0;

function makeTrace(overrides: Partial<Trace> = {}): Trace {
  const id = `trace_${++_traceSeq}`;
  return {
    traceId: id,
    requestId: `req_${_traceSeq}`,
    startTime: Date.now() - 1000 + _traceSeq,
    status: 'ok' as SpanStatus,
    rootSpanId: `span_root_${_traceSeq}`,
    spans: [],
    attributes: {},
    ...overrides,
  };
}

function makeMetric(overrides: Partial<Metric> = {}): Metric {
  _metricSeq++;
  return {
    metricType: 'latency',
    timestamp: Date.now() - 1000 + _metricSeq,
    dimensions: { provider: 'openai', model: 'gpt-4o' },
    data: { duration: 250 + _metricSeq, stage: 'total' },
    ...overrides,
  } as Metric;
}

function makeSnapshot(overrides: Partial<DebugSnapshot> = {}): DebugSnapshot {
  const id = `snap_${++_snapSeq}`;
  return {
    id,
    requestId: `req_${_snapSeq}`,
    capturedAt: Date.now() - 1000 + _snapSeq,
    status: 'success',
    validations: [],
    hallucinationChecks: [],
    retries: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Temp-dir management for file adapter tests
// ---------------------------------------------------------------------------

let tmpDir = '';

function createTmpDir(): string {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openguard-storage-test-'));
  return tmpDir;
}

async function removeTmpDir(): Promise<void> {
  if (tmpDir) {
    await fsp.rm(tmpDir, { recursive: true, force: true });
    tmpDir = '';
  }
}

// ---------------------------------------------------------------------------
// Shared contract suite — ITraceStore
// ---------------------------------------------------------------------------

function traceStoreContract(name: string, factory: () => ITraceStore) {
  describe(`ITraceStore — ${name}`, () => {
    let store: ITraceStore;
    beforeEach(() => { store = factory(); _traceSeq = 0; });

    it('saveTrace / getTrace round-trips', async () => {
      const t = makeTrace();
      await store.saveTrace(t);
      const got = await store.getTrace(t.traceId);
      expect(got).toEqual(t);
    });

    it('getTrace returns undefined for unknown ID', async () => {
      expect(await store.getTrace('no-such-id')).toBeUndefined();
    });

    it('saveTrace overwrites existing record', async () => {
      const t = makeTrace();
      await store.saveTrace(t);
      const updated = { ...t, status: 'error' as SpanStatus };
      await store.saveTrace(updated);
      expect((await store.getTrace(t.traceId))?.status).toBe('error');
    });

    it('queryTraces returns all when no filter', async () => {
      await store.saveTrace(makeTrace());
      await store.saveTrace(makeTrace());
      await store.saveTrace(makeTrace());
      const res = await store.queryTraces();
      expect(res.items).toHaveLength(3);
      expect(res.total).toBe(3);
    });

    it('queryTraces returns newest-first', async () => {
      const old   = makeTrace({ startTime: 100 });
      const young = makeTrace({ startTime: 999 });
      await store.saveTrace(old);
      await store.saveTrace(young);
      const res = await store.queryTraces();
      expect(res.items[0].traceId).toBe(young.traceId);
    });

    it('queryTraces filters by requestId', async () => {
      await store.saveTrace(makeTrace({ requestId: 'r-A' }));
      await store.saveTrace(makeTrace({ requestId: 'r-B' }));
      const res = await store.queryTraces({ requestId: 'r-A' });
      expect(res.items).toHaveLength(1);
      expect(res.items[0].requestId).toBe('r-A');
    });

    it('queryTraces filters by status', async () => {
      await store.saveTrace(makeTrace({ status: 'ok' }));
      await store.saveTrace(makeTrace({ status: 'error' }));
      const res = await store.queryTraces({ status: 'error' });
      expect(res.items).toHaveLength(1);
    });

    it('queryTraces filters by provider name', async () => {
      await store.saveTrace(makeTrace({ provider: { name: 'openai', attempts: 1 } }));
      await store.saveTrace(makeTrace({ provider: { name: 'gemini', attempts: 1 } }));
      const res = await store.queryTraces({ provider: 'openai' });
      expect(res.items).toHaveLength(1);
      expect(res.items[0].provider?.name).toBe('openai');
    });

    it('queryTraces filters by model', async () => {
      await store.saveTrace(makeTrace({ provider: { name: 'openai', model: 'gpt-4o', attempts: 1 } }));
      await store.saveTrace(makeTrace({ provider: { name: 'openai', model: 'gpt-3.5', attempts: 1 } }));
      const res = await store.queryTraces({ model: 'gpt-4o' });
      expect(res.items).toHaveLength(1);
    });

    it('queryTraces filters by timeRange', async () => {
      await store.saveTrace(makeTrace({ startTime: 1000 }));
      await store.saveTrace(makeTrace({ startTime: 5000 }));
      await store.saveTrace(makeTrace({ startTime: 9000 }));
      const res = await store.queryTraces({ timeRange: { start: 2000, end: 7000 } });
      expect(res.items).toHaveLength(1);
      expect(res.items[0].startTime).toBe(5000);
    });

    it('queryTraces paginates correctly', async () => {
      for (let i = 0; i < 5; i++) await store.saveTrace(makeTrace());
      const page1 = await store.queryTraces({ limit: 2, offset: 0 });
      const page2 = await store.queryTraces({ limit: 2, offset: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page1.hasMore).toBe(true);
      expect(page2.items).toHaveLength(2);
      expect(page2.hasMore).toBe(true);
    });

    it('deleteTrace removes the record', async () => {
      const t = makeTrace();
      await store.saveTrace(t);
      const deleted = await store.deleteTrace(t.traceId);
      expect(deleted).toBe(true);
      expect(await store.getTrace(t.traceId)).toBeUndefined();
    });

    it('deleteTrace returns false for unknown ID', async () => {
      expect(await store.deleteTrace('ghost')).toBe(false);
    });

    it('clear removes all traces', async () => {
      await store.saveTrace(makeTrace());
      await store.saveTrace(makeTrace());
      await store.clear();
      const res = await store.queryTraces();
      expect(res.items).toHaveLength(0);
      expect(res.total).toBe(0);
    });
  });
}

// ---------------------------------------------------------------------------
// Shared contract suite — IMetricStore
// ---------------------------------------------------------------------------

function metricStoreContract(name: string, factory: () => IMetricStore) {
  describe(`IMetricStore — ${name}`, () => {
    let store: IMetricStore;
    beforeEach(() => { store = factory(); _metricSeq = 0; });

    it('saveMetric / queryMetrics round-trips', async () => {
      const m = makeMetric();
      await store.saveMetric(m);
      const res = await store.queryMetrics();
      expect(res.items).toHaveLength(1);
      expect(res.items[0]).toEqual(m);
    });

    it('saveMetrics batch-inserts all items', async () => {
      const batch = [makeMetric(), makeMetric(), makeMetric()];
      await store.saveMetrics(batch);
      const res = await store.queryMetrics();
      expect(res.items).toHaveLength(3);
      expect(res.total).toBe(3);
    });

    it('saveMetrics with empty array is a no-op', async () => {
      await store.saveMetrics([]);
      expect((await store.queryMetrics()).total).toBe(0);
    });

    it('queryMetrics returns newest-first', async () => {
      await store.saveMetric(makeMetric({ timestamp: 100 }));
      await store.saveMetric(makeMetric({ timestamp: 900 }));
      const res = await store.queryMetrics();
      expect(res.items[0].timestamp).toBe(900);
    });

    it('queryMetrics filters by metricType', async () => {
      await store.saveMetric(makeMetric({ metricType: 'latency' } as any));
      await store.saveMetric(makeMetric({ metricType: 'retry' } as any));
      await store.saveMetric(makeMetric({ metricType: 'latency' } as any));
      const res = await store.queryMetrics({ metricTypes: ['retry'] });
      expect(res.items).toHaveLength(1);
    });

    it('queryMetrics treats empty metricTypes as no filter', async () => {
      await store.saveMetric(makeMetric());
      await store.saveMetric(makeMetric());
      expect((await store.queryMetrics({ metricTypes: [] })).total).toBe(2);
    });

    it('queryMetrics filters by provider dimension', async () => {
      await store.saveMetric(makeMetric({ dimensions: { provider: 'openai' } }));
      await store.saveMetric(makeMetric({ dimensions: { provider: 'gemini' } }));
      const res = await store.queryMetrics({ dimensions: { provider: 'gemini' } });
      expect(res.items).toHaveLength(1);
    });

    it('queryMetrics filters by timeRange', async () => {
      await store.saveMetric(makeMetric({ timestamp: 1000 }));
      await store.saveMetric(makeMetric({ timestamp: 5000 }));
      await store.saveMetric(makeMetric({ timestamp: 9000 }));
      const res = await store.queryMetrics({ timeRange: { start: 3000, end: 6000 } });
      expect(res.items).toHaveLength(1);
      expect(res.items[0].timestamp).toBe(5000);
    });

    it('queryMetrics paginates correctly', async () => {
      for (let i = 0; i < 4; i++) await store.saveMetric(makeMetric());
      const page = await store.queryMetrics({ limit: 2, offset: 0 });
      expect(page.items).toHaveLength(2);
      expect(page.total).toBe(4);
      expect(page.hasMore).toBe(true);
    });

    it('clear removes all metrics', async () => {
      await store.saveMetrics([makeMetric(), makeMetric()]);
      await store.clear();
      expect((await store.queryMetrics()).total).toBe(0);
    });
  });
}

// ---------------------------------------------------------------------------
// Shared contract suite — ISnapshotStore
// ---------------------------------------------------------------------------

function snapshotStoreContract(name: string, factory: () => ISnapshotStore) {
  describe(`ISnapshotStore — ${name}`, () => {
    let store: ISnapshotStore;
    beforeEach(() => { store = factory(); _snapSeq = 0; });

    it('saveSnapshot / getSnapshot round-trips', async () => {
      const s = makeSnapshot();
      await store.saveSnapshot(s);
      expect(await store.getSnapshot(s.id)).toEqual(s);
    });

    it('getSnapshot returns undefined for unknown ID', async () => {
      expect(await store.getSnapshot('ghost')).toBeUndefined();
    });

    it('saveSnapshot overwrites existing record', async () => {
      const s = makeSnapshot();
      await store.saveSnapshot(s);
      const updated = { ...s, status: 'failure' as const };
      await store.saveSnapshot(updated);
      expect((await store.getSnapshot(s.id))?.status).toBe('failure');
    });

    it('querySnapshots returns all when no filter', async () => {
      await store.saveSnapshot(makeSnapshot());
      await store.saveSnapshot(makeSnapshot());
      const res = await store.querySnapshots();
      expect(res.total).toBe(2);
    });

    it('querySnapshots returns newest-first', async () => {
      const old   = makeSnapshot({ capturedAt: 100 });
      const young = makeSnapshot({ capturedAt: 999 });
      await store.saveSnapshot(old);
      await store.saveSnapshot(young);
      const res = await store.querySnapshots();
      expect(res.items[0].id).toBe(young.id);
    });

    it('querySnapshots filters by requestId', async () => {
      await store.saveSnapshot(makeSnapshot({ requestId: 'rx' }));
      await store.saveSnapshot(makeSnapshot({ requestId: 'ry' }));
      const res = await store.querySnapshots({ requestId: 'rx' });
      expect(res.items).toHaveLength(1);
    });

    it('querySnapshots filters by status', async () => {
      await store.saveSnapshot(makeSnapshot({ status: 'success' }));
      await store.saveSnapshot(makeSnapshot({ status: 'failure' }));
      const res = await store.querySnapshots({ status: 'failure' });
      expect(res.items).toHaveLength(1);
    });

    it('querySnapshots filters by provider', async () => {
      await store.saveSnapshot(makeSnapshot({ provider: 'openai' }));
      await store.saveSnapshot(makeSnapshot({ provider: 'gemini' }));
      const res = await store.querySnapshots({ provider: 'openai' });
      expect(res.items).toHaveLength(1);
    });

    it('querySnapshots filters by model', async () => {
      await store.saveSnapshot(makeSnapshot({ model: 'gpt-4o' }));
      await store.saveSnapshot(makeSnapshot({ model: 'gpt-3.5' }));
      expect((await store.querySnapshots({ model: 'gpt-4o' })).items).toHaveLength(1);
    });

    it('querySnapshots filters by tags (AND semantics)', async () => {
      await store.saveSnapshot(makeSnapshot({ tags: ['slow', 'retry'] }));
      await store.saveSnapshot(makeSnapshot({ tags: ['slow'] }));
      await store.saveSnapshot(makeSnapshot({ tags: ['fast'] }));

      // Both tags must be present
      const res = await store.querySnapshots({ tags: ['slow', 'retry'] });
      expect(res.items).toHaveLength(1);

      // Single tag matches two
      const single = await store.querySnapshots({ tags: ['slow'] });
      expect(single.items).toHaveLength(2);
    });

    it('querySnapshots filters by timeRange', async () => {
      await store.saveSnapshot(makeSnapshot({ capturedAt: 1000 }));
      await store.saveSnapshot(makeSnapshot({ capturedAt: 5000 }));
      await store.saveSnapshot(makeSnapshot({ capturedAt: 9000 }));
      const res = await store.querySnapshots({ timeRange: { start: 3000, end: 7000 } });
      expect(res.items).toHaveLength(1);
      expect(res.items[0].capturedAt).toBe(5000);
    });

    it('querySnapshots paginates correctly', async () => {
      for (let i = 0; i < 5; i++) await store.saveSnapshot(makeSnapshot());
      const p1 = await store.querySnapshots({ limit: 3, offset: 0 });
      const p2 = await store.querySnapshots({ limit: 3, offset: 3 });
      expect(p1.items).toHaveLength(3);
      expect(p1.total).toBe(5);
      expect(p1.hasMore).toBe(true);
      expect(p2.items).toHaveLength(2);
      expect(p2.hasMore).toBe(false);
    });

    it('deleteSnapshot removes the record', async () => {
      const s = makeSnapshot();
      await store.saveSnapshot(s);
      expect(await store.deleteSnapshot(s.id)).toBe(true);
      expect(await store.getSnapshot(s.id)).toBeUndefined();
    });

    it('deleteSnapshot returns false for unknown ID', async () => {
      expect(await store.deleteSnapshot('no-such')).toBe(false);
    });

    it('clear removes all snapshots', async () => {
      await store.saveSnapshot(makeSnapshot());
      await store.saveSnapshot(makeSnapshot());
      await store.clear();
      expect((await store.querySnapshots()).total).toBe(0);
    });
  });
}

// ---------------------------------------------------------------------------
// Run contract suites for BOTH adapters
// ---------------------------------------------------------------------------

// Memory adapters
traceStoreContract('Memory', () => new MemoryTraceStore());
metricStoreContract('Memory', () => new MemoryMetricStore());
snapshotStoreContract('Memory', () => new MemorySnapshotStore());

// File adapters — each test group gets its own tmpDir
describe('ITraceStore — File (setup)', () => {
  let dir = '';
  beforeEach(() => { dir = createTmpDir(); _traceSeq = 0; });
  afterEach(() => removeTmpDir());
  traceStoreContract('File', () => new FileTraceStore(dir));
});

describe('IMetricStore — File (setup)', () => {
  let dir = '';
  beforeEach(() => { dir = createTmpDir(); _metricSeq = 0; });
  afterEach(() => removeTmpDir());
  metricStoreContract('File', () => new FileMetricStore(dir));
});

describe('ISnapshotStore — File (setup)', () => {
  let dir = '';
  beforeEach(() => { dir = createTmpDir(); _snapSeq = 0; });
  afterEach(() => removeTmpDir());
  snapshotStoreContract('File', () => new FileSnapshotStore(dir));
});

// ---------------------------------------------------------------------------
// FileMetricStore-specific: compact()
// ---------------------------------------------------------------------------

describe('FileMetricStore.compact()', () => {
  let dir: string;
  beforeEach(() => { dir = createTmpDir(); _metricSeq = 0; });
  afterEach(() => removeTmpDir());

  it('keeps only metrics satisfying the predicate', async () => {
    const store = new FileMetricStore(dir);
    await store.saveMetric(makeMetric({ timestamp: 1000 }));
    await store.saveMetric(makeMetric({ timestamp: 2000 }));
    await store.saveMetric(makeMetric({ timestamp: 3000 }));

    await store.compact((m) => m.timestamp >= 2000);

    const res = await store.queryMetrics();
    expect(res.total).toBe(2);
    expect(res.items.every((m) => m.timestamp >= 2000)).toBe(true);
  });

  it('produces an empty file when no metrics are kept', async () => {
    const store = new FileMetricStore(dir);
    await store.saveMetric(makeMetric({ timestamp: 500 }));
    await store.compact(() => false);
    expect((await store.queryMetrics()).total).toBe(0);
  });

  it('preserves all metrics when predicate always returns true', async () => {
    const store = new FileMetricStore(dir);
    await store.saveMetrics([makeMetric(), makeMetric(), makeMetric()]);
    await store.compact(() => true);
    expect((await store.queryMetrics()).total).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// StorageRegistry
// ---------------------------------------------------------------------------

describe('StorageRegistry', () => {
  it('defaults all three stores to in-memory', async () => {
    const reg = new StorageRegistry();
    const t = makeTrace();
    await reg.traces.saveTrace(t);
    expect(await reg.traces.getTrace(t.traceId)).toBeDefined();
  });

  it('accepts custom adapters per pillar', async () => {
    const reg = new StorageRegistry({
      traces:    new MemoryTraceStore(),
      metrics:   new MemoryMetricStore(),
      snapshots: new MemorySnapshotStore(),
    });
    await reg.metrics.saveMetric(makeMetric());
    expect((await reg.metrics.queryMetrics()).total).toBe(1);
  });

  it('clearAll clears all three stores', async () => {
    const reg = new StorageRegistry();
    await reg.traces.saveTrace(makeTrace());
    await reg.metrics.saveMetric(makeMetric());
    await reg.snapshots.saveSnapshot(makeSnapshot());
    await reg.clearAll();
    expect((await reg.traces.queryTraces()).total).toBe(0);
    expect((await reg.metrics.queryMetrics()).total).toBe(0);
    expect((await reg.snapshots.querySnapshots()).total).toBe(0);
  });

  it('stores for each pillar are independent', async () => {
    const reg = new StorageRegistry();
    const t = makeTrace();
    await reg.traces.saveTrace(t);
    // Clearing snapshots should not affect traces
    await reg.snapshots.clear();
    expect(await reg.traces.getTrace(t.traceId)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

describe('createMemoryStorage()', () => {
  it('returns a StorageRegistry with three in-memory stores', async () => {
    const reg = createMemoryStorage();
    expect(reg).toBeInstanceOf(StorageRegistry);
    await reg.traces.saveTrace(makeTrace());
    expect((await reg.traces.queryTraces()).total).toBe(1);
  });

  it('two calls return independent registries', async () => {
    const a = createMemoryStorage();
    const b = createMemoryStorage();
    await a.traces.saveTrace(makeTrace());
    expect((await b.traces.queryTraces()).total).toBe(0);
  });
});

describe('createFileStorage()', () => {
  let dir: string;
  beforeEach(() => { dir = createTmpDir(); });
  afterEach(() => removeTmpDir());

  it('returns a StorageRegistry using the supplied baseDir', async () => {
    const reg = createFileStorage(dir);
    expect(reg).toBeInstanceOf(StorageRegistry);
  });

  it('persists data across separate adapter instances sharing the same dir', async () => {
    const store1 = new FileTraceStore(dir);
    const t = makeTrace();
    await store1.saveTrace(t);

    // A new instance pointing at the same directory sees the same data
    const store2 = new FileTraceStore(dir);
    expect(await store2.getTrace(t.traceId)).toEqual(t);
  });

  it('creates the directory tree if it does not exist', () => {
    const nested = path.join(dir, 'deep', 'nested');
    createFileStorage(nested); // should not throw
    expect(fs.existsSync(path.join(nested, 'traces'))).toBe(true);
    expect(fs.existsSync(path.join(nested, 'snapshots'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Global singleton smoke test
// ---------------------------------------------------------------------------

describe('observabilityStorage singleton', () => {
  it('is a StorageRegistry instance', () => {
    expect(observabilityStorage).toBeInstanceOf(StorageRegistry);
  });
});

// ---------------------------------------------------------------------------
// PagedResult shape
// ---------------------------------------------------------------------------

describe('PagedResult shape', () => {
  it('hasMore is false on the last page', async () => {
    const store = new MemoryTraceStore();
    for (let i = 0; i < 3; i++) await store.saveTrace(makeTrace());
    const last = await store.queryTraces({ limit: 2, offset: 2 });
    expect(last.items).toHaveLength(1);
    expect(last.hasMore).toBe(false);
  });

  it('hasMore is false when result fits on one page', async () => {
    const store = new MemoryTraceStore();
    await store.saveTrace(makeTrace());
    const res = await store.queryTraces({ limit: 10 });
    expect(res.hasMore).toBe(false);
    expect(res.offset).toBe(0);
    expect(res.limit).toBe(10);
  });

  it('offset beyond total returns empty items with correct total', async () => {
    const store = new MemorySnapshotStore();
    await store.saveSnapshot(makeSnapshot());
    const res = await store.querySnapshots({ limit: 10, offset: 100 });
    expect(res.items).toHaveLength(0);
    expect(res.total).toBe(1);
    expect(res.hasMore).toBe(false);
  });
});
