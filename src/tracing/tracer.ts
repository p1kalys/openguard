/**
 * Tracer and TraceContext – core lifecycle management for request tracing
 */

import type { SpanStage, SpanStatus, Trace, TraceSpan, TracedProvider } from './types.js';
import { SpanBuilder, generateSpanId } from './span.js';

/**
 * Generate a unique trace identifier.
 */
export function generateTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Manages the full span tree for a single request.
 *
 * Usage:
 *   const ctx = tracer.start('req-123', { userId: '42' });
 *
 *   const providerSpan = ctx.startSpan('Call OpenAI', 'provider');
 *   providerSpan.setAttribute('model', 'gpt-4o');
 *
 *     const retrySpan = ctx.startSpan('Retry 1', 'retry', providerSpan.spanId);
 *     retrySpan.end('error');
 *
 *   providerSpan.end();
 *   ctx.endSpan(providerSpan.spanId);
 *
 *   const trace = ctx.finish();  // returns serializable Trace
 */
export class TraceContext {
  private readonly _trace: Trace;
  /** Open SpanBuilders keyed by spanId */
  private readonly _open: Map<string, SpanBuilder> = new Map();
  /**
   * Stack of open spanIds for auto-parent resolution.
   * The root span always sits at index 0.
   */
  private readonly _stack: string[] = [];
  private _finished = false;

  constructor(
    traceId: string,
    requestId: string,
    attributes?: Record<string, unknown>
  ) {
    const rootSpanId = generateSpanId();
    this._trace = {
      traceId,
      requestId,
      startTime: Date.now(),
      status: 'pending',
      rootSpanId,
      spans: [],
      attributes: { ...attributes },
    };

    // Root span represents the entire request lifecycle
    const root = new SpanBuilder({
      spanId: rootSpanId,
      traceId,
      name: 'request',
      stage: 'prompt',
    });
    this._open.set(rootSpanId, root);
    this._stack.push(rootSpanId);
  }

  /** The trace ID assigned to this context */
  get traceId(): string {
    return this._trace.traceId;
  }

  /** The request ID this trace correlates with */
  get requestId(): string {
    return this._trace.requestId;
  }

  /** The root span's ID */
  get rootSpanId(): string {
    return this._trace.rootSpanId;
  }

  /** Whether finish() has been called */
  get isFinished(): boolean {
    return this._finished;
  }

  /**
   * Start a new child span.
   *
   * If `parentSpanId` is omitted the span is nested under the current top of
   * the active-span stack (i.e. the most recently started un-ended span).
   * This makes deeply-nested flows work naturally without threading IDs.
   *
   * @param name        Human-readable span name
   * @param stage       Lifecycle stage
   * @param parentSpanId Override automatic parent resolution
   */
  startSpan(name: string, stage: SpanStage, parentSpanId?: string): SpanBuilder {
    const resolvedParent =
      parentSpanId ??
      this._stack[this._stack.length - 1] ??
      this._trace.rootSpanId;

    const spanId = generateSpanId();
    const builder = new SpanBuilder({
      spanId,
      traceId: this._trace.traceId,
      name,
      stage,
      parentSpanId: resolvedParent,
    });

    this._open.set(spanId, builder);
    this._stack.push(spanId);
    return builder;
  }

  /**
   * End an open span and commit it to the trace record.
   *
   * Calling this is optional when the span was already closed via
   * `builder.end()` or `builder.fail()` — the committed snapshot will be
   * accurate either way. What matters is calling endSpan() (or failSpan())
   * so the span is written into the trace and removed from the open set.
   *
   * @param spanId  The span to close
   * @param status  Terminal status (default 'ok')
   */
  endSpan(spanId: string, status: SpanStatus = 'ok'): TraceSpan {
    const builder = this._open.get(spanId);
    if (!builder) {
      throw new Error(`[Tracer] Span not found or already committed: ${spanId}`);
    }
    const span = builder.isEnded ? builder.snapshot() : builder.end(status);
    this._commitSpan(spanId, span);
    return span;
  }

  /**
   * Fail an open span with an error and commit it to the trace.
   */
  failSpan(spanId: string, error: Error | string): TraceSpan {
    const builder = this._open.get(spanId);
    if (!builder) {
      throw new Error(`[Tracer] Span not found or already committed: ${spanId}`);
    }
    const span = builder.fail(error);
    this._commitSpan(spanId, span);
    return span;
  }

  /**
   * Look up an open (not-yet-committed) span builder.
   * Returns undefined if the span doesn't exist or was already committed.
   */
  getSpan(spanId: string): SpanBuilder | undefined {
    return this._open.get(spanId);
  }

  /**
   * The root span builder (always open until finish() is called).
   */
  getRootSpan(): SpanBuilder {
    return this._open.get(this._trace.rootSpanId)!;
  }

