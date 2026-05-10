/**
 * Fake stream utilities for testing
 */

import type { GenerateResponse } from '../providers/base.js';

/**
 * Fake async generator for testing
 */
export class FakeStream<T> implements AsyncIterable<T> {
  constructor(
    private items: T[],
    private options: {
      delay?: number;
      shouldError?: boolean;
      errorMessage?: string;
    } = {}
  ) {}

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    for (const item of this.items) {
      if (this.options.delay) {
        await new Promise(resolve => setTimeout(resolve, this.options.delay));
      }

      if (this.options.shouldError) {
        throw new Error(this.options.errorMessage || 'Fake stream error');
      }

      yield item;
    }
  }
}

/**
 * Create fake stream from array
 */
export function createFakeStream<T>(
  items: T[],
  options?: {
    delay?: number;
    shouldError?: boolean;
    errorMessage?: string;
  }
): FakeStream<T> {
  return new FakeStream(items, options);
}

/**
 * Create fake response stream
 */
export function createFakeResponseStream(
  responses: GenerateResponse[],
  options?: {
    delay?: number;
    shouldError?: boolean;
    errorMessage?: string;
  }
): AsyncIterable<GenerateResponse> {
  return createFakeStream(responses, options);
}
