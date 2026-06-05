import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EventEmitter,
  createRequestEventContext,
  type CompletionEvent,
  type OpenGuardEvent,
  type ValidationEvent,
} from '../src/events/index.js';

describe('Event System', () => {
  let emitter: EventEmitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  describe('EventEmitter', () => {
    it('invokes typed handlers for specific event types', async () => {
      const handler = vi.fn();
      emitter.on('completion', handler);

      const event: CompletionEvent = {
        eventId: 'evt_1',
        timestamp: Date.now(),
        requestId: 'req_1',
        eventType: 'completion',
        data: {
          response: { id: '1', content: 'hi', model: 'gpt-4' },
          duration: 100,
          attempts: 1,
          provider: 'TestProvider',
        },
      };

      await emitter.emit(event);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('supports async handlers without blocking emit', async () => {
      const order: string[] = [];
      emitter.on('validation', async () => {
        await new Promise((r) => setTimeout(r, 10));
        order.push('async');
      });

      await emitter.emit({
        eventId: 'evt_2',
        timestamp: Date.now(),
        requestId: 'req_2',
        eventType: 'validation',
        data: { validationType: 'schema', passed: true },
      } satisfies ValidationEvent);

      expect(order).toEqual(['async']);
    });

    it('runs global handlers for all events', async () => {
      const globalHandler = vi.fn();
      emitter.onAny(globalHandler);

      const event: OpenGuardEvent = {
        eventId: 'evt_3',
        timestamp: Date.now(),
        requestId: 'req_3',
        eventType: 'request.start',
        data: {
          request: { prompt: 'hello', model: 'gpt-4' },
          provider: 'TestProvider',
        },
      };

      await emitter.emit(event);
      expect(globalHandler).toHaveBeenCalledWith(event);
    });

    it('respects filters', async () => {
      const handler = vi.fn();
      emitter.on(
        'retry',
        handler,
        { filter: (e) => e.eventType === 'retry' && e.data.attempt > 0 }
      );

      await emitter.emit({
        eventId: 'evt_4',
        timestamp: Date.now(),
        requestId: 'req_4',
        eventType: 'retry',
        data: { attempt: 0, maxRetries: 3, reason: 'timeout', delay: 1000 },
      });
      await emitter.emit({
        eventId: 'evt_5',
        timestamp: Date.now(),
        requestId: 'req_4',
        eventType: 'retry',
        data: { attempt: 1, maxRetries: 3, reason: 'timeout', delay: 2000 },
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('removes handlers with off and offAny', async () => {
      const handler = vi.fn();
      emitter.on('failure', handler);
      emitter.off('failure', handler);

      await emitter.emit({
        eventId: 'evt_6',
        timestamp: Date.now(),
        requestId: 'req_6',
        eventType: 'failure',
        data: {
          error: new Error('fail'),
          stage: 'provider',
          duration: 50,
          attempts: 1,
        },
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('fires once handlers only one time', async () => {
      const handler = vi.fn();
      emitter.once('completion', handler);

      const event: CompletionEvent = {
        eventId: 'evt_7',
        timestamp: Date.now(),
        requestId: 'req_7',
        eventType: 'completion',
        data: {
          response: { id: '1', content: 'ok', model: 'gpt-4' },
          duration: 10,
          attempts: 1,
          provider: 'P',
        },
      };

      await emitter.emit(event);
      await emitter.emit(event);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('isolates handler errors from other handlers', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const ok = vi.fn();

      emitter.on('validation', () => {
        throw new Error('handler blew up');
      });
      emitter.on('validation', ok);

      await emitter.emit({
        eventId: 'evt_8',
        timestamp: Date.now(),
        requestId: 'req_8',
        eventType: 'validation',
        data: { validationType: 'schema', passed: false, error: 'bad' },
      });

      expect(ok).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('RequestEventContext', () => {
    it('correlates events with a shared requestId', async () => {
      const events: OpenGuardEvent[] = [];
      emitter.onAny((e) => { events.push(e); });

      const ctx = createRequestEventContext({ requestId: 'req_correlated', emitter });
      await ctx.emitRequestStart({ prompt: 'test', model: 'gpt-4' }, 'ProviderA');
      await ctx.emitValidation('schema', true);
      await ctx.emitCompletion(
        { id: '1', content: 'done', model: 'gpt-4' },
        200,
        1,
        'ProviderA'
      );

      expect(events).toHaveLength(3);
      expect(events.every((e) => e.requestId === 'req_correlated')).toBe(true);
      expect(events.map((e) => e.eventType)).toEqual([
        'request.start',
        'validation',
        'completion',
      ]);
    });
  });
});
