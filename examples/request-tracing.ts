/**
 * examples/request-tracing.ts
 *
 * Demonstrates the OpenGuard request tracing engine in three ways:
 *
 *  1. Manual instrumentation — full control, span-by-span
 *  2. Nested spans — tracing retries and sub-operations
 *  3. Automatic (event-driven) — wire up to FallbackOrchestrator events
 */

import { Tracer, TraceContext, attachTracingToEvents } from '../src/tracing/index.js';
import { eventEmitter } from '../src/events/index.js';
import type { Trace, TraceSpan } from '../src/tracing/types.js';

// ─── Utility ───────────────────────────────────────────────────────────────

function printTrace(trace: Trace): void {
  console.log('\n━━━ Trace ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  traceId   : ${trace.traceId}`);
  console.log(`  requestId : ${trace.requestId}`);
  console.log(`  status    : ${trace.status}`);
  console.log(`  duration  : ${trace.duration}ms`);
  if (trace.provider) {
    console.log(`  provider  : ${trace.provider.name} (${trace.provider.attempts} attempt(s))`);
    if (trace.provider.tokens) {
      const t = trace.provider.tokens;
      console.log(`  tokens    : prompt=${t.prompt}, completion=${t.completion}, total=${t.total}`);
    }
  }
  console.log('\n  Spans:');
  for (const span of trace.spans) {
    printSpan(span);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

function printSpan(span: TraceSpan, indent = 2): void {
  const pad = ' '.repeat(indent);
  const status = span.status === 'ok' ? '✓' : span.status === 'error' ? '✗' : '…';
  console.log(
    `${pad}${status} [${span.stage}] ${span.name}` +
      `  (${span.duration !== undefined ? span.duration + 'ms' : 'pending'})`
  );
  if (span.error) {
    console.log(`${pad}    error: ${span.error.type ?? 'Error'}: ${span.error.message}`);
  }
  const attrs = Object.entries(span.attributes);
  if (attrs.length) {
    console.log(`${pad}    attrs: ${attrs.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')}`);
  }
  for (const ev of span.events) {
    console.log(`${pad}    event: ${ev.name} @${ev.timestamp}`);
  }
}

// ─── Example 1: Manual instrumentation ─────────────────────────────────────

async function example1ManualTrace(): Promise<void> {
  console.log('\n═══ Example 1: Manual instrumentation ═══');

  const myTracer = new Tracer();
  const ctx: TraceContext = myTracer.start('req-manual-001', {
    userId: 'u42',
    sessionId: 'sess-abc',
  });

  // 1. Prompt span
  const promptSpan = ctx.startSpan('Prepare prompt', 'prompt');
  promptSpan.setAttribute('messageCount', 3).setAttribute('promptType', 'messages');
  promptSpan.addEvent('system-message-injected');
  ctx.endSpan(promptSpan.spanId);

  // 2. Provider span — simulate async latency
  const providerSpan = ctx.startSpan('Call OpenAI gpt-4o', 'provider');
  providerSpan.setAttributes({ provider: 'openai', model: 'gpt-4o', attempt: 0 });
  await new Promise((r) => setTimeout(r, 20)); // simulate network
  providerSpan.addEvent('response-received');
  ctx.endSpan(providerSpan.spanId);

  // 3. Normalization span
  const normSpan = ctx.startSpan('Normalize response', 'normalization');
  normSpan.setAttribute('provider', 'openai');
  ctx.endSpan(normSpan.spanId);

  // 4. Validation span
  const validationSpan = ctx.startSpan('Schema validation', 'validation');
  validationSpan.setAttributes({ validationType: 'json_schema', passed: true });
  ctx.endSpan(validationSpan.spanId);

  // 5. Result span
  const resultSpan = ctx.startSpan('Assemble result', 'result');
  resultSpan.setAttribute('outputTokens', 142);
  ctx.endSpan(resultSpan.spanId);

  // Attach provider-level summary
  ctx.setProvider({
    name: 'openai',
    model: 'gpt-4o',
    attempts: 1,
    tokens: { prompt: 512, completion: 142, total: 654 },
  });

  const trace = ctx.finish('ok');
  printTrace(trace);

  // The trace object is fully serializable
  const json = JSON.stringify(trace, null, 2);
  console.log(`  ↳ Serialized size: ${json.length} bytes`);
}

// ─── Example 2: Nested spans (retry flow) ──────────────────────────────────

async function example2NestedRetry(): Promise<void> {
  console.log('\n═══ Example 2: Nested spans — retry flow ═══');

  const myTracer = new Tracer();
  const ctx = myTracer.start('req-retry-002');

  // Root annotated up front
  ctx.getRootSpan().setAttribute('provider', 'anthropic');

  // Attempt 1 — provider call that fails
  const attempt1 = ctx.startSpan('anthropic claude-3 (attempt 1)', 'provider');
  attempt1.setAttribute('model', 'claude-3-sonnet');
  await new Promise((r) => setTimeout(r, 15));
  ctx.failSpan(attempt1.spanId, new Error('Rate limit exceeded'));

  // Retry span — nested under root
  ctx
    .startSpan('Retry backoff 1s', 'retry')
    .setAttributes({ attempt: 0, maxRetries: 2, delayMs: 1000, reason: 'rate_limit' })
    .end('error');

  // Attempt 2 — success
  const attempt2 = ctx.startSpan('anthropic claude-3 (attempt 2)', 'provider');
  attempt2.setAttribute('model', 'claude-3-sonnet');
  await new Promise((r) => setTimeout(r, 25));
  attempt2.addEvent('stream-complete');
  ctx.endSpan(attempt2.spanId, 'ok');

  // Validation — nested under result
  const resultSpan = ctx.startSpan('Result', 'result');
  ctx.startSpan('Hallucination check', 'validation', resultSpan.spanId)
    .setAttributes({ score: 0.04, detected: false })
    .end();
  ctx.endSpan(resultSpan.spanId);

  ctx.setProvider({ name: 'anthropic', attempts: 2 });

  const trace = ctx.finish('ok');
  printTrace(trace);
}

// ─── Example 3: Automatic tracing via event system ─────────────────────────

async function example3EventDriven(): Promise<void> {
  console.log('\n═══ Example 3: Automatic tracing via EventEmitter ═══');

  const autoTracer = new Tracer();
  const { getTrace, detach } = attachTracingToEvents(eventEmitter, autoTracer);

  // Simulate the events that FallbackOrchestrator emits
  const requestId = `req-auto-${Date.now()}`;

  await eventEmitter.emit({
    eventId: 'evt_1',
    timestamp: Date.now(),
    requestId,
    eventType: 'request.start',
    data: {
      request: { prompt: [{ role: 'user', content: 'What is 2+2?' }] },
      provider: 'openai',
    },
  });

  await eventEmitter.emit({
    eventId: 'evt_2',
    timestamp: Date.now(),
    requestId,
    eventType: 'provider.call',
    data: { provider: 'openai', model: 'gpt-4o', attempt: 0, params: {} },
  });

  await new Promise((r) => setTimeout(r, 10));

  await eventEmitter.emit({
    eventId: 'evt_3',
    timestamp: Date.now(),
    requestId,
    eventType: 'validation',
    data: { validationType: 'json_schema', passed: true },
  });

  await eventEmitter.emit({
    eventId: 'evt_4',
    timestamp: Date.now(),
    requestId,
    eventType: 'completion',
    data: {
      response: {
        id: 'resp-1',
        content: '4',
        model: 'gpt-4o',
        finishReason: 'stop',
      },
      duration: 320,
      attempts: 1,
      provider: 'openai',
      usage: { promptTokens: 22, completionTokens: 4, totalTokens: 26 },
    },
  });

  const trace = getTrace(requestId);
  if (trace) {
    printTrace(trace);
  } else {
    console.log('  [!] No completed trace found — request may still be in-flight.');
  }

  detach(); // unsubscribe the handler
}

// ─── Run all examples ───────────────────────────────────────────────────────

(async () => {
  await example1ManualTrace();
  await example2NestedRetry();
  await example3EventDriven();
})();
