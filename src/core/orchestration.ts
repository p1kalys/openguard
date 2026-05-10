/**
 * Lightweight fallback orchestration system for OpenGuard
 */

import type { AIProvider, GenerateRequest, GenerateResponse } from '../providers/base.js';

/**
 * Fallback configuration for a provider
 */
export interface FallbackConfig {
  /** Provider instance */
  provider: AIProvider;
  /** Maximum retry attempts for this provider */
  maxRetries?: number;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Whether this provider is enabled */
  enabled?: boolean;
}

/**
 * Fallback orchestration options
 */
export interface FallbackOptions {
  /** Schema validation function */
  validateSchema?: (response: GenerateResponse) => boolean | Promise<boolean>;
  /** Global timeout for all providers */
  globalTimeout?: number;
  /** Whether to continue trying after first success */
  continueOnSuccess?: boolean;
}

/**
 * Fallback result with metadata
 */
export interface FallbackResult {
  /** Successful response */
  response: GenerateResponse;
  /** Provider that succeeded */
  provider: string;
  /** Number of attempts made */
  attempts: number;
  /** Fallback chain used */
  fallbackChain: string[];
  /** Time taken in milliseconds */
  duration: number;
}

/**
 * Lightweight fallback orchestrator for multiple providers
 */
export class FallbackOrchestrator {
  private configs: FallbackConfig[] = [];
  private options: FallbackOptions;

  constructor(options: FallbackOptions = {}) {
    this.options = {
      globalTimeout: 30000,
      continueOnSuccess: false,
      ...options,
    };
  }

  /**
   * Add a provider to fallback chain
   */
  addProvider(config: FallbackConfig): this {
    this.configs.push({
      maxRetries: 3,
      timeout: 10000,
      enabled: true,
      ...config,
    });
    return this;
  }

  /**
   * Generate response with fallback logic
   */
  async generate(request: GenerateRequest): Promise<FallbackResult> {
    const startTime = Date.now();
    const fallbackChain: string[] = [];
    let totalAttempts = 0;

    for (const config of this.configs) {
      if (!config.enabled) continue;

      fallbackChain.push(config.provider.constructor.name);
      
      try {
        const result = await this.executeWithRetry(config, request);
        totalAttempts += result.attempts;

        return {
          response: result.response,
          provider: config.provider.constructor.name,
          attempts: totalAttempts,
          fallbackChain,
          duration: Date.now() - startTime,
        };
      } catch (error) {
        totalAttempts += config.maxRetries! + 1;
        continue;
      }
    }

    throw new Error('All fallback providers failed');
  }

  /**
   * Execute provider with retry logic
   */
  private async executeWithRetry(
    config: FallbackConfig,
    request: GenerateRequest
  ): Promise<{ response: GenerateResponse; attempts: number }> {
    let lastError: Error | null = null;
    let attempts = 0;

    for (let attempt = 0; attempt <= config.maxRetries!; attempt++) {
      attempts++;
      
      try {
        const response = await this.withTimeout(
          config.provider.generate(request),
          config.timeout!
        );

        if (this.options.validateSchema) {
          const isValid = await this.options.validateSchema(response);
          if (!isValid) {
            throw new Error('Schema validation failed');
          }
        }

        return { response, attempts };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (lastError.message === 'Schema validation failed') {
          throw lastError;
        }
        
        if (attempt < config.maxRetries!) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Wrap promise with timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), timeout);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Delay for exponential backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
