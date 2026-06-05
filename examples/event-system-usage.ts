/**
 * Example usage of the OpenGuard Event System
 * 
 * This example demonstrates how to use the event system for observability
 * without external telemetry dependencies.
 */

import {
  eventEmitter,
  type OpenGuardEvent,
  type CompletionEvent,
  type FailureEvent,
  type RetryEvent,
} from '../src/events/index.js';

// Example 1: Simple event listener
console.log('=== Example 1: Simple Event Listener ===');

eventEmitter.on('completion', (event: CompletionEvent) => {
  console.log(`Request completed in ${event.data.duration}ms`);
  console.log(`Provider: ${event.data.provider}`);
  console.log(`Attempts: ${event.data.attempts}`);
});

// Example 2: Async event handler
console.log('\n=== Example 2: Async Event Handler ===');

eventEmitter.on('failure', async (event: FailureEvent) => {
  console.log(`Request failed at stage: ${event.data.stage}`);
  console.log(`Error: ${event.data.error.message}`);
  
  // Simulate async operation (e.g., logging to external service)
  await new Promise(resolve => setTimeout(resolve, 100));
  console.log('Failure logged asynchronously');
});

// Example 3: Filtered event handler
console.log('\n=== Example 3: Filtered Event Handler ===');

eventEmitter.on('retry', 
  (event: RetryEvent) => {
    console.log(`Retry attempt ${event.data.attempt}/${event.data.maxRetries}`);
    console.log(`Reason: ${event.data.reason}`);
  },
  {
    filter: (event) => event.data.attempt > 1, // Only log retries after first attempt
  }
);

// Example 4: Global event listener for all events
console.log('\n=== Example 4: Global Event Listener ===');

eventEmitter.onAny((event: OpenGuardEvent) => {
  console.log(`[${event.eventType}] Event ID: ${event.eventId}`);
});

// Example 5: Conditional logging based on event type
console.log('\n=== Example 5: Conditional Logging ===');

eventEmitter.onAny(
  (event: OpenGuardEvent) => {
    if (event.eventType === 'completion' && event.data.duration > 5000) {
      console.warn(`Slow request detected: ${event.data.duration}ms`);
    }
  },
  {
    async: true, // Run asynchronously to not block main flow
  }
);

// Example 6: Removing event listeners
console.log('\n=== Example 6: Removing Event Listeners ===');

const slowRequestHandler = (event: CompletionEvent) => {
  if (event.data.duration > 3000) {
    console.log(`Slow request: ${event.data.duration}ms`);
  }
};

eventEmitter.on('completion', slowRequestHandler);

// Later, remove the handler
// eventEmitter.off('completion', slowRequestHandler);

// Example 7: Getting listener count
console.log('\n=== Example 7: Listener Count ===');

console.log(`Completion event listeners: ${eventEmitter.listenerCount('completion')}`);

// Example 8: Clearing all listeners
console.log('\n=== Example 8: Clearing Listeners ===');

// eventEmitter.removeAllListeners();
// eventEmitter.removeAllListenersFor('completion');

console.log('\n=== Event System Setup Complete ===');
console.log('Events will now be emitted during OpenGuard operations.');
