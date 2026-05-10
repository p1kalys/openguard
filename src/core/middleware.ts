/**
 * Lightweight middleware/plugin system for OpenGuard
 */

import type { GenerateRequest, GenerateResponse } from '../providers/base.js';

/**
 * Middleware context for request/response lifecycle
 */
export interface MiddlewareContext {
  /** Request being processed */
  request: GenerateRequest;
  /** Response being processed (available in afterResponse) */
  response?: GenerateResponse;
  /** Error that occurred (available in onValidationError) */
  error?: Error;
  /** Metadata that can be shared between middleware */
  metadata: Record<string, any>;
  /** Middleware execution order */
  order: number;
}

/**
 * Middleware function signature
 */
export type MiddlewareFunction<T = any> = (
  context: MiddlewareContext,
  next: () => Promise<T>
) => Promise<T>;

/**
 * Before request middleware
 */
export interface BeforeRequestMiddleware {
  /** Middleware name for identification */
  name: string;
  /** Execution order (lower = earlier) */
  order?: number;
  /** Whether this middleware is enabled */
  enabled?: boolean;
  /** Middleware function */
  handler: MiddlewareFunction<GenerateRequest>;
}

/**
 * After response middleware
 */
export interface AfterResponseMiddleware {
  /** Middleware name for identification */
  name: string;
  /** Execution order (lower = earlier) */
  order?: number;
  /** Whether this middleware is enabled */
  enabled?: boolean;
  /** Middleware function */
  handler: MiddlewareFunction<GenerateResponse>;
}

/**
 * Validation error middleware
 */
export interface ValidationErrorMiddleware {
  /** Middleware name for identification */
  name: string;
  /** Execution order (lower = earlier) */
  order?: number;
  /** Whether this middleware is enabled */
  enabled?: boolean;
  /** Middleware function */
  handler: MiddlewareFunction<void>;
}

/**
 * Middleware configuration
 */
export interface MiddlewareConfig {
  /** Before request middleware */
  beforeRequest?: BeforeRequestMiddleware[];
  /** After response middleware */
  afterResponse?: AfterResponseMiddleware[];
  /** Validation error middleware */
  onValidationError?: ValidationErrorMiddleware[];
}

/**
 * Lightweight middleware manager
 */
export class MiddlewareManager {
  private config: MiddlewareConfig;
  private nextOrder: number = 0;

  constructor(config: MiddlewareConfig = {}) {
    this.config = {
      beforeRequest: [],
      afterResponse: [],
      onValidationError: [],
      ...config,
    };
  }

  /**
   * Add before request middleware
   */
  addBeforeRequest(middleware: BeforeRequestMiddleware): this {
    const ordered = {
      order: middleware.order ?? this.nextOrder++,
      enabled: true,
      ...middleware,
    };
    this.config.beforeRequest!.push(ordered);
    this.config.beforeRequest!.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return this;
  }

  /**
   * Add after response middleware
   */
  addAfterResponse(middleware: AfterResponseMiddleware): this {
    const ordered = {
      order: middleware.order ?? this.nextOrder++,
      enabled: true,
      ...middleware,
    };
    this.config.afterResponse!.push(ordered);
    this.config.afterResponse!.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return this;
  }

  /**
   * Add validation error middleware
   */
  addValidationError(middleware: ValidationErrorMiddleware): this {
    const ordered = {
      order: middleware.order ?? this.nextOrder++,
      enabled: true,
      ...middleware,
    };
    this.config.onValidationError!.push(ordered);
    this.config.onValidationError!.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return this;
  }

  /**
   * Execute before request middleware chain
   */
  async executeBeforeRequest(request: GenerateRequest): Promise<{
    request: GenerateRequest;
    metadata: Record<string, any>;
  }> {
    let currentRequest = { ...request };
    const metadata: Record<string, any> = {};

    for (const middleware of this.config.beforeRequest ?? []) {
      if (!middleware.enabled) continue;

      const context: MiddlewareContext = {
        request: currentRequest,
        metadata,
        order: middleware.order!,
      };

      currentRequest = await middleware.handler(context, async () => currentRequest);
    }

    return { request: currentRequest, metadata };
  }

  /**
   * Execute after response middleware chain
   */
  async executeAfterResponse(
    request: GenerateRequest,
    response: GenerateResponse,
    metadata: Record<string, any>
  ): Promise<GenerateResponse> {
    let currentResponse = { ...response };

    for (const middleware of this.config.afterResponse ?? []) {
      if (!middleware.enabled) continue;

      const context: MiddlewareContext = {
        request,
        response: currentResponse,
        metadata,
        order: middleware.order!,
      };

      currentResponse = await middleware.handler(context, async () => currentResponse);
    }

    return currentResponse;
  }

  /**
   * Execute validation error middleware chain
   */
  async executeValidationError(
    request: GenerateRequest,
    error: Error,
    metadata: Record<string, any>
  ): Promise<void> {
    for (const middleware of this.config.onValidationError ?? []) {
      if (!middleware.enabled) continue;

      const context: MiddlewareContext = {
        request,
        error,
        metadata,
        order: middleware.order!,
      };

      await middleware.handler(context, async () => { });
    }
  }

  /**
   * Enable/disable middleware by name
   */
  setMiddlewareEnabled(name: string, enabled: boolean): void {
    // Check before request middleware
    const beforeMiddleware = this.config.beforeRequest?.find(m => m.name === name);
    if (beforeMiddleware) {
      beforeMiddleware.enabled = enabled;
    }

    // Check after response middleware
    const afterMiddleware = this.config.afterResponse?.find(m => m.name === name);
    if (afterMiddleware) {
      afterMiddleware.enabled = enabled;
    }

    // Check validation error middleware
    const validationMiddleware = this.config.onValidationError?.find(m => m.name === name);
    if (validationMiddleware) {
      validationMiddleware.enabled = enabled;
    }
  }

  /**
   * Get list of enabled middleware
   */
  getEnabledMiddleware(): {
    beforeRequest: string[];
    afterResponse: string[];
    onValidationError: string[];
  } {
    return {
      beforeRequest: this.config.beforeRequest?.filter(m => m.enabled).map(m => m.name) ?? [],
      afterResponse: this.config.afterResponse?.filter(m => m.enabled).map(m => m.name) ?? [],
      onValidationError: this.config.onValidationError?.filter(m => m.enabled).map(m => m.name) ?? [],
    };
  }

  /**
   * Remove middleware by name
   */
  removeMiddleware(name: string): this {
    this.config.beforeRequest = this.config.beforeRequest?.filter(m => m.name !== name);
    this.config.afterResponse = this.config.afterResponse?.filter(m => m.name !== name);
    this.config.onValidationError = this.config.onValidationError?.filter(m => m.name !== name);
    return this;
  }

  /**
   * Clear all middleware
   */
  clear(): this {
    this.config.beforeRequest = [];
    this.config.afterResponse = [];
    this.config.onValidationError = [];
    this.nextOrder = 0;
    return this;
  }
}
