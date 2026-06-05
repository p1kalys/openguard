/**
 * Event system type definitions for OpenGuard observability
 */

import type { GenerateRequest, GenerateResponse } from '../providers/base.js';

/**
 * Base event interface
 */
export interface BaseEvent {
  /** Unique event identifier */
  eventId: string;
  /** Timestamp when event occurred */
  timestamp: number;
  /** Request ID for correlating events */
  requestId: string;
}

/**
 * Request start event
 */
export interface RequestStartEvent extends BaseEvent {
  eventType: 'request.start';
  data: {
    /** The original request */
    request: GenerateRequest;
    /** Provider being used */
    provider: string;
  };
}

/**
 * Provider call event
 */
export interface ProviderCallEvent extends BaseEvent {
  eventType: 'provider.call';
  data: {
    /** Provider name */
    provider: string;
    /** Model being used */
    model: string;
    /** Attempt number */
    attempt: number;
    /** Request parameters */
    params: Partial<GenerateRequest>;
  };
}

/**
 * Response normalization event
 */
export interface ResponseNormalizationEvent extends BaseEvent {
  eventType: 'response.normalization';
  data: {
    /** Provider name */
    provider: string;
    /** Raw response from provider */
    rawResponse: unknown;
    /** Normalized response */
    normalizedResponse: GenerateResponse;
    /** Duration in milliseconds */
    duration: number;
  };
}

/**
 * Validation event
 */
export interface ValidationEvent extends BaseEvent {
  eventType: 'validation';
  data: {
    /** Validation type (schema, semantic, grounding, etc.) */
    validationType: string;
    /** Whether validation passed */
    passed: boolean;
    /** Validation details */
    details?: Record<string, unknown>;
    /** Error message if validation failed */
    error?: string;
  };
}

/**
 * Retry event
 */
export interface RetryEvent extends BaseEvent {
  eventType: 'retry';
  data: {
    /** 1-based retry attempt number */
    attempt: number;
    /** Maximum retries allowed */
    maxRetries: number;
    /** Reason for retry */
    reason: string;
    /** Delay before next retry in milliseconds */
    delay: number;
    /** Error that triggered retry */
    error?: Error;
  };
}

/**
 * Hallucination check event
 */
export interface HallucinationCheckEvent extends BaseEvent {
  eventType: 'hallucination.check';
  data: {
    /** Response being checked */
    response: GenerateResponse;
    /** Hallucination score (0-1) */
    score: number;
    /** Whether hallucination was detected */
    detected: boolean;
    /** Confidence level */
    confidence: number;
    /** Details about the check */
    details?: Record<string, unknown>;
  };
}

/**
 * Completion event
 */
export interface CompletionEvent extends BaseEvent {
  eventType: 'completion';
  data: {
    /** Final response */
    response: GenerateResponse;
    /** Total duration in milliseconds */
    duration: number;
    /** Total attempts made */
    attempts: number;
    /** Provider that succeeded */
    provider: string;
    /** Token usage */
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };
}

/**
 * Failure event
 */
export interface FailureEvent extends BaseEvent {
  eventType: 'failure';
  data: {
    /** Error that caused failure */
    error: Error;
    /** Stage where failure occurred */
    stage: 'provider' | 'validation' | 'normalization' | 'timeout' | 'unknown';
    /** Provider being used */
    provider?: string;
    /** Total duration before failure */
    duration: number;
    /** Total attempts made */
    attempts: number;
  };
}

/**
 * Union type of all event types
 */
export type OpenGuardEvent =
  | RequestStartEvent
  | ProviderCallEvent
  | ResponseNormalizationEvent
  | ValidationEvent
  | RetryEvent
  | HallucinationCheckEvent
  | CompletionEvent
  | FailureEvent;

/** Discriminated event type literals. */
export type OpenGuardEventType = OpenGuardEvent['eventType'];

/** Map from event type literal to its payload interface. */
export interface OpenGuardEventMap {
  'request.start': RequestStartEvent;
  'provider.call': ProviderCallEvent;
  'response.normalization': ResponseNormalizationEvent;
  validation: ValidationEvent;
  retry: RetryEvent;
  'hallucination.check': HallucinationCheckEvent;
  completion: CompletionEvent;
  failure: FailureEvent;
}

/**
 * Event handler function type
 */
export type EventHandler<T extends OpenGuardEvent = OpenGuardEvent> = (
  event: T
) => void | Promise<void>;

/**
 * Event filter function type
 */
export type EventFilter = (event: OpenGuardEvent) => boolean;

/**
 * Event handler configuration
 */
export interface EventHandlerConfig {
  /** The handler function */
  handler: EventHandler;
  /** Optional filter to determine if handler should be called */
  filter?: EventFilter;
  /** Whether handler should run asynchronously */
  async?: boolean;
}
