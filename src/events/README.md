# OpenGuard Event System

A lightweight, modular event system for internal observability without external telemetry dependencies.

## Overview

The event system provides lifecycle event emissions for key operations in OpenGuard, enabling observability and monitoring without requiring external telemetry services.

## Event Types

### Lifecycle Events

- **request.start** - Emitted when a request starts processing
- **provider.call** - Emitted when a provider is called
- **response.normalization** - Emitted when a response is normalized
- **validation** - Emitted during validation operations
- **retry** - Emitted when a retry is attempted
- **hallucination.check** - Emitted during hallucination detection
- **completion** - Emitted when a request completes successfully
- **failure** - Emitted when a request fails

## Usage

### Basic Event Listener

```typescript
import { eventEmitter, type CompletionEvent } from 'openguard';

eventEmitter.on('completion', (event: CompletionEvent) => {
  console.log(`Request completed in ${event.data.duration}ms`);
  console.log(`Provider: ${event.data.provider}`);
});
```

### Async Event Handler

```typescript
eventEmitter.on('failure', async (event) => {
  console.log(`Request failed: ${event.data.error.message}`);
  // Perform async operations like logging
  await logToService(event);
});
```

### Filtered Event Handler

```typescript
eventEmitter.on('retry',
  (event) => {
    console.log(`Retry attempt ${event.data.attempt}`);
  },
  {
    filter: (event) => event.data.attempt > 1, // Only log retries after first attempt
  }
);
```

### Global Event Listener

```typescript
eventEmitter.onAny((event) => {
  console.log(`[${event.eventType}] Event ID: ${event.eventId}`);
});
```

### Removing Listeners

```typescript
const handler = (event) => console.log(event);
eventEmitter.on('completion', handler);

// Later
eventEmitter.off('completion', handler);
```

### Clearing All Listeners

```typescript
eventEmitter.removeAllListeners();
eventEmitter.removeAllListenersFor('completion');
```

## Event Structure

All events follow this base structure:

```typescript
interface BaseEvent {
  eventId: string;      // Unique event identifier
  timestamp: number;    // Timestamp when event occurred
  requestId: string;    // Request ID for correlating events
  eventType: string;    // Event type identifier
  data: unknown;        // Event-specific data
}
```

## Integration

The event system is integrated into the orchestration layer and automatically emits events for:

- Request lifecycle (start, completion, failure)
- Provider calls
- Retry attempts

Additional integrations can be added to other modules (validation, normalization, hallucination checks) as needed.

## Best Practices

1. **Use async handlers** for I/O operations to avoid blocking the main flow
2. **Use filters** to reduce noise and only handle relevant events
3. **Remove listeners** when they're no longer needed to prevent memory leaks
4. **Use requestId** to correlate events across the request lifecycle
5. **Keep handlers lightweight** - avoid heavy computations in event handlers

## Example: Custom Metrics

```typescript
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalDuration: 0,
};

eventEmitter.on('request.start', () => {
  metrics.totalRequests++;
});

eventEmitter.on('completion', (event) => {
  metrics.successfulRequests++;
  metrics.totalDuration += event.data.duration;
});

eventEmitter.on('failure', () => {
  metrics.failedRequests++;
});
```

## No External Dependencies

The event system is designed to be completely self-contained with no external telemetry dependencies. All event handling is done in-memory, making it suitable for:
- Local development
- Testing environments
- Applications that don't require external monitoring
- Custom observability implementations
