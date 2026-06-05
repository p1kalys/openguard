/**
 * ObservabilityQueryEngine tests
 *
 * All five query methods are tested against an in-memory StorageRegistry.
 * Each describe block is self-contained: data is seeded in beforeEach so
 * tests are independent and order-agnostic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ObservabilityQueryEngine }          from '../src/query/engine.js';
import { createMemoryStorage }               from '../src/storage/index.js';
import type { StorageRegistry }              from '../src/storage/registry.js';
import type { SpanStatus }                   from '../src/tracing/types.js';
import type { DebugSnapshot }                from '../src/debug/types.js';
import type { Metric }                       from '../src/metrics/types.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let _seq = 0;
const uid = () => `id_${++_seq}`;

function trace(
  provider: string,
  model: string,
  status: SpanStatus,
  duration: number,
  startTime: number,
  tokens?: { prompt: number; completion: number; total: number },
) {
  const id = uid();
  return {
    traceId: id, requestId: uid(),
    startTime, duration, status,
    rootSpanId: uid(), spans: [], attributes: {},
    provider: { name: provider, model, attempts: 1, ...(tokens && { tokens }) },
  };
}

function metric(type: Metric['metricType'], provider: string, model: string, data: Record<string, unknown>, ts?: number): Metric {
  return {
    metricType: type,
    timestamp: ts ?? Date.now(),
    dimensions: { provider, model },
    data,
  } as Metric;
}

function snapshot(overrides: Partial<DebugSnapshot> = {}): DebugSnapshot {
  return {
    id: uid(), requestId: uid(), capturedAt: Date.now(),
    status: 'success',
    validations: [], hallucinationChecks: [], retries: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Shared test storage + engine
// ---------------------------------------------------------------------------

let storage: StorageRegistry;
let engine: ObservabilityQueryEngine;

beforeEach(() => {
  _seq = 0;
  storage = createMemoryStorage();
  engine  = new ObservabilityQueryEngine(storage);
});

// ---------------------------------------------------------------------------
// 1. queryMetrics
// ---------------------------------------------------------------------------

describe('queryMetrics', () => {
  it('returns zeroed analytics when no metrics exist', async () => {
    const res = await engine.queryMetrics();
    expect(res.totalEvents).toBe(0);
    expect(res.latency.overall.count).toBe(0);
    expect(res.tokens.totalTokens).toBe(0);
    expect(res.retries.totalRetryEvents).toBe(0);
    expect(res.validationFailures.total).toBe(0);
    expect(res.hallucinations.totalChecks).toBe(0);
    expect(res.providerFailures.total).toBe(0);
  });

  it('echoes the filter back in the result', async () => {
    const filter = { provider: 'openai', model: 'gpt-4o' };
    const res = await engine.queryMetrics(filter);
    expect(res.filter).toEqual(filter);
  });

  it('aggregates latency metrics', async () => {
    await storage.metrics.saveMetrics([
      metric('latency', 'openai', 'gpt-4o', { duration: 100, stage: 'total' }),
      metric('latency', 'openai', 'gpt-4o', { duration: 300, stage: 'total' }),
      metric('latency', 'openai', 'gpt-4o', { duration: 200, stage: 'provider' }),
    ]);
    const res = await engine.queryMetrics();
    expect(res.latency.overall.count).toBe(3);
    expect(res.latency.overall.avg).toBeCloseTo(200, 0);
    expect(res.latency.byStage['total']).toBeDefined();
    expect(res.latency.byStage['provider']).toBeDefined();
  });

  it('aggregates token usage metrics', async () => {
    await storage.metrics.saveMetrics([
      metric('token.usage', 'openai', 'gpt-4o', { promptTokens: 100, completionTokens: 200, totalTokens: 300 }),
      metric('token.usage', 'openai', 'gpt-4o', { promptTokens: 50,  completionTokens: 50,  totalTokens: 100 }),
    ]);
    const res = await engine.queryMetrics();
    expect(res.tokens.totalTokens).toBe(400);
    expect(res.tokens.totalPromptTokens).toBe(150);
    expect(res.tokens.avgTotalTokens).toBe(200);
  });

  it('aggregates retry metrics', async () => {
    await storage.metrics.saveMetrics([
      metric('retry', 'openai', 'gpt-4o', { attempt: 2, maxAttempts: 3, reason: 'rate_limit', delayMs: 500 }),
      metric('retry', 'openai', 'gpt-4o', { attempt: 3, maxAttempts: 3, reason: 'rate_limit', delayMs: 500 }),
      metric('retry', 'openai', 'gpt-4o', { attempt: 1, maxAttempts: 3, reason: 'timeout',    delayMs: 200 }),
    ]);
    const res = await engine.queryMetrics();
    expect(res.retries.totalRetryEvents).toBe(3);
    expect(res.retries.byReason['rate_limit']).toBe(2);
    expect(res.retries.byReason['timeout']).toBe(1);
  });

  it('aggregates validation failure metrics', async () => {
    await storage.metrics.saveMetrics([
      metric('validation.failure', 'openai', 'gpt-4o', { validationType: 'schema',   message: 'bad field',  critical: true }),
      metric('validation.failure', 'openai', 'gpt-4o', { validationType: 'semantic', message: 'bad value',  critical: false }),
      metric('validation.failure', 'openai', 'gpt-4o', { validationType: 'schema',   message: 'extra key',  critical: true }),
    ]);
    const res = await engine.queryMetrics();
    expect(res.validationFailures.total).toBe(3);
    expect(res.validationFailures.criticalCount).toBe(2);
    expect(res.validationFailures.criticalRate).toBeCloseTo(2 / 3, 5);
    expect(res.validationFailures.byType['schema']).toBe(2);
  });

  it('aggregates hallucination metrics', async () => {
    await storage.metrics.saveMetrics([
      metric('hallucination', 'openai', 'gpt-4o', { score: 0.8, detected: true,  confidence: 0.9 }),
      metric('hallucination', 'openai', 'gpt-4o', { score: 0.2, detected: false, confidence: 0.7 }),
    ]);
    const res = await engine.queryMetrics();
    expect(res.hallucinations.totalChecks).toBe(2);
    expect(res.hallucinations.detectionCount).toBe(1);
    expect(res.hallucinations.detectionRate).toBe(0.5);
    expect(res.hallucinations.avgScore).toBe(0.5);
  });

  it('filters metrics by provider', async () => {
    await storage.metrics.saveMetrics([
      metric('latency', 'openai',    'gpt-4o',          { duration: 500, stage: 'total' }),
      metric('latency', 'anthropic', 'claude-3-sonnet', { duration: 200, stage: 'total' }),
    ]);
    const res = await engine.queryMetrics({ provider: 'anthropic' });
    expect(res.totalEvents).toBe(1);
    expect(res.latency.overall.avg).toBe(200);
  });

  it('filters metrics by model', async () => {
    await storage.metrics.saveMetrics([
      metric('latency', 'openai', 'gpt-4o',  { duration: 500, stage: 'total' }),
      metric('latency', 'openai', 'gpt-3.5', { duration: 200, stage: 'total' }),
    ]);
    const res = await engine.queryMetrics({ model: 'gpt-3.5' });
    expect(res.totalEvents).toBe(1);
  });

  it('filters metrics by time range', async () => {
    const now = Date.now();
    await storage.metrics.saveMetrics([
      metric('latency', 'openai', 'gpt-4o', { duration: 100, stage: 'total' }, now - 10_000),
      metric('latency', 'openai', 'gpt-4o', { duration: 200, stage: 'total' }, now - 1_000),
    ]);
    const res = await engine.queryMetrics({ timeRange: { start: now - 2_000, end: now } });
    expect(res.totalEvents).toBe(1);
    expect(res.latency.overall.avg).toBe(200);
  });

  it('uses effective time range from data when filter has no timeRange', async () => {
    const t1 = 1_000_000;
    const t2 = 2_000_000;
    await storage.metrics.saveMetrics([
      metric('latency', 'openai', 'gpt-4o', { duration: 100, stage: 'total' }, t1),
      metric('latency', 'openai', 'gpt-4o', { duration: 100, stage: 'total' }, t2),
    ]);
    const res = await engine.queryMetrics();
    expect(res.timeRange.start).toBe(t1);
    expect(res.timeRange.end).toBe(t2);
  });
});

// ---------------------------------------------------------------------------
// 2. queryTraces
// ---------------------------------------------------------------------------

describe('queryTraces', () => {
  const now = 1_700_000_000_000;

  it('returns zeroed result when no traces exist', async () => {
    const res = await engine.queryTraces();
    expect(res.total).toBe(0);
    expect(res.successRate).toBe(0);
    expect(res.items).toHaveLength(0);
  });

  it('counts success / error correctly', async () => {
    await storage.traces.saveTrace(trace('openai', 'gpt-4o', 'ok',    500, now));
    await storage.traces.saveTrace(trace('openai', 'gpt-4o', 'error', 800, now + 1));
    await storage.traces.saveTrace(trace('openai', 'gpt-4o', 'ok',    300, now + 2));
    const res = await engine.queryTraces();
    expect(res.total).toBe(3);
    expect(res.successCount).toBe(2);
    expect(res.errorCount).toBe(1);
    expect(res.successRate).toBeCloseTo(2 / 3, 5);
  });

  it('computes latency statistics', async () => {
    await storage.traces.saveTrace(trace('openai', 'gpt-4o', 'ok', 100, now));
    await storage.traces.saveTrace(trace('openai', 'gpt-4o', 'ok', 300, now + 1));
    await storage.traces.saveTrace(trace('openai', 'gpt-4o', 'ok', 500, now + 2));
    const res = await engine.queryTraces();
    expect(res.avgDurationMs).toBeCloseTo(300, 0);
    expect(res.p95DurationMs).toBeGreaterThanOrEqual(300);
  });

  it('builds per-provider breakdown', async () => {
    await storage.traces.saveTrace(trace('openai',    'gpt-4o',         'ok',    500, now));
    await storage.traces.saveTrace(trace('openai',    'gpt-4o',         'error', 800, now + 1));
    await storage.traces.saveTrace(trace('anthropic', 'claude-3-sonnet', 'ok',   300, now + 2));
    const res = await engine.queryTraces();
    expect(res.byProvider['openai'].totalTraces).toBe(2);
    expect(res.byProvider['openai'].successCount).toBe(1);
    expect(res.byProvider['openai'].successRate).toBe(0.5);
    expect(res.byProvider['anthropic'].totalTraces).toBe(1);
    expect(res.byProvider['anthropic'].successRate).toBe(1);
  });

  it('returns slowest traces in descending order', async () => {
    await storage.traces.saveTrace(trace('openai', 'gpt-4o', 'ok', 100, now));
    await storage.traces.saveTrace(trace('openai', 'gpt-4o', 'ok', 900, now + 1));
    await storage.traces.saveTrace(trace('openai', 'gpt-4o', 'ok', 400, now + 2));
    const res = await engine.queryTraces({ limit: 3 });
    expect(res.slowest[0].durationMs).toBe(900);
    expect(res.slowest[1].durationMs).toBe(400);
    expect(res.slowest[2].durationMs).toBe(100);
  });

  it('paginates items correctly', async () => {
    for (let i = 0; i < 5; i++) {
      await storage.traces.saveTrace(trace('openai', 'gpt-4o', 'ok', 100, now + i));
    }
    const p1 = await engine.queryTraces({ limit: 2, offset: 0 });
    const p2 = await engine.queryTraces({ limit: 2, offset: 2 });
    expect(p1.items).toHaveLength(2);
    expect(p1.hasMore).toBe(true);
    expect(p2.items).toHaveLength(2);
    expect(p2.hasMore).toBe(true);
  });

  it('filters by provider', async () => {
    await storage.traces.saveTrace(trace('openai',    'gpt-4o',         'ok', 500, now));
    await storage.traces.saveTrace(trace('anthropic', 'claude-3-sonnet', 'ok', 300, now + 1));
    const res = await engine.queryTraces({ provider: 'anthropic' });
    expect(res.total).toBe(1);
    expect(res.items[0].provider).toBe('anthropic');
  });

  it('filters by model', async () => {
    await storage.traces.saveTrace(trace('openai', 'gpt-4o',  'ok', 500, now));
    await storage.traces.saveTrace(trace('openai', 'gpt-3.5', 'ok', 300, now + 1));
    const res = await engine.queryTraces({ model: 'gpt-4o' });
    expect(res.total).toBe(1);
    expect(res.items[0].model).toBe('gpt-4o');
  });

  it('filters by time range', async () => {
    await storage.traces.saveTrace(trace('openai', 'gpt-4o', 'ok', 100, now - 10_000));
    await storage.traces.saveTrace(trace('openai', 'gpt-4o', 'ok', 200, now - 500));
    const res = await engine.queryTraces({ timeRange: { start: now - 2_000, end: now } });
    expect(res.total).toBe(1);
  });

  it('projects trace to TraceSummary correctly', async () => {
    await storage.traces.saveTrace(
      trace('openai', 'gpt-4o', 'ok', 420, now, { prompt: 50, completion: 100, total: 150 }),
    );
    const res = await engine.queryTraces();
    const s = res.items[0];
    expect(s.provider).toBe('openai');
    expect(s.model).toBe('gpt-4o');
    expect(s.status).toBe('ok');
    expect(s.durationMs).toBe(420);
    expect(s.totalTokens).toBe(150);
  });

  it('captures errorMessage from failing span', async () => {
    const t = trace('openai', 'gpt-4o', 'error', 800, now);
    t.spans = [{
      spanId: 'sp-err', traceId: t.traceId, name: 'call', stage: 'provider',
      startTime: now, status: 'error',
      error: { message: 'context window exceeded', name: 'ContextLengthError' },
      attributes: {}, events: [],
    }];
    await storage.traces.saveTrace(t);
    const res = await engine.queryTraces();
    expect(res.items[0].errorMessage).toBe('context window exceeded');
  });
});

// ---------------------------------------------------------------------------
// 3. queryValidationFailures
// ---------------------------------------------------------------------------

describe('queryValidationFailures', () => {
  it('returns zeroed result when no snapshots exist', async () => {
    const res = await engine.queryValidationFailures();
    expect(res.total).toBe(0);
    expect(res.topIssues).toHaveLength(0);
    expect(res.items).toHaveLength(0);
  });

  it('excludes snapshots where all validations passed', async () => {
    await storage.snapshots.saveSnapshot(snapshot({
      validations: [{ kind: 'schema', passed: true, issues: [] }],
    }));
    const res = await engine.queryValidationFailures();
    expect(res.total).toBe(0);
  });

  it('includes snapshots with at least one failing validation', async () => {
    await storage.snapshots.saveSnapshot(snapshot({
      provider: 'openai', model: 'gpt-4o',
      validations: [{
        kind: 'schema', passed: false,
        issues: [{ type: 'MISSING_FIELD', message: 'missing', severity: 'critical', path: '$.x' }],
      }],
    }));
    const res = await engine.queryValidationFailures();
    expect(res.total).toBe(1);
    expect(res.criticalCount).toBe(1);
    expect(res.criticalRate).toBe(1);
  });

  it('groups counts by kind, provider, model', async () => {
    await storage.snapshots.saveSnapshot(snapshot({
      provider: 'openai', model: 'gpt-4o',
      validations: [{ kind: 'schema',   passed: false, issues: [{ type: 'T1', message: 'm', severity: 'warning', path: '' }] }],
    }));
    await storage.snapshots.saveSnapshot(snapshot({
      provider: 'openai', model: 'gpt-4o',
      validations: [{ kind: 'semantic', passed: false, issues: [{ type: 'T2', message: 'm', severity: 'critical', path: '' }] }],
    }));
    await storage.snapshots.saveSnapshot(snapshot({
      provider: 'anthropic', model: 'claude',
      validations: [{ kind: 'schema',   passed: false, issues: [{ type: 'T1', message: 'm', severity: 'warning', path: '' }] }],
    }));
    const res = await engine.queryValidationFailures();
    expect(res.total).toBe(3);
    expect(res.byKind['schema']).toBe(2);
    expect(res.byKind['semantic']).toBe(1);
    expect(res.byProvider['openai']).toBe(2);
    expect(res.byProvider['anthropic']).toBe(1);
    expect(res.byModel['gpt-4o']).toBe(2);
  });

  it('ranks topIssues by frequency', async () => {
    for (let i = 0; i < 3; i++) {
      await storage.snapshots.saveSnapshot(snapshot({
        validations: [{ kind: 'schema', passed: false,
          issues: [{ type: 'COMMON_BUG', message: 'm', severity: 'warning', path: '' }] }],
      }));
    }
    await storage.snapshots.saveSnapshot(snapshot({
      validations: [{ kind: 'schema', passed: false,
        issues: [{ type: 'RARE_BUG', message: 'm', severity: 'critical', path: '' }] }],
    }));
    const res = await engine.queryValidationFailures();
    expect(res.topIssues[0].issueType).toBe('COMMON_BUG');
    expect(res.topIssues[0].count).toBe(3);
    expect(res.topIssues[1].issueType).toBe('RARE_BUG');
  });

  it('filters by provider', async () => {
    await storage.snapshots.saveSnapshot(snapshot({
      provider: 'openai',
      validations: [{ kind: 'schema', passed: false,
        issues: [{ type: 'T', message: 'm', severity: 'warning', path: '' }] }],
    }));
    await storage.snapshots.saveSnapshot(snapshot({
      provider: 'anthropic',
      validations: [{ kind: 'schema', passed: false,
        issues: [{ type: 'T', message: 'm', severity: 'warning', path: '' }] }],
    }));
    const res = await engine.queryValidationFailures({ provider: 'anthropic' });
    expect(res.total).toBe(1);
    expect(res.items[0].provider).toBe('anthropic');
  });

  it('paginates items', async () => {
    for (let i = 0; i < 4; i++) {
      await storage.snapshots.saveSnapshot(snapshot({
        validations: [{ kind: 'schema', passed: false,
          issues: [{ type: 'T', message: 'm', severity: 'warning', path: '' }] }],
      }));
    }
    const p1 = await engine.queryValidationFailures({ limit: 2, offset: 0 });
    expect(p1.items).toHaveLength(2);
    expect(p1.hasMore).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. queryHallucinationReports
// ---------------------------------------------------------------------------

describe('queryHallucinationReports', () => {
  it('returns zeroed result when no snapshots with checks exist', async () => {
    await storage.snapshots.saveSnapshot(snapshot({ hallucinationChecks: [] }));
    const res = await engine.queryHallucinationReports();
    expect(res.totalChecks).toBe(0);
    expect(res.detectionRate).toBe(0);
  });

  it('counts detection rate correctly', async () => {
    await storage.snapshots.saveSnapshot(snapshot({
      hallucinationChecks: [
        { hallucinationScore: 0.8, isHallucinated: true,  riskLevel: 'high',   issues: [] },
      ],
    }));
    await storage.snapshots.saveSnapshot(snapshot({
      hallucinationChecks: [
        { hallucinationScore: 0.1, isHallucinated: false, riskLevel: 'low',    issues: [] },
      ],
    }));
    const res = await engine.queryHallucinationReports();
    expect(res.totalChecks).toBe(2);
    expect(res.detectionCount).toBe(1);
    expect(res.detectionRate).toBe(0.5);
  });

  it('computes avgScore and score distribution', async () => {
    await storage.snapshots.saveSnapshot(snapshot({
      hallucinationChecks: [{ hallucinationScore: 0.1, isHallucinated: false, riskLevel: 'low', issues: [] }],
    }));
    await storage.snapshots.saveSnapshot(snapshot({
      hallucinationChecks: [{ hallucinationScore: 0.5, isHallucinated: false, riskLevel: 'medium', issues: [] }],
    }));
    await storage.snapshots.saveSnapshot(snapshot({
      hallucinationChecks: [{ hallucinationScore: 0.9, isHallucinated: true,  riskLevel: 'high',   issues: [] }],
    }));
    const res = await engine.queryHallucinationReports();
    expect(res.avgScore).toBeCloseTo(0.5, 5);
    expect(res.scoreDistribution.low).toBe(1);    // 0.1 < 0.4
    expect(res.scoreDistribution.medium).toBe(1); // 0.4 ≤ 0.5 < 0.7
    expect(res.scoreDistribution.high).toBe(1);   // 0.9 ≥ 0.7
  });

  it('builds per-provider breakdown', async () => {
    await storage.snapshots.saveSnapshot(snapshot({
      provider: 'openai',
      hallucinationChecks: [{ hallucinationScore: 0.7, isHallucinated: true,  riskLevel: 'high', issues: [] }],
    }));
    await storage.snapshots.saveSnapshot(snapshot({
      provider: 'anthropic',
      hallucinationChecks: [{ hallucinationScore: 0.1, isHallucinated: false, riskLevel: 'low',  issues: [] }],
    }));
    const res = await engine.queryHallucinationReports();
    expect(res.byProvider['openai'].detectionRate).toBe(1);
    expect(res.byProvider['anthropic'].detectionRate).toBe(0);
  });

  it('ranks topIssues by frequency', async () => {
    const issueSnap = (type: string) => snapshot({
      hallucinationChecks: [{
        hallucinationScore: 0.6, isHallucinated: true, riskLevel: 'medium',
        issues: [{ type, message: 'x', confidence: 0.9 }],
      }],
    });
    await storage.snapshots.saveSnapshot(issueSnap('FACTUAL'));
    await storage.snapshots.saveSnapshot(issueSnap('FACTUAL'));
    await storage.snapshots.saveSnapshot(issueSnap('CITATION'));
    const res = await engine.queryHallucinationReports();
    expect(res.topIssues[0].issueType).toBe('FACTUAL');
    expect(res.topIssues[0].count).toBe(2);
  });

  it('sorts items by highest hallucinationScore descending', async () => {
    await storage.snapshots.saveSnapshot(snapshot({
      hallucinationChecks: [{ hallucinationScore: 0.3, isHallucinated: false, riskLevel: 'low',  issues: [] }],
    }));
    await storage.snapshots.saveSnapshot(snapshot({
      hallucinationChecks: [{ hallucinationScore: 0.9, isHallucinated: true,  riskLevel: 'high', issues: [] }],
    }));
    const res = await engine.queryHallucinationReports();
    expect(res.items[0].hallucinationScore).toBe(0.9);
    expect(res.items[1].hallucinationScore).toBe(0.3);
  });

  it('filters by provider', async () => {
    await storage.snapshots.saveSnapshot(snapshot({
      provider: 'openai',
      hallucinationChecks: [{ hallucinationScore: 0.8, isHallucinated: true, riskLevel: 'high', issues: [] }],
    }));
    await storage.snapshots.saveSnapshot(snapshot({
      provider: 'gemini',
      hallucinationChecks: [{ hallucinationScore: 0.2, isHallucinated: false, riskLevel: 'low', issues: [] }],
    }));
    const res = await engine.queryHallucinationReports({ provider: 'gemini' });
    expect(res.totalChecks).toBe(1);
    expect(res.items[0].provider).toBe('gemini');
  });

  it('paginates items', async () => {
    for (let i = 0; i < 3; i++) {
      await storage.snapshots.saveSnapshot(snapshot({
        hallucinationChecks: [{ hallucinationScore: 0.5, isHallucinated: false, riskLevel: 'medium', issues: [] }],
      }));
    }
    const p = await engine.queryHallucinationReports({ limit: 2, offset: 0 });
    expect(p.items).toHaveLength(2);
    expect(p.hasMore).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. queryProviderReliability
// ---------------------------------------------------------------------------

describe('queryProviderReliability', () => {
  it('returns empty providers list when no data exists', async () => {
    const res = await engine.queryProviderReliability();
    expect(res.providers).toHaveLength(0);
    expect(res.bestProvider).toBeUndefined();
  });

  it('builds ProviderStats from traces', async () => {
    const now = Date.now();
    await storage.traces.saveTrace(trace('openai', 'gpt-4o', 'ok',    400, now));
    await storage.traces.saveTrace(trace('openai', 'gpt-4o', 'ok',    600, now + 1));
    await storage.traces.saveTrace(trace('openai', 'gpt-4o', 'error', 800, now + 2));
    const res = await engine.queryProviderReliability();
    const openai = res.providers.find((p) => p.provider === 'openai')!;
    expect(openai).toBeDefined();
    expect(openai.totalRequests).toBe(3);
    expect(openai.successCount).toBe(2);
    expect(openai.errorCount).toBe(1);
    expect(openai.successRate).toBeCloseTo(2 / 3, 5);
  });

  it('includes models list from traces', async () => {
    const now = Date.now();
    await storage.traces.saveTrace(trace('openai', 'gpt-4o',  'ok', 300, now));
    await storage.traces.saveTrace(trace('openai', 'gpt-3.5', 'ok', 200, now + 1));
    const res = await engine.queryProviderReliability();
    const openai = res.providers.find((p) => p.provider === 'openai')!;
    expect(openai.models).toContain('gpt-4o');
    expect(openai.models).toContain('gpt-3.5');
  });

  it('computes retryRate from metric events', async () => {
    const now = Date.now();
    await storage.traces.saveTrace(trace('openai', 'gpt-4o', 'ok', 300, now));
    await storage.metrics.saveMetric(
      metric('retry', 'openai', 'gpt-4o', { attempt: 2, maxAttempts: 3, reason: 'rate_limit', delayMs: 500 }),
    );
    const res = await engine.queryProviderReliability();
    const openai = res.providers.find((p) => p.provider === 'openai')!;
    expect(openai.retryRate).toBeGreaterThan(0);
  });

  it('computes token totals from token.usage metrics', async () => {
    const now = Date.now();
    await storage.traces.saveTrace(trace('openai', 'gpt-4o', 'ok', 300, now));
    await storage.metrics.saveMetrics([
      metric('token.usage', 'openai', 'gpt-4o', { promptTokens: 100, completionTokens: 200, totalTokens: 300 }),
      metric('token.usage', 'openai', 'gpt-4o', { promptTokens: 50,  completionTokens: 50,  totalTokens: 100 }),
    ]);
    const res = await engine.queryProviderReliability();
    const openai = res.providers.find((p) => p.provider === 'openai')!;
    expect(openai.totalTokens).toBe(400);
  });

  it('derives validationFailureRate from snapshots', async () => {
    const now = Date.now();
    await storage.traces.saveTrace(trace('openai', 'gpt-4o', 'ok', 300, now));
    await storage.snapshots.saveSnapshot(snapshot({
      provider: 'openai',
      validations: [{ kind: 'schema', passed: false,
        issues: [{ type: 'T', message: 'm', severity: 'critical', path: '' }] }],
    }));
    await storage.snapshots.saveSnapshot(snapshot({
      provider: 'openai',
      validations: [{ kind: 'schema', passed: true, issues: [] }],
    }));
    const res = await engine.queryProviderReliability();
    const openai = res.providers.find((p) => p.provider === 'openai')!;
    expect(openai.validationFailureRate).toBe(0.5);
  });

  it('derives hallucinationDetectionRate from snapshots', async () => {
    const now = Date.now();
    await storage.traces.saveTrace(trace('openai', 'gpt-4o', 'ok', 300, now));
    await storage.snapshots.saveSnapshot(snapshot({
      provider: 'openai',
      hallucinationChecks: [{ hallucinationScore: 0.8, isHallucinated: true,  riskLevel: 'high', issues: [] }],
    }));
    await storage.snapshots.saveSnapshot(snapshot({
      provider: 'openai',
      hallucinationChecks: [{ hallucinationScore: 0.1, isHallucinated: false, riskLevel: 'low',  issues: [] }],
    }));
    const res = await engine.queryProviderReliability();
    const openai = res.providers.find((p) => p.provider === 'openai')!;
    expect(openai.hallucinationDetectionRate).toBe(0.5);
  });

  it('computes reliabilityScore between 0 and 100', async () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      await storage.traces.saveTrace(trace('openai', 'gpt-4o', 'ok', 300, now + i));
    }
    const res = await engine.queryProviderReliability();
    const openai = res.providers.find((p) => p.provider === 'openai')!;
    expect(openai.reliabilityScore).toBeGreaterThanOrEqual(0);
    expect(openai.reliabilityScore).toBeLessThanOrEqual(100);
  });

  it('identifies bestProvider, fastestProvider, mostUsedProvider', async () => {
    const now = Date.now();
    // openai: 5 requests (most used), medium latency
    for (let i = 0; i < 5; i++) {
      await storage.traces.saveTrace(trace('openai', 'gpt-4o', 'ok', 500, now + i));
    }
    // anthropic: 1 request, fastest
    await storage.traces.saveTrace(trace('anthropic', 'claude', 'ok', 50, now + 10));

    const res = await engine.queryProviderReliability();
    expect(res.mostUsedProvider).toBe('openai');
    expect(res.fastestProvider).toBe('anthropic');
  });

  it('sorts providers by reliability score descending', async () => {
    const now = Date.now();
    // perfect openai
    for (let i = 0; i < 3; i++) {
      await storage.traces.saveTrace(trace('openai', 'gpt-4o', 'ok', 300, now + i));
    }
    // failing gemini
    await storage.traces.saveTrace(trace('gemini', 'gemini-pro', 'error', 2_000, now + 100));

    const res = await engine.queryProviderReliability();
    expect(res.providers[0].provider).toBe('openai');
    expect(res.providers[0].reliabilityScore).toBeGreaterThan(res.providers[1].reliabilityScore);
  });

  it('filters by provider dimension', async () => {
    const now = Date.now();
    await storage.traces.saveTrace(trace('openai',    'gpt-4o', 'ok', 300, now));
    await storage.traces.saveTrace(trace('anthropic', 'claude', 'ok', 200, now + 1));
    const res = await engine.queryProviderReliability({ provider: 'anthropic' });
    expect(res.providers.every((p) => p.provider === 'anthropic')).toBe(true);
  });

  it('filters by time range', async () => {
    const now = Date.now();
    await storage.traces.saveTrace(trace('openai', 'gpt-4o', 'ok', 300, now - 10_000));
    await storage.traces.saveTrace(trace('openai', 'gpt-4o', 'ok', 300, now - 500));
    const res = await engine.queryProviderReliability({ timeRange: { start: now - 2_000, end: now } });
    const openai = res.providers.find((p) => p.provider === 'openai');
    expect(openai?.totalRequests).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Global singleton smoke test
// ---------------------------------------------------------------------------

describe('observabilityQuery singleton', () => {
  it('is an ObservabilityQueryEngine instance', async () => {
    const { observabilityQuery } = await import('../src/query/index.js');
    expect(observabilityQuery).toBeInstanceOf(ObservabilityQueryEngine);
  });
});
