/**
 * Integration with event system for automatic metric collection
 */

import {
  eventEmitter,
  type RequestStartEvent,
  type ProviderCallEvent,
  type ResponseNormalizationEvent,
  type ValidationEvent,
  type RetryEvent,
  type HallucinationCheckEvent,
  type CompletionEvent,
  type FailureEvent,
} from '../events/index.js';
import {
  metricsCollector,
} from './collector.js';

/**
 * Enable automatic metric collection from events
 */
export function enableEventMetrics(): void {
  // Track provider calls for latency
  eventEmitter.on('provider.call', (event: ProviderCallEvent) => {
    const startTime = event.timestamp;
    const provider = event.data.provider;
    const model = event.data.model;

    // Store start time for later latency calculation
    (event as any)._startTime = startTime;
  });

  // Track completion events for latency and token usage
  eventEmitter.on('completion', (event: CompletionEvent) => {
    const dimensions = {
      provider: event.data.provider,
      model: event.data.response.model,
      requestType: 'completion',
    };

    // Record latency
    metricsCollector.recordLatency(dimensions, event.data.duration, 'total');

    // Record token usage if available
    if (event.data.usage) {
      metricsCollector.recordTokenUsage(
        dimensions,
        event.data.usage.promptTokens,
        event.data.usage.completionTokens,
        event.data.usage.totalTokens
      );
    }
  });

  // Track retry events
  eventEmitter.on('retry', (event: RetryEvent) => {
    const dimensions = {
      requestType: 'completion',
    };

    metricsCollector.recordRetry(
      dimensions,
      event.data.attempt,
      event.data.maxRetries,
      event.data.reason,
      event.data.delay
    );
  });

  // Track validation events
  eventEmitter.on('validation', (event: ValidationEvent) => {
    const dimensions = {
      requestType: 'validation',
    };

    if (!event.data.passed) {
      metricsCollector.recordValidationFailure(
        dimensions,
        event.data.validationType,
        event.data.error,
        false
      );
    }
  });

  // Track hallucination checks
  eventEmitter.on('hallucination.check', (event: HallucinationCheckEvent) => {
    const dimensions = {
      model: event.data.response.model,
      requestType: 'hallucination_check',
    };

    metricsCollector.recordHallucination(
      dimensions,
      event.data.score,
      event.data.detected,
      event.data.confidence
    );
  });

  // Track failure events
  eventEmitter.on('failure', (event: FailureEvent) => {
    const dimensions = {
      provider: event.data.provider || 'unknown',
      requestType: 'completion',
    };

    metricsCollector.recordProviderFailure(
      dimensions,
      event.data.stage,
      event.data.error.message,
      event.data.attempts
    );
  });
}

/**
 * Disable automatic metric collection
 */
export function disableEventMetrics(): void {
  eventEmitter.removeAllListenersFor('provider.call');
  eventEmitter.removeAllListenersFor('completion');
  eventEmitter.removeAllListenersFor('retry');
  eventEmitter.removeAllListenersFor('validation');
  eventEmitter.removeAllListenersFor('hallucination.check');
  eventEmitter.removeAllListenersFor('failure');
}