  /**
   * Annotate trace-level provider metadata (e.g. after a successful completion).
   */
  setProvider(provider: TracedProvider): this {
    this._trace.provider = provider;
    return this;
  }

  /**
   * Set a trace-level attribute.
   */
  setAttribute(key: string, value: unknown): this {
    this._trace.attributes[key] = value;
    return this;
  }

  /**
   * Finalize the trace.
   *
   * Any still-open spans are automatically ended with the given status so the
   * returned Trace is always complete. Returns an immutable, serializable Trace.
   */
  finish(status: SpanStatus = 'ok'): Trace {
    if (this._finished) {
      return this._snapshot();
    }
    this._finished = true;

    // Close all open non-root spans (in reverse stack order so parents close last).
    // Commit both still-pending spans AND spans that were closed via span.end()/fail()
    // directly but never flushed through ctx.endSpan().
    const openIds = this._stack.filter((id) => id !== this._trace.rootSpanId);
    for (const id of [...openIds].reverse()) {
      const builder = this._open.get(id);
      if (builder) {
        this._trace.spans.push(builder.isEnded ? builder.snapshot() : builder.end(status));
      }
      this._open.delete(id);
    }

    // Close the root span
    const root = this._open.get(this._trace.rootSpanId);
    if (root) {
      this._trace.spans.push(root.isEnded ? root.snapshot() : root.end(status));
      this._open.delete(this._trace.rootSpanId);
    }

    const endTime = Date.now();
    this._trace.endTime = endTime;
    this._trace.duration = endTime - this._trace.startTime;
    this._trace.status = status;

    return this._snapshot();
  }

  private _commitSpan(spanId: string, span: TraceSpan): void {
    this._trace.spans.push(span);
    this._open.delete(spanId);
    const idx = this._stack.lastIndexOf(spanId);
    if (idx !== -1) this._stack.splice(idx, 1);
  }

  private _snapshot(): Trace {
    return {
      ...this._trace,
      spans: [...this._trace.spans],
      attributes: { ...this._trace.attributes },
    };
  }
}

// ---------------------------------------------------------------------------
// Tracer – factory and completed-trace store
// ---------------------------------------------------------------------------

export interface TracerOptions {
  /**
   * Maximum number of completed traces to keep in memory.
   * Oldest trace is evicted when the limit is exceeded. Default: 100.
   */
  maxCompletedTraces?: number;
}

/**
 * Creates and manages TraceContexts for concurrent requests.
 * Acts as both a factory and a bounded in-memory store for completed traces.
 *
 * A global singleton (`tracer`) is exported for convenience; you can also
 * instantiate your own for isolated test environments.
 */
export class Tracer {
  private readonly _active: Map<string, TraceContext> = new Map();
  private readonly _completed: Map<string, Trace> = new Map();
  private readonly _maxCompleted: number;

  constructor(options: TracerOptions = {}) {
    this._maxCompleted = options.maxCompletedTraces ?? 100;
  }

  /**
   * Begin tracing a new request.
   *
   * @param requestId   Correlates the trace with your existing request IDs
   * @param attributes  Optional trace-level annotations (userId, sessionId, …)
   */
  start(requestId: string, attributes?: Record<string, unknown>): TraceContext {
    const traceId = generateTraceId();
    const ctx = new TraceContext(traceId, requestId, attributes);
    this._active.set(traceId, ctx);
    return ctx;
  }

  /**
   * Retrieve an in-progress TraceContext by its traceId.
   */
  getContext(traceId: string): TraceContext | undefined {
    return this._active.get(traceId);
  }

  /**
   * Retrieve a completed (finished) Trace by its traceId.
   */
  getTrace(traceId: string): Trace | undefined {
    return this._completed.get(traceId);
  }

  /**
   * Finish a trace from outside the TraceContext and move it to the store.
   * Returns the completed Trace, or undefined if the traceId is unknown.
   */
  finish(traceId: string, status?: SpanStatus): Trace | undefined {
    const ctx = this._active.get(traceId);
    if (!ctx) return undefined;
    const trace = ctx.finish(status);
    this._active.delete(traceId);
    this._store(traceId, trace);
    return trace;
  }

  /**
   * All completed traces in insertion order.
   */
  listCompleted(): Trace[] {
    return [...this._completed.values()];
  }

  /**
   * Remove a single completed trace from the store.
   */
  drop(traceId: string): void {
    this._completed.delete(traceId);
  }

  /**
   * Remove all completed traces from the store.
   */
  clear(): void {
    this._completed.clear();
  }

  private _store(traceId: string, trace: Trace): void {
    if (this._completed.size >= this._maxCompleted) {
      const oldest = this._completed.keys().next().value;
      if (oldest !== undefined) this._completed.delete(oldest);
    }
    this._completed.set(traceId, trace);
  }
}

/**
 * Global singleton Tracer. Use this for application-wide tracing,
 * or construct a new Tracer() for isolated scopes (e.g. tests).
 */
export const tracer = new Tracer();
