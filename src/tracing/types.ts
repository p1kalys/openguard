/**
 * Request tracing type definitions for OpenGuard
 *
 * All types are fully serializable (no Error objects, no functions, no circular refs).
 */

/**
 * Named lifecycle stages a span can belong to.
 *
 * prompt        – constructing / pre-processing the prompt
 * provider      – outbound call to an LLM provider
 * normalization – normalizing the raw provider response
 * validation    – any validation pass (schema, semantic, grounding, hallucination)
 * retry         – a retry attempt
 * result        – post-processing / final result assembly
 * custom        – user-defined span stage
 */
export type SpanStage =
  | 'prompt'
  | 'provider'
  | 'normalization'
  | 'validation'
  | 'retry'
  | 'result'
  | 'custom';

/**
 * Terminal status of a span or trace.
 */
export type SpanStatus = 'pending' | 'ok' | 'error';

/**
 * A discrete event recorded within a span (e.g. "cache hit", "schema parsed").
 */
export interface SpanEvent {
  /** Human-readable event name */
  name: string;
  /** Unix timestamp (ms) when the event occurred */
  timestamp: number;
  /** Optional key-value annotations */
  attributes?: Record<string, unknown>;
}

/**
 * Serializable error captured inside a span.
 */
export interface SpanError {
  /** Error message */
  message: string;
  /** Constructor name (e.g. "TypeError") */
  type?: string;
}

/**
 * A single unit of timed work within a trace.
 * Immutable once produced by SpanBuilder.end() / SpanBuilder.fail().
 */
export interface TraceSpan {
  /** Unique span identifier */
  spanId: string;
  /** Parent span identifier (undefined for the root span) */
  parentSpanId?: string;
  /** Trace this span belongs to */
  traceId: string;
  /** Human-readable span name */
  name: string;
  /** Lifecycle stage */
  stage: SpanStage;
  /** Unix timestamp (ms) when span started */
  startTime: number;
  /** Unix timestamp (ms) when span ended (undefined while pending) */
  endTime?: number;
  /** Wall-clock duration in milliseconds (undefined while pending) */
  duration?: number;
  /** Terminal status */
  status: SpanStatus;
  /** Arbitrary key-value metadata */
  attributes: Record<string, unknown>;
  /** Ordered list of events recorded during the span */
  events: SpanEvent[];
  /** Error details if status is 'error' */
  error?: SpanError;
}

/**
 * Provider metadata attached at the trace level.
 */
export interface TracedProvider {
  /** Provider name (e.g. "openai", "anthropic") */
  name: string;
  /** Model used */
  model?: string;
  /** Total provider call attempts across all retries */
  attempts: number;
  /** Token usage from the successful response */
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

/**
 * Complete, serializable record of a single request lifecycle.
 * Produced by TraceContext.finish().
 */
export interface Trace {
  /** Unique trace identifier */
  traceId: string;
  /** Correlates with the request that triggered this trace */
  requestId: string;
  /** Unix timestamp (ms) when the trace started */
  startTime: number;
  /** Unix timestamp (ms) when the trace finished */
  endTime?: number;
  /** Total wall-clock duration in milliseconds */
  duration?: number;
  /** Overall trace status */
  status: SpanStatus;
  /** spanId of the root span */
  rootSpanId: string;
  /** All spans ordered by creation time */
  spans: TraceSpan[];
  /** Provider-level metadata (populated from completion data) */
  provider?: TracedProvider;
  /** Trace-level key-value annotations */
  attributes: Record<string, unknown>;
}
