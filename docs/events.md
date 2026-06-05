# Event System

Sub-path import: `openguard/events`

A lightweight, in-process event bus for internal observability. No external telemetry dependencies — all handling is in-memory.

## Event Types

| Event | When fired |
|-------|-----------|
| `request.start` | Request begins processing |
| `provider.call` | Provider is called |
| `response.normalization` | Response is normalized |
| `validation` | Validation pass runs |
| `retry` | A retry is triggered |
| `hallucination.check` | Hallucination detection runs |
| `completion` | Request completes successfully |
| `failure` | Request fails |

## Event Structure

```ts
interface BaseEvent {
  eventId: string;    // unique per event
  timestamp: number;
  requestId: string;  // correlates all events for one request
  eventType: string;
  data: unknown;      // event-specific payload
}
```

## Usage

```ts
import { eventEmitter, type CompletionEvent } from 'openguard/events';

// Typed listener
eventEmitter.on('completion', (event: CompletionEvent) => {
  console.log(`[${event.requestId}] done in ${event.data.duration}ms`);
});

// Catch-all listener
eventEmitter.onAny((event) => {
  console.log(`[${event.eventType}] ${event.eventId}`);
});

// Filtered listener
eventEmitter.on('retry', (event) => {
  console.log(`retry #${event.data.attempt}`);
}, { filter: (e) => e.data.attempt > 1 });

// Remove a listener
const handler = (e) => console.log(e);
eventEmitter.on('completion', handler);
eventEmitter.off('completion', handler);

// Remove all listeners
eventEmitter.removeAllListeners();
eventEmitter.removeAllListenersFor('completion');
```

## Best Practices

- Use async handlers for any I/O — listeners are fire-and-forget and won't block the main flow.
- Correlate across the lifecycle using `requestId`.
- Remove listeners (or call `detach()` from the tracing/storage integrations) in test teardown to avoid cross-test contamination.

## Example: Collecting Custom Metrics

```ts
import { eventEmitter } from 'openguard/events';

const counts = { total: 0, ok: 0, fail: 0 };

eventEmitter.on('request.start', () => counts.total++);
eventEmitter.on('completion', () => counts.ok++);
eventEmitter.on('failure', () => counts.fail++);
```
