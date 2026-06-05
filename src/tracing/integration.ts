/**
 * Event-system bridge for automatic request tracing
 *
 * Subscribes to the OpenGuard EventEmitter and builds a Trace for each
 * request lifecycle automatically — no manual instrumentation required.
 *
 * Usage:
 *   import { eventEmitter } from 'openguard/events';
 *   import { attachTracingToEvents, tracer } from 'openguard/tracing';
 *
 *   const { getTrace, detach } = attachTracingToEvents(eventEmitter);
 *
 *   // After a request completes via FallbackOrchestrator:
 *   const trace = getTrace(requestId);
 */

import type { EventEmitter } from '../events/emitter.js';
import type { OpenGuardEvent } from '../events/types.js';
import type { Trace } from './types.js';
import { Tracer, tracer as globalTracer } from './tracer.js';

/**
 * The handle returned by attachTracingToEvents.
 */
export interface TracingAttachment {
  /** The Tracer instance managing the auto-built traces */
  tracer: Tracer;
  /**
   * Look up the completed Trace for a given requestId.
   * Returns undefined while the request is still in-flight or if no trace
   * was started for that requestId.
   */
  getTrace: (requestId: string) => Trace | undefined;
  /** Unsubscribe from the EventEmitter and stop building new traces. */
  detach: () => void;
}

/**
 * Attach automatic tracing to an EventEmitter.
 *
 * A new Trace is started for each `request.start` event and finalized
 * on `completion` or `failure`. Intermediate events (provider.call, retry,
 * validation, hallucination.check) are recorded as child spans.
 *
 * The bridge only reads events — it never mutates or blocks them.
 *
 * @param emitter         The EventEmitter to subscribe to
 * @param tracerInstance  Tracer to use (defaults to the global singleton)
 */
