import { describe, it, expect, beforeEach } from 'vitest';

import {
  SnapshotStore,
  SnapshotCollector,
  snapshotStore,
  generateSnapshotId,
  redactSnapshot,
  resolveRedactionConfig,
  fromProviderResponse,
  fromNormalization,
  fromValidationResult,
  fromHallucinationCheck,
  fromRepairResult,
  fromRetryAttempt,
  fromErrorResult,
  fromThrownError,
} from '../src/debug/index.js';

import { success, error as makeError } from '../src/errors/result.js';

import type {
  DebugSnapshot,
  CapturedProviderResponse,
  CapturedValidation,
  SnapshotStoreConfig,
} from '../src/debug/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProviderResponse(overrides: Partial<CapturedProviderResponse> = {}): CapturedProviderResponse {
  return {
    id: 'resp-1',
    content: 'Hello world',
    model: 'gpt-4o-mini',
    finishReason: 'stop',
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    capturedAt: Date.now(),
    ...overrides,
  };
}

function makeStore(cfg?: SnapshotStoreConfig): SnapshotStore {
  return new SnapshotStore(cfg);
}

// ---------------------------------------------------------------------------
// generateSnapshotId
// ---------------------------------------------------------------------------

describe('generateSnapshotId', () => {
  it('produces a unique string prefixed with snap_', () => {
    const id1 = generateSnapshotId();
    const id2 = generateSnapshotId();
    expect(id1).toMatch(/^snap_/);
    expect(id2).toMatch(/^snap_/);
    expect(id1).not.toBe(id2);
  });
});

// ---------------------------------------------------------------------------
// SnapshotCollector
// ---------------------------------------------------------------------------

