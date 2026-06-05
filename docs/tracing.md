# Request Tracing

Sub-path import: `openguard/tracing`

Lightweight, serializable request tracing. Traces capture the full request lifecycle (prompt → provider → normalization → validation → retry → result) as a tree of timed spans. All `Trace` objects are plain data — no functions, no `Error` objects — making them safe to serialize to JSON and persist to storage.

## Quick Start

### Automatic (event-driven) Instrumentation

```ts
import { attachTracingToEvents } from 'openguard/tracing';
import { eventEmitter } from 'openguard/events';

const { getTrace, detach } = attachTracingToEvents(eventEmitter);

// After a request completes:
const trace = getTrace('request-42');
console.log(JSON.stringify(trace, null, 2));

// In tests or on shutdown:
detach();
```

### Manual Instrumentation

```ts
import { Tracer } from 'openguard/tracing';

const tracer = new Tracer();
const ctx = tracer.start('request-42', { userId: 'u1' });

const providerSpan = ctx.startSpan('Call Provider', 'provider');
providerSpan.setAttribute('model', 'gpt-4o');
providerSpan.addEvent('request.sent');

// Nested retry span
const retrySpan = ctx.startSpan('Retry #1', 'retry');
retrySpan.end('error');
ctx.endSpan(retrySpan.spanId);

providerSpan.addEvent('response.received');
providerSpan.end();
ctx.endSpan(providerSpan.spanId);

ctx.setProvider({
  name: 'openai', model: 'gpt-4o',
  attempts: 1, tokens: { prompt: 12, completion: 52, total: 64 },
});

const trace = tracer.finish(ctx.traceId);
```

## API

### `Tracer`

```ts
const tracer = new Tracer();                           // or: globalTracer
tracer.start(requestId, attributes?)  → TraceContext
tracer.finish(traceId)                → Trace | undefined
tracer.listCompleted()                → Trace[]
tracer.getTrace(traceId)              → Trace | undefined
```

### `TraceContext`

```ts
ctx.startSpan(name, stage, parentSpanId?) → SpanBuilder
ctx.endSpan(spanId)
ctx.failSpan(spanId, error)
ctx.setProvider(meta)
ctx.finish()                              → Trace
```

### `SpanBuilder`

```ts
span.setAttribute(key, value)
span.addEvent(name, attributes?)
span.end(status?)
span.fail(error)
```

## Best Practices

- Prefer `attachTracingToEvents` over manual instrumentation to reduce boilerplate.
- Keep span attributes concise — store IDs/sizes, not large payloads.
- Always call `detach()` in test teardown.

## Tests

See [`tests/tracing.test.ts`](../tests/tracing.test.ts) for a minimal example covering nested spans, provider metadata, and JSON serialization.
