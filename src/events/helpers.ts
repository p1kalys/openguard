/**
 * Lightweight helpers for emitting lifecycle events with request correlation.
 */

import type { GenerateRequest, GenerateResponse } from '../providers/base.js';
import { EventEmitter, eventEmitter } from './emitter.js';
import { generateEventId, generateRequestId } from './ids.js';
import type {
  CompletionEvent,
  FailureEvent,
  HallucinationCheckEvent,
  ProviderCallEvent,
  RequestStartEvent,
  ResponseNormalizationEvent,
  RetryEvent,
  ValidationEvent,
} from './types.js';

export interface RequestEventContextOptions {
  /** Correlate all events for a single request (auto-generated if omitted). */
  requestId?: string;
  /** Emitter instance (defaults to the global singleton). */
  emitter?: EventEmitter;
}

/**
 * Per-request context for emitting correlated lifecycle events.
 */
export class RequestEventContext {
  readonly requestId: string;
  private readonly emitter: EventEmitter;

  constructor(options: RequestEventContextOptions = {}) {
    this.requestId = options.requestId ?? generateRequestId();
    this.emitter = options.emitter ?? eventEmitter;
  }

  async emitRequestStart(request: GenerateRequest, provider: string): Promise<void> {
    const event: RequestStartEvent = {
      eventId: generateEventId(),
      timestamp: Date.now(),
      requestId: this.requestId,
      eventType: 'request.start',
      data: { request, provider },
    };
    await this.emitter.emit(event);
  }

  async emitProviderCall(
    provider: string,
    model: string,
    attempt: number,
    params: Partial<GenerateRequest>
  ): Promise<void> {
    const event: ProviderCallEvent = {
      eventId: generateEventId(),
      timestamp: Date.now(),
      requestId: this.requestId,
      eventType: 'provider.call',
      data: { provider, model, attempt, params },
    };
    await this.emitter.emit(event);
  }

  async emitNormalization(
    provider: string,
    rawResponse: unknown,
    normalizedResponse: GenerateResponse,
    duration: number
  ): Promise<void> {
    const event: ResponseNormalizationEvent = {
      eventId: generateEventId(),
      timestamp: Date.now(),
      requestId: this.requestId,
      eventType: 'response.normalization',
      data: { provider, rawResponse, normalizedResponse, duration },
    };
    await this.emitter.emit(event);
  }

  async emitValidation(
    validationType: string,
    passed: boolean,
    details?: Record<string, unknown>,
    error?: string
  ): Promise<void> {
    const event: ValidationEvent = {
      eventId: generateEventId(),
      timestamp: Date.now(),
      requestId: this.requestId,
      eventType: 'validation',
      data: { validationType, passed, details, error },
    };
    await this.emitter.emit(event);
  }

  async emitRetry(
    attempt: number,
    maxRetries: number,
    reason: string,
    delay: number,
    err?: Error
  ): Promise<void> {
    const event: RetryEvent = {
      eventId: generateEventId(),
      timestamp: Date.now(),
      requestId: this.requestId,
      eventType: 'retry',
      data: { attempt, maxRetries, reason, delay, error: err },
    };
    await this.emitter.emit(event);
  }

  async emitHallucinationCheck(
    response: GenerateResponse,
    score: number,
    detected: boolean,
    confidence: number,
    details?: Record<string, unknown>
  ): Promise<void> {
    const event: HallucinationCheckEvent = {
      eventId: generateEventId(),
      timestamp: Date.now(),
      requestId: this.requestId,
      eventType: 'hallucination.check',
      data: { response, score, detected, confidence, details },
    };
    await this.emitter.emit(event);
  }

  async emitCompletion(
    response: GenerateResponse,
    duration: number,
    attempts: number,
    provider: string
  ): Promise<void> {
    const event: CompletionEvent = {
      eventId: generateEventId(),
      timestamp: Date.now(),
      requestId: this.requestId,
      eventType: 'completion',
      data: {
        response,
        duration,
        attempts,
        provider,
        usage: response.usage,
      },
    };
    await this.emitter.emit(event);
  }

  async emitFailure(
    err: Error,
    stage: FailureEvent['data']['stage'],
    duration: number,
    attempts: number,
    provider?: string
  ): Promise<void> {
    const event: FailureEvent = {
      eventId: generateEventId(),
      timestamp: Date.now(),
      requestId: this.requestId,
      eventType: 'failure',
      data: { error: err, stage, duration, attempts, provider },
    };
    await this.emitter.emit(event);
  }
}

/** Create a new per-request event context. */
export function createRequestEventContext(
  options?: RequestEventContextOptions
): RequestEventContext {
  return new RequestEventContext(options);
}
