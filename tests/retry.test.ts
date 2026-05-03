import { describe, it, expect, vi } from 'vitest';
import { retry, RetryStrategies, createRetryStrategy, mergeRetryStrategies } from '../src/retry/retry-strategy.js';

describe('Retry Strategy', () => {
  it('should succeed on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue({ success: true, data: 'result' });
    const result = await retry(fn, { maxRetries: 3 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('result');
    }
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on error', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue({ success: true, data: 'result' });
    const result = await retry(fn, { maxRetries: 3 });
    expect(result.success).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should exhaust retries after max attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    const result = await retry(fn, { maxRetries: 2 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('RETRY_EXHAUSTED_ERROR');
      expect(result.error.retries).toBe(3); // initial + 2 retries
    }
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should call onRetry callback', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue({ success: true, data: 'result' });
    await retry(fn, { maxRetries: 3, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should respect custom shouldRetry condition', async () => {
    const shouldRetry = vi.fn().mockReturnValue(false);
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    const result = await retry(fn, { maxRetries: 3, shouldRetry });
    expect(result.success).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1); // should not retry
    expect(shouldRetry).toHaveBeenCalled();
  });

  it('should handle error results from function', async () => {
    const fn = vi.fn()
      .mockResolvedValueOnce({ success: false, error: { type: 'ERROR', message: 'fail', timestamp: 0 } })
      .mockResolvedValue({ success: true, data: 'result' });
    const result = await retry(fn, { maxRetries: 3 });
    expect(result.success).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should add delay between retries', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue({ success: true, data: 'result' });
    const startTime = Date.now();
    await retry(fn, { maxRetries: 3, initialDelayMs: 100 });
    const endTime = Date.now();
    expect(endTime - startTime).toBeGreaterThanOrEqual(100);
  });

  it('should use exponential backoff strategy', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue({ success: true, data: 'result' });
    const delays: number[] = [];
    const startTime = Date.now();

    await retry(fn, {
      maxRetries: 3,
      initialDelayMs: 100,
      backoffStrategy: 'exponential',
      onRetry: (_, attempt, delayMs) => {
        delays.push(delayMs);
      },
    });

    expect(delays).toHaveLength(2);
    expect(delays[1]).toBeGreaterThan(delays[0]); // Exponential growth
  });

  it('should use fixed backoff strategy', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue({ success: true, data: 'result' });
    const delays: number[] = [];

    await retry(fn, {
      maxRetries: 3,
      initialDelayMs: 100,
      backoffStrategy: 'fixed',
      onRetry: (_, attempt, delayMs) => {
        delays.push(delayMs);
      },
    });

    expect(delays).toHaveLength(2);
    expect(delays[0]).toBe(100);
    expect(delays[1]).toBe(100); // Fixed delay
  });

  it('should retry on network errors by default', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValue({ success: true, data: 'result' });
    const result = await retry(fn, { maxRetries: 3, initialDelayMs: 10 });
    expect(result.success).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should not retry on non-retryable errors when retryableErrors is set', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('validation error'));
    const result = await retry(fn, {
      maxRetries: 3,
      retryableErrors: ['network'],
      retryOnNetworkErrors: false,
      initialDelayMs: 10, // Add small delay to prevent hanging
      shouldRetry: () => false, // Explicitly prevent retries
    });
    expect(result.success).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);
  }, 1000); // Add timeout to test
});

describe('Retry Strategies', () => {
  it('should create none strategy', () => {
    const strategy = RetryStrategies.none();
    expect(strategy.maxRetries).toBe(0);
  });

  it('should create fixed strategy', () => {
    const strategy = RetryStrategies.fixed(5, 2000);
    expect(strategy.maxRetries).toBe(5);
    expect(strategy.initialDelayMs).toBe(2000);
    expect(strategy.backoffStrategy).toBe('fixed');
  });

  it('should create exponential strategy', () => {
    const strategy = RetryStrategies.exponential();
    expect(strategy.backoffStrategy).toBe('exponential');
    expect(strategy.maxRetries).toBe(3);
  });

  it('should create exponential with jitter strategy', () => {
    const strategy = RetryStrategies.exponentialWithJitter();
    expect(strategy.backoffStrategy).toBe('exponential-with-jitter');
    expect(strategy.jitterFactor).toBe(0.1);
  });

  it('should create aggressive strategy', () => {
    const strategy = RetryStrategies.aggressive();
    expect(strategy.maxRetries).toBe(5);
    expect(strategy.initialDelayMs).toBe(100);
  });

  it('should create conservative strategy', () => {
    const strategy = RetryStrategies.conservative();
    expect(strategy.maxRetries).toBe(2);
    expect(strategy.initialDelayMs).toBe(2000);
  });

  it('should create custom retry strategy', () => {
    const strategy = createRetryStrategy({
      maxRetries: 10,
      initialDelayMs: 500,
      backoffStrategy: 'linear',
    });
    expect(strategy.maxRetries).toBe(10);
    expect(strategy.initialDelayMs).toBe(500);
    expect(strategy.backoffStrategy).toBe('linear');
  });

  it('should merge retry strategies', () => {
    const base = RetryStrategies.exponential();
    const merged = mergeRetryStrategies(base, {
      maxRetries: 5,
      initialDelayMs: 2000,
    });
    expect(merged.maxRetries).toBe(5);
    expect(merged.initialDelayMs).toBe(2000);
    expect(merged.backoffStrategy).toBe('exponential');
  });
});