export function attachTracingToEvents(
  emitter: EventEmitter,
  tracerInstance: Tracer = globalTracer
): TracingAttachment {
  /** requestId → traceId (in-flight) */
  const requestToTrace = new Map<string, string>();
  /**
   * requestId → spanId of the currently open provider span.
   * Provider calls are sequential so only one can be open per request.
   */
  const openProviderSpan = new Map<string, string>();

  const handler = async (event: OpenGuardEvent): Promise<void> => {
    const { requestId } = event;

    switch (event.eventType) {
      // ── request.start ────────────────────────────────────────────────────
      case 'request.start': {
        const ctx = tracerInstance.start(requestId, {
          provider: event.data.provider,
        });
        requestToTrace.set(requestId, ctx.traceId);

        ctx
          .getRootSpan()
          .setAttribute('provider', event.data.provider)
          .setAttribute(
            'messageCount',
            Array.isArray(event.data.request.prompt)
              ? event.data.request.prompt.length
              : 1
          );

        // Prompt span — self-contained, committed immediately
        const promptSpan = ctx.startSpan('Prepare prompt', 'prompt', ctx.rootSpanId);
        promptSpan.setAttribute(
          'promptType',
          typeof event.data.request.prompt === 'string' ? 'text' : 'messages'
        );
        ctx.endSpan(promptSpan.spanId);
        break;
      }

      // ── provider.call ─────────────────────────────────────────────────────
      case 'provider.call': {
        const traceId = requestToTrace.get(requestId);
        if (!traceId) break;
        const ctx = tracerInstance.getContext(traceId);
        if (!ctx) break;

        // Guard: close any previously open provider span (missed event)
        const prevId = openProviderSpan.get(requestId);
        if (prevId) {
          try { ctx.endSpan(prevId, 'ok'); } catch { /* already committed */ }
          openProviderSpan.delete(requestId);
        }

        const span = ctx.startSpan(
          `${event.data.provider} attempt ${event.data.attempt + 1}`,
          'provider',
          ctx.rootSpanId
        );
        span.setAttributes({
          provider: event.data.provider,
          model: event.data.model,
          attempt: event.data.attempt,
        });
        openProviderSpan.set(requestId, span.spanId);
        break;
      }

      // ── retry ─────────────────────────────────────────────────────────────
      case 'retry': {
        const traceId = requestToTrace.get(requestId);
        if (!traceId) break;
        const ctx = tracerInstance.getContext(traceId);
        if (!ctx) break;

        // Close the failed provider span before recording the retry
        const providerSpanId = openProviderSpan.get(requestId);
        if (providerSpanId) {
          try {
            ctx.failSpan(providerSpanId, event.data.error ?? new Error(event.data.reason));
          } catch { /* already committed */ }
          openProviderSpan.delete(requestId);
        }

        // Retry span — self-contained
        const retrySpan = ctx.startSpan(
          `Retry ${event.data.attempt}/${event.data.maxRetries}`,
          'retry',
          ctx.rootSpanId
        );
        retrySpan.setAttributes({
          attempt: event.data.attempt,
          maxRetries: event.data.maxRetries,
          reason: event.data.reason,
          delayMs: event.data.delay,
        });
        ctx.endSpan(retrySpan.spanId, 'error');
        break;
      }

      // ── response.normalization ────────────────────────────────────────────
      case 'response.normalization': {
        const traceId = requestToTrace.get(requestId);
        if (!traceId) break;
        const ctx = tracerInstance.getContext(traceId);
        if (!ctx) break;

        // Close the open provider span now that a response arrived
        const providerSpanId = openProviderSpan.get(requestId);
        if (providerSpanId) {
          try { ctx.endSpan(providerSpanId, 'ok'); } catch { /* already committed */ }
          openProviderSpan.delete(requestId);
        }

        const normSpan = ctx.startSpan('Normalize response', 'normalization', ctx.rootSpanId);
        normSpan.setAttributes({ provider: event.data.provider, durationMs: event.data.duration });
        ctx.endSpan(normSpan.spanId);
        break;
      }

      // ── validation ────────────────────────────────────────────────────────
      case 'validation': {
        const traceId = requestToTrace.get(requestId);
        if (!traceId) break;
        const ctx = tracerInstance.getContext(traceId);
        if (!ctx) break;

        const span = ctx.startSpan(
          `Validate: ${event.data.validationType}`,
          'validation',
          ctx.rootSpanId
        );
        span.setAttributes({
          validationType: event.data.validationType,
          passed: event.data.passed,
          ...(event.data.details ?? {}),
        });

        if (!event.data.passed && event.data.error) {
          ctx.failSpan(span.spanId, event.data.error);
        } else {
          ctx.endSpan(span.spanId, event.data.passed ? 'ok' : 'error');
        }
        break;
      }

      // ── hallucination.check ───────────────────────────────────────────────
      case 'hallucination.check': {
        const traceId = requestToTrace.get(requestId);
        if (!traceId) break;
        const ctx = tracerInstance.getContext(traceId);
        if (!ctx) break;

        const span = ctx.startSpan('Hallucination check', 'validation', ctx.rootSpanId);
        span.setAttributes({
          score: event.data.score,
          detected: event.data.detected,
          confidence: event.data.confidence,
          ...(event.data.details ?? {}),
        });
        ctx.endSpan(span.spanId, event.data.detected ? 'error' : 'ok');
        break;
      }

      // ── completion ────────────────────────────────────────────────────────
      case 'completion': {
        const traceId = requestToTrace.get(requestId);
        if (!traceId) break;
        const ctx = tracerInstance.getContext(traceId);
        if (!ctx) break;

        // Close any still-open provider span
        const providerSpanId = openProviderSpan.get(requestId);
        if (providerSpanId) {
          try { ctx.endSpan(providerSpanId, 'ok'); } catch { /* already committed */ }
          openProviderSpan.delete(requestId);
        }

        // Result span
        const resultSpan = ctx.startSpan('Result', 'result', ctx.rootSpanId);
        resultSpan.setAttributes({
          provider: event.data.provider,
          attempts: event.data.attempts,
          durationMs: event.data.duration,
          ...(event.data.usage
            ? {
                promptTokens: event.data.usage.promptTokens,
                completionTokens: event.data.usage.completionTokens,
                totalTokens: event.data.usage.totalTokens,
              }
            : {}),
        });
        ctx.endSpan(resultSpan.spanId);

        ctx.setProvider({
          name: event.data.provider,
          attempts: event.data.attempts,
          tokens: event.data.usage
            ? {
                prompt: event.data.usage.promptTokens,
                completion: event.data.usage.completionTokens,
                total: event.data.usage.totalTokens,
              }
            : undefined,
        });

        tracerInstance.finish(traceId, 'ok');
        requestToTrace.delete(requestId);
        break;
      }

      // ── failure ───────────────────────────────────────────────────────────
      case 'failure': {
        const traceId = requestToTrace.get(requestId);
        if (!traceId) break;
        const ctx = tracerInstance.getContext(traceId);
        if (!ctx) break;

        const providerSpanId = openProviderSpan.get(requestId);
        if (providerSpanId) {
          try { ctx.failSpan(providerSpanId, event.data.error); } catch { /* already committed */ }
          openProviderSpan.delete(requestId);
        }

        ctx.getRootSpan().setAttributes({
          failureStage: event.data.stage,
          error: event.data.error.message,
          ...(event.data.provider ? { provider: event.data.provider } : {}),
        });

        tracerInstance.finish(traceId, 'error');
        requestToTrace.delete(requestId);
        break;
      }
    }
  };

  emitter.onAny(handler);

  return {
    tracer: tracerInstance,

    getTrace(requestId: string): Trace | undefined {
      // Search the completed store (most requests will be here after finish())
      return tracerInstance.listCompleted().find((t) => t.requestId === requestId);
    },

    detach(): void {
      emitter.offAny(handler);
    },
  };
}
