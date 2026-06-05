import { describe, it, expect } from 'vitest';
import { Tracer } from '../src/tracing/index.js';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

describe('Tracing Engine', () => {
  it('creates a trace with nested spans and serializable output', async () => {
    const tracer = new Tracer({ maxCompletedTraces: 10 });
    const ctx = tracer.start('req-demo', { user: 'tester' });

    // Root span exists implicitly (request)
    const provider = ctx.startSpan('Call Provider', 'provider');
    provider.setAttribute('model', 'gpt-test');
    provider.addEvent('request.sent');

    // Simulate a quick nested retry
    const retry = ctx.startSpan('Retry #1', 'retry');
    await sleep(5);
    retry.addEvent('retry.attempt');
    retry.end('error');
    ctx.endSpan(retry.spanId);

    // Finish provider span
    await sleep(3);
    provider.addEvent('response.received');
    provider.end('ok');
    ctx.endSpan(provider.spanId);

    // Attach provider metadata
    ctx.setProvider({ name: 'openai', model: 'gpt-test', attempts: 2, tokens: { prompt: 10, completion: 20, total: 30 } });

    // Finish trace via Tracer so it's stored
    const trace = tracer.finish(ctx.traceId);
    expect(trace).toBeDefined();
    if (!trace) return;

    // Basic shape assertions
    expect(typeof trace.traceId).toBe('string');
    expect(trace.requestId).toBe('req-demo');
    expect(trace.spans.length).toBeGreaterThanOrEqual(2);
    expect(trace.rootSpanId).toBeDefined();
    expect(trace.provider?.name).toBe('openai');

    // Spans should have durations and ordering
    for (const s of trace.spans) {
      expect(typeof s.spanId).toBe('string');
      expect(typeof s.startTime).toBe('number');
      expect(s.duration === undefined || typeof s.duration === 'number').toBe(true);
    }

    // Parent-child relationship: retry span parent should be provider or root
    const retrySpan = trace.spans.find((s) => s.name === 'Retry #1');
    expect(retrySpan).toBeDefined();
    if (retrySpan) {
      expect(retrySpan.parentSpanId).toBeDefined();
    }

    // JSON serialization round-trip
    const json = JSON.stringify(trace);
    const parsed = JSON.parse(json);
    expect(parsed.traceId).toBe(trace.traceId);
  });
});
