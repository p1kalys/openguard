/**
 * SpanBuilder – mutable in-flight span that produces an immutable TraceSpan
 */

import type { SpanStage, SpanStatus, SpanEvent, SpanError, TraceSpan } from './types.js';

/**
 * Generate a unique span identifier.
 */
export function generateSpanId(): string {
  return `span_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Builds a single span. Call `.end()` or `.fail()` to produce a TraceSpan.
 *
 * Mutation methods return `this` for chaining:
 *   span.setAttribute('model', 'gpt-4o').addEvent('cache-miss').end();
 */
export class SpanBuilder {
  private readonly _spanId: string;
  private readonly _traceId: string;
  private readonly _parentSpanId: string | undefined;
  private readonly _name: string;
  private readonly _stage: SpanStage;
  private readonly _startTime: number;

  private readonly _attributes: Record<string, unknown> = {};
  private readonly _events: SpanEvent[] = [];

  private _status: SpanStatus = 'pending';
  private _error: SpanError | undefined;
  private _endTime: number | undefined;

  constructor(init: {
    spanId: string;
    traceId: string;
    name: string;
    stage: SpanStage;
    parentSpanId?: string;
  }) {
    this._spanId = init.spanId;
    this._traceId = init.traceId;
    this._name = init.name;
    this._stage = init.stage;
    this._parentSpanId = init.parentSpanId;
    this._startTime = Date.now();
  }

  /** The span's unique ID */
  get spanId(): string {
    return this._spanId;
  }

  /** Whether this span has been closed */
  get isEnded(): boolean {
    return this._endTime !== undefined;
  }

  /**
   * Set a single attribute on this span.
   */
  setAttribute(key: string, value: unknown): this {
    this._attributes[key] = value;
    return this;
  }

  /**
   * Merge multiple attributes onto this span.
   */
  setAttributes(attrs: Record<string, unknown>): this {
    Object.assign(this._attributes, attrs);
    return this;
  }

  /**
   * Record a discrete event that happened during this span's lifetime.
   */
  addEvent(name: string, attributes?: Record<string, unknown>): this {
    this._events.push({ name, timestamp: Date.now(), attributes });
    return this;
  }

  /**
   * Close the span with an 'ok' (or specified) status.
   * Returns the immutable TraceSpan snapshot.
   * Calling end() on an already-ended span is a no-op.
   */
  end(status: SpanStatus = 'ok'): TraceSpan {
    if (!this.isEnded) {
      this._endTime = Date.now();
      this._status = status;
    }
    return this._toSpan();
  }

  /**
   * Close the span with an 'error' status and capture error details.
   * Calling fail() on an already-ended span is a no-op.
   */
  fail(error: Error | string): TraceSpan {
    if (!this.isEnded) {
      this._endTime = Date.now();
      this._status = 'error';
      this._error =
        typeof error === 'string'
          ? { message: error }
          : { message: error.message, type: error.constructor.name };
    }
    return this._toSpan();
  }

  /**
   * Snapshot the current state as a TraceSpan.
   * Safe to call on open or closed spans.
   */
  snapshot(): TraceSpan {
    return this._toSpan();
  }

  private _toSpan(): TraceSpan {
    const endTime = this._endTime;
    return {
      spanId: this._spanId,
      parentSpanId: this._parentSpanId,
      traceId: this._traceId,
      name: this._name,
      stage: this._stage,
      startTime: this._startTime,
      endTime,
      duration: endTime !== undefined ? endTime - this._startTime : undefined,
      status: this._status,
      attributes: { ...this._attributes },
      events: [...this._events],
      error: this._error,
    };
  }
}