describe('SnapshotCollector', () => {
  let store: SnapshotStore;

  beforeEach(() => {
    store = makeStore();
  });

  it('creates a snapshot with the correct requestId', () => {
    const col = store.collect('req-123');
    const snap = col.complete();
    expect(snap.requestId).toBe('req-123');
  });

  it('auto-generates requestId when store.collect() called with no argument', () => {
    const col = store.collect();
    const snap = col.complete();
    expect(typeof snap.requestId).toBe('string');
    expect(snap.requestId.length).toBeGreaterThan(0);
  });

  it('defaults status to success when no error or failing validation', () => {
    const snap = store.collect('r1').complete();
    expect(snap.status).toBe('success');
  });

  it('derives status as failure when setError is called', () => {
    const col = store.collect('r1');
    col.setError({ type: 'PROVIDER_ERROR', message: 'oops', capturedAt: Date.now() });
    expect(col.complete().status).toBe('failure');
  });

  it('derives status as failure when a validation fails', () => {
    const col = store.collect('r1');
    col.addValidation({ kind: 'schema', passed: false, issues: [], capturedAt: Date.now() });
    expect(col.complete().status).toBe('failure');
  });

  it('derives status as failure when a hallucination check fires', () => {
    const col = store.collect('r1');
    col.addHallucinationCheck({
      hallucinationScore: 0.9,
      isHallucinated: true,
      riskLevel: 'high',
      issues: [],
      capturedAt: Date.now(),
    });
    expect(col.complete().status).toBe('failure');
  });

  it('respects explicit setStatus over auto-derivation', () => {
    const col = store.collect('r1')
      .setStatus('partial')
      .setError({ type: 'UNKNOWN_ERROR', message: 'x', capturedAt: Date.now() });
    expect(col.complete().status).toBe('partial');
  });

  it('accumulates multiple validations and retries', () => {
    const col = store.collect('r1');
    col.addValidation({ kind: 'schema',   passed: true, issues: [], capturedAt: Date.now() });
    col.addValidation({ kind: 'semantic', passed: true, issues: [], capturedAt: Date.now() });
    col.addRetry({ attempt: 1, errorMessage: 'timeout', delayMs: 500, strategy: 'exponential', capturedAt: Date.now() });
    col.addRetry({ attempt: 2, errorMessage: 'timeout', delayMs: 1000, strategy: 'exponential', capturedAt: Date.now() });
    const snap = col.complete();
    expect(snap.validations).toHaveLength(2);
    expect(snap.retries).toHaveLength(2);
  });

  it('auto-sets model from providerResponse', () => {
    const col = store.collect('r1');
    col.setProviderResponse(makeProviderResponse({ model: 'gpt-4o' }));
    expect(col.complete().model).toBe('gpt-4o');
  });

  it('auto-sets provider and model from normalization output', () => {
    const col = store.collect('r1');
    const input = makeProviderResponse();
    col.setNormalization({
      input,
      output: {
        id: 'n1', content: 'Hi', model: 'gpt-4o', provider: 'OpenAI',
        finishReason: 'stop', timestamp: Date.now(),
      },
      capturedAt: Date.now(),
    });
    const snap = col.complete();
    expect(snap.provider).toBe('OpenAI');
    expect(snap.model).toBe('gpt-4o');
  });

  it('explicit setProvider/setModel overrides auto-detection', () => {
    const col = store.collect('r1')
      .setProvider('MyProvider')
      .setModel('my-model')
      .setProviderResponse(makeProviderResponse({ model: 'gpt-4o' }));
    const snap = col.complete();
    expect(snap.provider).toBe('MyProvider');
    expect(snap.model).toBe('my-model');
  });

  it('peek() returns snapshot without committing to store', () => {
    const col = store.collect('r1');
    col.addTag('debug');
    col.peek();
    expect(store.size()).toBe(0);
  });

  it('complete() commits to the store', () => {
    store.collect('r1').complete();
    expect(store.size()).toBe(1);
  });

  it('includes capturedAt and durationMs on the snapshot', () => {
    const snap = store.collect('r1').complete();
    expect(snap.capturedAt).toBeGreaterThan(0);
    expect(snap.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('addTag deduplicates', () => {
    const col = store.collect('r1').addTag('a').addTag('a').addTag('b');
    expect(col.complete().tags).toEqual(['a', 'b']);
  });

  it('setAttribute / setAttributes work', () => {
    const col = store.collect('r1')
      .setAttribute('env', 'test')
      .setAttributes({ region: 'us-east', version: 1 });
    const snap = col.complete();
    expect(snap.attributes?.env).toBe('test');
    expect(snap.attributes?.region).toBe('us-east');
    expect(snap.attributes?.version).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// SnapshotStore
// ---------------------------------------------------------------------------

describe('SnapshotStore', () => {
  it('get() returns undefined for unknown IDs', () => {
    expect(makeStore().get('nope')).toBeUndefined();
  });

  it('getAll() returns snapshots in insertion order', () => {
    const store = makeStore();
    store.collect('r1').complete();
    store.collect('r2').complete();
    store.collect('r3').complete();
    const ids = store.getAll().map((s) => s.requestId);
    expect(ids).toEqual(['r1', 'r2', 'r3']);
  });

  it('getByRequestId() returns only matching snapshots', () => {
    const store = makeStore();
    store.collect('r1').complete();
    store.collect('r1').complete();  // two snapshots for same request
    store.collect('r2').complete();
    expect(store.getByRequestId('r1')).toHaveLength(2);
    expect(store.getByRequestId('r2')).toHaveLength(1);
    expect(store.getByRequestId('r3')).toHaveLength(0);
  });

  it('getFailures() returns only failure snapshots', () => {
    const store = makeStore();
    store.collect('success').complete();
    store.collect('fail')
      .setError({ type: 'PROVIDER_ERROR', message: 'bad', capturedAt: Date.now() })
      .complete();
    const failures = store.getFailures();
    expect(failures).toHaveLength(1);
    expect(failures[0].requestId).toBe('fail');
  });

  it('filter() applies a custom predicate', () => {
    const store = makeStore();
    store.collect('r1').addTag('slow').complete();
    store.collect('r2').complete();
    const slow = store.filter((s) => s.tags?.includes('slow') ?? false);
    expect(slow).toHaveLength(1);
  });

  it('clear() empties the store', () => {
    const store = makeStore();
    store.collect('r1').complete();
    store.collect('r2').complete();
    store.clear();
    expect(store.size()).toBe(0);
    expect(store.getAll()).toHaveLength(0);
  });

  it('export() returns valid JSON containing all snapshots', () => {
    const store = makeStore();
    store.collect('r1').setAttribute('x', 1).complete();
    store.collect('r2').complete();
    const json = store.export();
    const parsed = JSON.parse(json) as DebugSnapshot[];
    expect(parsed).toHaveLength(2);
    expect(parsed[0].requestId).toBe('r1');
  });

  it('exportOne() returns JSON for a single snapshot', () => {
    const store = makeStore();
    const snap = store.collect('r1').complete();
    const json = store.exportOne(snap.id);
    expect(json).toBeDefined();
    const parsed = JSON.parse(json!) as DebugSnapshot;
    expect(parsed.id).toBe(snap.id);
  });

  it('exportOne() returns undefined for unknown ID', () => {
    expect(makeStore().exportOne('no-such-id')).toBeUndefined();
  });

  // ── Retention: maxSnapshots ────────────────────────────────────────────────

  it('evicts the oldest snapshot when maxSnapshots is reached', () => {
    const store = makeStore({ retention: { maxSnapshots: 3 } });
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const snap = store.collect(`r${i}`).complete();
      ids.push(snap.id);
    }
    expect(store.size()).toBe(3);
    expect(store.get(ids[0])).toBeUndefined();  // oldest evicted
    expect(store.get(ids[3])).toBeDefined();     // newest kept
  });

  // ── Retention: maxAgeMs ────────────────────────────────────────────────────

  it('get() returns undefined for expired snapshots', async () => {
    const store = makeStore({ retention: { maxAgeMs: 50 } });
    const snap = store.collect('r1').complete();
    await new Promise((r) => setTimeout(r, 80));
    expect(store.get(snap.id)).toBeUndefined();
  });

  it('getAll() excludes expired snapshots', async () => {
    const store = makeStore({ retention: { maxAgeMs: 50 } });
    store.collect('r1').complete();
    await new Promise((r) => setTimeout(r, 80));
    store.collect('r2').complete();  // fresh snapshot
    const all = store.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].requestId).toBe('r2');
  });

  // ── Retention: policy ─────────────────────────────────────────────────────

  it('failures-only policy discards success snapshots', () => {
    const store = makeStore({ retention: { policy: 'failures-only' } });
    store.collect('r1').complete(); // success
    store.collect('r2')
      .setError({ type: 'PROVIDER_ERROR', message: 'err', capturedAt: Date.now() })
      .complete();
    expect(store.size()).toBe(1);
    expect(store.getAll()[0].status).toBe('failure');
  });

  it('sampled policy keeps approximately sampleRate fraction', () => {
    const store = makeStore({ retention: { policy: 'sampled', sampleRate: 0.5 } });
    for (let i = 0; i < 200; i++) store.collect(`r${i}`).complete();
    // With sampleRate=0.5 and 200 attempts we expect roughly 100 kept.
    // Allow a wide margin (40–160) to avoid flakiness.
    expect(store.size()).toBeGreaterThan(40);
    expect(store.size()).toBeLessThan(160);
  });
});

// ---------------------------------------------------------------------------
// Redactor
// ---------------------------------------------------------------------------

describe('redactSnapshot', () => {
  function makeSnap(overrides: Partial<DebugSnapshot> = {}): DebugSnapshot {
    return {
      id: generateSnapshotId(),
      requestId: 'r1',
      capturedAt: Date.now(),
      status: 'success',
      validations: [],
      hallucinationChecks: [],
      retries: [],
      ...overrides,
    };
  }

  it('returns the original reference when enabled: false', () => {
    const snap = makeSnap();
    const result = redactSnapshot(snap, { enabled: false });
    expect(result).toBe(snap);
  });

  it('does not mutate the original snapshot', () => {
    const snap = makeSnap({
      attributes: { apiKey: 'sk-secret123456789012345' },
    });
    redactSnapshot(snap, { enabled: true });
    expect((snap.attributes as Record<string, unknown>).apiKey).toBe('sk-secret123456789012345');
  });

  it('redacts sensitive field names in attributes', () => {
    const snap = makeSnap({
      attributes: { apiKey: 'sk-abc', normalValue: 'keep-me' },
    });
    const result = redactSnapshot(snap, {});
    expect(result.attributes?.apiKey).toBe('[REDACTED]');
    expect(result.attributes?.normalValue).toBe('keep-me');
  });

  it('redacts API key patterns in string values', () => {
    const snap = makeSnap({
      attributes: { info: 'token is sk-supersecretkey0000000000' },
    });
    const result = redactSnapshot(snap, {});
    expect(result.attributes?.info).toContain('[REDACTED]');
    expect(result.attributes?.info).not.toContain('sk-');
  });

  it('redacts prompt when redactPrompts: true (string)', () => {
    const snap = makeSnap({
      request: { prompt: 'My secret prompt', capturedAt: Date.now() },
    });
    const result = redactSnapshot(snap, { redactPrompts: true });
    expect(result.request?.prompt).toBe('[REDACTED]');
  });

  it('redacts each message content when redactPrompts: true (array)', () => {
    const snap = makeSnap({
      request: {
        prompt: [
          { role: 'user', content: 'secret message' },
          { role: 'assistant', content: 'response' },
        ],
        capturedAt: Date.now(),
      },
    });
    const result = redactSnapshot(snap, { redactPrompts: true });
    const msgs = result.request!.prompt as Array<{ role: string; content: string }>;
    expect(msgs[0].content).toBe('[REDACTED]');
    expect(msgs[1].content).toBe('[REDACTED]');
    expect(msgs[0].role).toBe('user'); // role is preserved
  });

  it('removes raw payload when redactRawResponses: true', () => {
    const snap = makeSnap({
      providerResponse: makeProviderResponse({ raw: { secret: 'data' } as any }),
    });
    const result = redactSnapshot(snap, { redactRawResponses: true });
    expect(result.providerResponse?.raw).toBeUndefined();
  });

  it('redacts nested raw payload fields when redactRawResponses: false', () => {
    const snap = makeSnap({
      providerResponse: makeProviderResponse({
        raw: { authorization: 'Bearer tok123456789012', content: 'hello' } as any,
      }),
    });
    const result = redactSnapshot(snap, { redactRawResponses: false });
    const raw = result.providerResponse!.raw as Record<string, unknown>;
    expect(raw.authorization).toBe('[REDACTED]');
    expect(raw.content).toBe('hello');
  });

  it('uses custom replacement string', () => {
    const snap = makeSnap({ attributes: { password: 'hunter2' } });
    const result = redactSnapshot(snap, { replacement: '***' });
    expect(result.attributes?.password).toBe('***');
  });

  it('calls customRedactor for string values', () => {
    const snap = makeSnap({ attributes: { data: 'hello' } });
    const result = redactSnapshot(snap, {
      customRedactor: (k, v) => (k === 'data' ? 'replaced' : v),
    });
    expect(result.attributes?.data).toBe('replaced');
  });

  it('merges user-supplied fields with built-in sensitive fields', () => {
    const snap = makeSnap({ attributes: { mySecretField: 'shh', normal: 'ok' } });
    const result = redactSnapshot(snap, { fields: ['mySecretField'] });
    expect(result.attributes?.mySecretField).toBe('[REDACTED]');
    expect(result.attributes?.normal).toBe('ok');
  });
});

// ---------------------------------------------------------------------------
// Adapter helpers
// ---------------------------------------------------------------------------

describe('fromProviderResponse', () => {
  it('converts a GenerateResponse to CapturedProviderResponse', () => {
    const raw = {
      id: 'r1',
      content: 'Hello',
      model: 'gpt-4o',
      finishReason: 'stop' as const,
      usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
    };
    const cap = fromProviderResponse(raw, 300);
    expect(cap.id).toBe('r1');
    expect(cap.model).toBe('gpt-4o');
    expect(cap.durationMs).toBe(300);
    expect(cap.usage?.totalTokens).toBe(8);
    expect(cap.capturedAt).toBeGreaterThan(0);
  });

  it('handles missing finishReason and usage gracefully', () => {
    const raw = { id: 'r2', content: '', model: 'test' };
    const cap = fromProviderResponse(raw);
    expect(cap.finishReason).toBeNull();
    expect(cap.usage).toBeUndefined();
  });
});

describe('fromNormalization', () => {
  it('builds CapturedNormalization from input and NormalizedResponse', () => {
    const input = makeProviderResponse();
    const norm = {
      id: 'n1', content: 'Hi', model: 'gpt-4o', provider: 'OpenAI',
      finishReason: 'stop' as const,
      timestamp: Date.now(),
      usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8, estimatedCost: 0.001 },
      processingTime: 120,
      raw: {},
    } as any;
    const cap = fromNormalization(input, norm);
    expect(cap.output.provider).toBe('OpenAI');
    expect(cap.output.usage?.estimatedCost).toBe(0.001);
    expect(cap.output.processingTime).toBe(120);
  });
});

describe('fromValidationResult', () => {
  it('maps success result to passed: true', () => {
    const result = success({ name: 'Alice' });
    const cap = fromValidationResult(result, 'schema', 42);
    expect(cap.passed).toBe(true);
    expect(cap.issues).toHaveLength(0);
    expect(cap.durationMs).toBe(42);
  });

  it('maps error result to passed: false with issues', () => {
    const result = makeError('SCHEMA_VALIDATION_ERROR', 'invalid', {
      validationIssues: ['name: required', 'age: must be a number'],
    });
    const cap = fromValidationResult(result, 'schema');
    expect(cap.passed).toBe(false);
    expect(cap.issues).toHaveLength(2);
    expect(cap.issues[0].message).toBe('name: required');
    expect(cap.issues[0].severity).toBe('error');
  });
});

describe('fromHallucinationCheck', () => {
  it('captures hallucination result correctly', () => {
    const result = {
      hallucinationScore: 0.8,
      isHallucinated: true,
      issues: [{
        type: 'unsupported_claim',
        severity: 'high',
        description: 'Claim not grounded',
        problematicText: 'The moon is made of cheese',
        confidence: 0.95,
      }],
    };
    const cap = fromHallucinationCheck(result, 'high', 200);
    expect(cap.isHallucinated).toBe(true);
    expect(cap.riskLevel).toBe('high');
    expect(cap.issues[0].type).toBe('unsupported_claim');
    expect(cap.durationMs).toBe(200);
  });
});

describe('fromRepairResult', () => {
  it('captures successful repair', () => {
    const result = success('{"name":"Alice"}');
    const cap = fromRepairResult(result, "{name: 'Alice'}");
    expect(cap.success).toBe(true);
    expect(cap.repairedOutput).toBe('{"name":"Alice"}');
    expect(cap.originalInput).toBe("{name: 'Alice'}");
  });

  it('captures failed repair', () => {
    const result = makeError('JSON_REPAIR_ERROR', 'could not repair');
    const cap = fromRepairResult(result, 'bad json{{');
    expect(cap.success).toBe(false);
    expect(cap.errorMessage).toBe('could not repair');
    expect(cap.repairedOutput).toBeUndefined();
  });
});

describe('fromRetryAttempt', () => {
  it('extracts message from Error instance', () => {
    const cap = fromRetryAttempt(new Error('ECONNREFUSED'), 2, 1000, 'exponential');
    expect(cap.attempt).toBe(2);
    expect(cap.errorMessage).toBe('ECONNREFUSED');
    expect(cap.delayMs).toBe(1000);
    expect(cap.strategy).toBe('exponential');
  });

  it('converts non-Error to string', () => {
    const cap = fromRetryAttempt('plain string error', 1, 0, 'fixed');
    expect(cap.errorMessage).toBe('plain string error');
  });
});

describe('fromErrorResult', () => {
  it('converts ErrorResult to CapturedError', () => {
    const result = makeError('RETRY_EXHAUSTED_ERROR', 'all retries failed', {
      retries: 3,
      provider: 'OpenAI',
    });
    const cap = fromErrorResult(result);
    expect(cap.type).toBe('RETRY_EXHAUSTED_ERROR');
    expect(cap.message).toBe('all retries failed');
    expect(cap.details?.retries).toBe(3);
    expect(cap.details?.provider).toBe('OpenAI');
  });
});

describe('fromThrownError', () => {
  it('captures Error instance', () => {
    const cap = fromThrownError(new Error('network down'), 'PROVIDER_ERROR');
    expect(cap.type).toBe('PROVIDER_ERROR');
    expect(cap.message).toBe('network down');
  });

  it('includes stack when includeStack: true', () => {
    const cap = fromThrownError(new Error('oops'), 'UNKNOWN_ERROR', true);
    expect(cap.stack).toBeDefined();
    expect(cap.stack).toContain('Error: oops');
  });

  it('defaults type to UNKNOWN_ERROR', () => {
    const cap = fromThrownError('whoops');
    expect(cap.type).toBe('UNKNOWN_ERROR');
    expect(cap.message).toBe('whoops');
  });
});

// ---------------------------------------------------------------------------
// Global singleton smoke test
// ---------------------------------------------------------------------------

describe('snapshotStore singleton', () => {
  it('is a SnapshotStore instance', () => {
    expect(snapshotStore).toBeInstanceOf(SnapshotStore);
  });
});

// ---------------------------------------------------------------------------
// End-to-end: full pipeline snapshot
// ---------------------------------------------------------------------------

describe('end-to-end pipeline snapshot', () => {
  it('captures a complete request lifecycle and serializes cleanly', () => {
    const store = makeStore({ redaction: { redactPrompts: true } });
    const col = store.collect('e2e-req-1');

    // Request
    col.setRequest({ prompt: 'My secret question', capturedAt: Date.now() });

    // Provider response
    const provResp = makeProviderResponse();
    col.setProviderResponse(provResp);

    // Repair
    col.setRepair(fromRepairResult(success('{"answer":42}'), '{answer: 42}'));

    // Normalization
    col.setNormalization({
      input: provResp,
      output: {
        id: 'n1', content: 'answer is 42', model: 'gpt-4o',
        provider: 'OpenAI', finishReason: 'stop', timestamp: Date.now(),
      },
      capturedAt: Date.now(),
    });

    // Validations
    col.addValidation(fromValidationResult(success(true), 'schema'));
    col.addValidation(fromValidationResult(
      makeError('SCHEMA_VALIDATION_ERROR', 'bad', { validationIssues: ['field x invalid'] }),
      'semantic',
    ));

    // Hallucination
    col.addHallucinationCheck(fromHallucinationCheck(
      { hallucinationScore: 0.1, isHallucinated: false, issues: [] },
      'low',
    ));

    // Retries
    col.addRetry(fromRetryAttempt(new Error('timeout'), 1, 500, 'exponential'));

    const snapshot = col.complete();

    // Status should be failure because one validation failed
    expect(snapshot.status).toBe('failure');
    expect(snapshot.provider).toBe('OpenAI');
    expect(snapshot.validations).toHaveLength(2);
    expect(snapshot.retries).toHaveLength(1);

    // Prompt should be redacted
    expect(snapshot.request?.prompt).toBe('[REDACTED]');

    // Full round-trip serialization
    const json = JSON.stringify(snapshot);
    const parsed = JSON.parse(json) as DebugSnapshot;
    expect(parsed.id).toBe(snapshot.id);
    expect(parsed.validations).toHaveLength(2);
    expect(parsed.retries[0].strategy).toBe('exponential');
  });
});
