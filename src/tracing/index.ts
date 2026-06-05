/**
 * OpenGuard Request Tracing Engine
 *
 * Trace the full lifecycle of an LLM request:
 *   prompt → provider → normalization → validation → retry → result
 *
 * Sub-path import: import { ... } from 'openguard/tracing'
 *
 * ─── Manual instrumentation ───────────────────────────────────────────────
 *
 *   import { Tracer } from 'openguard/tracing';
 *
 *   const myTracer = new Tracer();
 *   const ctx = myTracer.start('req-123', { userId: 'u1' });
 *
 *   const span = ctx.startSpan('Call provider', 'provider');
 *   span.setAttribute('model', 'gpt-4o');
 *   // … do work …
 *   ctx.endSpan(span.spanId);
 *
 *   const trace = ctx.finish();   // fully serializable Trace object
 *   console.log(JSON.stringify(trace, null, 2));
 *
 * ─── Automatic (event-driven) instrumentation ─────────────────────────────
 *
 *   import { eventEmitter } from 'openguard/events';
 *   import { attachTracingToEvents } from 'openguard/tracing';
 *
 *   const { getTrace, detach } = attachTracingToEvents(eventEmitter);
 *   // Traces are built automatically as FallbackOrchestrator emits events.
 *   // After a request: const trace = getTrace(requestId);
 */

// Type definitions
export type {
  SpanStage,
  SpanStatus,
  SpanEvent,
  SpanError,
  TraceSpan,
  TracedProvider,
  Trace,
} from './types.js';

// SpanBuilder
export { SpanBuilder, generateSpanId } from './span.js';

// Tracer, TraceContext, global singleton
export {
  TraceContext,
  Tracer,
  TracerOptions,
  tracer,
  generateTraceId,
} from './tracer.js';

// Event-system bridge
export type { TracingAttachment } from './integration.js';
export { attachTracingToEvents } from './integration.js';
