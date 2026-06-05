/**
 * Storage integration helpers
 *
 * Two complementary patterns for connecting observability data to storage:
 *
 * 1. Event-driven (automatic):
 *    `attachStorageToEvents` subscribes to the event emitter and auto-persists
 *    completed traces as requests finish — no manual save calls needed.
 *
 * 2. One-shot flush (manual):
 *    `flushTracesToStore` / `flushMetricsToStore` copy in-memory data to a
 *    store in bulk — useful for periodic drains or graceful-shutdown hooks.
 *
 * @example Event-driven
 * ```ts
 * import { eventEmitter } from 'openguard/events';
 * import { createFileStorage, attachStorageToEvents } from 'openguard/storage';
 *
 * const storage = createFileStorage('./observability');
 * const { detach } = attachStorageToEvents(eventEmitter, storage);
 * // All future request traces are persisted automatically.
 * // Call detach() to unsubscribe.
 * ```
 *
 * @example One-shot flush
 * ```ts
 * import { tracer } from 'openguard/tracing';
 * import { metricsCollector } from 'openguard/metrics';
 * import { createFileStorage, flushTracesToStore, flushMetricsToStore } from 'openguard/storage';
 *
 * const storage = createFileStorage('./observability');
 * await flushTracesToStore(tracer, storage.traces);
 * await flushMetricsToStore(metricsCollector.getAll(), storage.metrics);
 * ```
 */

import type { Metric } from '../metrics/types.js';
import type { ITraceStore, IMetricStore } from './types.js';
import type { StorageRegistry } from './registry.js';
import type { Tracer } from '../tracing/tracer.js';
import type { EventEmitter } from '../events/emitter.js';
import type { OpenGuardEvent } from '../events/types.js';
import { attachTracingToEvents } from '../tracing/integration.js';
import { tracer as globalTracer } from '../tracing/tracer.js';

// ---------------------------------------------------------------------------
// attachStorageToEvents
// ---------------------------------------------------------------------------

/** Options for attachStorageToEvents. */
export interface StorageAttachmentOptions {
  /**
   * Auto-save completed traces to `storage.traces`.
   * Default: `true`.
   */
  traces?: boolean;
}

/** Handle returned by attachStorageToEvents. */
export interface StorageAttachment {
  /** Unsubscribe all event handlers registered by this attachment. */
  detach(): void;
}

/**
 * Subscribe to an EventEmitter and auto-persist completed traces to storage.
 *
 * Internally wraps `attachTracingToEvents` and registers a second `onAny`
 * handler that fires **after** the tracing handler — so traces are always
 * finalized before they are saved.
 *
 * Storage errors are swallowed (fire-and-forget) so a slow or failing backend
 * never interrupts the request pipeline.
 *
 * @param emitter         EventEmitter to subscribe to.
 * @param storage         StorageRegistry that receives the persisted data.
 * @param tracerInstance  Tracer to use (defaults to the global singleton).
 * @param options         Fine-grained control over what gets persisted.
 */
export function attachStorageToEvents(
  emitter: EventEmitter,
  storage: StorageRegistry,
  tracerInstance: Tracer = globalTracer,
  options: StorageAttachmentOptions = {}
): StorageAttachment {
  const saveTraces = options.traces !== false;

  // Register the tracing integration first so traces are finalized before our
  // persistHandler runs (onAny handlers fire in registration order).
  const tracingAttachment = attachTracingToEvents(emitter, tracerInstance);

  const persistHandler = async (event: OpenGuardEvent): Promise<void> => {
    if (!saveTraces) return;
    if (event.eventType !== 'completion' && event.eventType !== 'failure') return;
    const trace = tracingAttachment.getTrace(event.requestId);
    if (trace) {
      await storage.traces.saveTrace(trace).catch(() => {});
    }
  };

  emitter.onAny(persistHandler);

  return {
    detach() {
      emitter.offAny(persistHandler);
      tracingAttachment.detach();
    },
  };
}

// ---------------------------------------------------------------------------
// One-shot flush helpers
// ---------------------------------------------------------------------------

/**
 * Bulk-save an array of Metric objects to a store.
 * Returns the number of metrics persisted.
 *
 * Prefer this over calling `saveMetric` in a loop — most backends implement
 * `saveMetrics` as a single atomic write (e.g. one NDJSON append, one INSERT).
 */
export async function flushMetricsToStore(
  metrics: Metric[],
  store: IMetricStore
): Promise<number> {
  if (metrics.length === 0) return 0;
  await store.saveMetrics(metrics);
  return metrics.length;
}

/**
 * Bulk-save all completed traces from a Tracer to a store.
 * Returns the number of traces persisted.
 *
 * Saves are issued concurrently via `Promise.all`.
 * Call `tracer.clear()` after flushing if you want to free the in-memory copy.
 */
export async function flushTracesToStore(
  tracerInstance: Tracer,
  store: ITraceStore
): Promise<number> {
  const traces = tracerInstance.listCompleted();
  if (traces.length === 0) return 0;
  await Promise.all(traces.map((t) => store.saveTrace(t)));
  return traces.length;
}
