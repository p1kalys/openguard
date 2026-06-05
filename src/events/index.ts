/**
 * OpenGuard Event System
 * 
 * A lightweight, modular event system for internal observability
 * without external telemetry dependencies.
 */

// Type definitions
export type {
  BaseEvent,
  RequestStartEvent,
  ProviderCallEvent,
  ResponseNormalizationEvent,
  ValidationEvent,
  RetryEvent,
  HallucinationCheckEvent,
  CompletionEvent,
  FailureEvent,
  OpenGuardEvent,
  OpenGuardEventType,
  OpenGuardEventMap,
  EventHandler,
  EventFilter,
  EventHandlerConfig,
} from './types.js';

// Event emitter
export { EventEmitter, eventEmitter } from './emitter.js';

// Request-scoped emission helpers
export {
  RequestEventContext,
  createRequestEventContext,
  type RequestEventContextOptions,
} from './helpers.js';

export { generateEventId, generateRequestId } from './ids.js';
