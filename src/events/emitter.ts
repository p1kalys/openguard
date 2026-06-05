/**
 * Lightweight event emitter with async handler support
 */

import type {
  OpenGuardEvent,
  OpenGuardEventMap,
  OpenGuardEventType,
  EventHandler,
  EventHandlerConfig,
  EventFilter,
} from './types.js';

/**
 * Lightweight event emitter for OpenGuard observability
 */
export class EventEmitter {
  private handlers: Map<string, EventHandlerConfig[]> = new Map();
  private globalHandlers: EventHandlerConfig[] = [];

  /**
   * Register a handler for a specific event type
   */
  on<T extends OpenGuardEventType>(
    eventType: T,
    handler: EventHandler<OpenGuardEventMap[T]>,
    options?: { filter?: EventFilter; async?: boolean }
  ): this {
    const config: EventHandlerConfig = {
      handler: handler as EventHandler,
      filter: options?.filter,
      async: options?.async ?? true,
    };

    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(config);
    return this;
  }

  /**
   * Register a one-time handler for a specific event type
   */
  once<T extends OpenGuardEventType>(
    eventType: T,
    handler: EventHandler<OpenGuardEventMap[T]>,
    options?: { filter?: EventFilter; async?: boolean }
  ): this {
    const wrapper: EventHandler<OpenGuardEventMap[T]> = async (event) => {
      this.off(eventType, wrapper as EventHandler);
      await handler(event);
    };
    return this.on(eventType, wrapper, options);
  }

  /**
   * Register a handler for all event types
   */
  onAny(
    handler: EventHandler,
    options?: { filter?: EventFilter; async?: boolean }
  ): this {
    const config: EventHandlerConfig = {
      handler,
      filter: options?.filter,
      async: options?.async ?? true,
    };
    this.globalHandlers.push(config);
    return this;
  }

  /**
   * Remove a handler for a specific event type
   */
  off<T extends OpenGuardEventType>(
    eventType: T,
    handler: EventHandler<OpenGuardEventMap[T]>
  ): this {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const index = handlers.findIndex((h) => h.handler === handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
    return this;
  }

  /**
   * Remove a global handler
   */
  offAny(handler: EventHandler): this {
    const index = this.globalHandlers.findIndex((h) => h.handler === handler);
    if (index !== -1) {
      this.globalHandlers.splice(index, 1);
    }
    return this;
  }

  /**
   * Emit an event to all registered handlers
   */
  async emit(event: OpenGuardEvent): Promise<void> {
    const promises: Promise<void>[] = [];

    // Execute type-specific handlers
    const typeHandlers = this.handlers.get(event.eventType) || [];
    for (const config of typeHandlers) {
      if (this.shouldExecute(config, event)) {
        if (config.async) {
          promises.push(this.executeHandler(config.handler, event));
        } else {
          this.executeHandler(config.handler, event);
        }
      }
    }

    // Execute global handlers
    for (const config of this.globalHandlers) {
      if (this.shouldExecute(config, event)) {
        if (config.async) {
          promises.push(this.executeHandler(config.handler, event));
        } else {
          this.executeHandler(config.handler, event);
        }
      }
    }

    // Wait for all async handlers to complete
    await Promise.allSettled(promises);
  }

  /**
   * Check if a handler should be executed based on filter
   */
  private shouldExecute(config: EventHandlerConfig, event: OpenGuardEvent): boolean {
    if (!config.filter) return true;
    try {
      return config.filter(event);
    } catch {
      return false;
    }
  }

  /**
   * Execute a handler with error handling
   */
  private async executeHandler(handler: EventHandler, event: OpenGuardEvent): Promise<void> {
    try {
      await handler(event);
    } catch (error) {
      // Silently handle handler errors to prevent disrupting the main flow
      console.error('[EventEmitter] Handler error:', error);
    }
  }

  /**
   * Remove all handlers
   */
  removeAllListeners(): this {
    this.handlers.clear();
    this.globalHandlers = [];
    return this;
  }

  /**
   * Remove all handlers for a specific event type
   */
  removeAllListenersFor(eventType: string): this {
    this.handlers.delete(eventType);
    return this;
  }

  /**
   * Get the number of handlers for an event type
   */
  listenerCount(eventType: string): number {
    return (this.handlers.get(eventType)?.length || 0) + this.globalHandlers.length;
  }
}

/**
 * Global event emitter instance
 */
export const eventEmitter = new EventEmitter();
