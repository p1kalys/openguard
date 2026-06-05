/**
 * Example demonstrating retry logic with validation and strategy configuration
 */

import { retry, validateSchema, repairJson, extractJsonFromMarkdown, RetryStrategies, createRetryStrategy } from '../src/index.js';
import { z } from 'zod';

console.log('=== Retry Logic Examples ===\n');

// Define a schema for user data
const userSchema = z.object({
  name: z.string(),
  age: z.number(),
});

// Simulate an LLM that sometimes returns invalid data
async function mockLLMCall(attempt: number): Promise<{ success: boolean; data?: string; error?: any }> {
  console.log(`  Attempt ${attempt + 1}: Calling LLM...`);

  // Simulate different responses on different attempts
  if (attempt === 0) {
    // First attempt: broken JSON
    return {
      success: true,
      data: "{name: 'John', age: 'thirty',}", // age is wrong type
    };
  } else if (attempt === 1) {
    // Second attempt: still broken but different
    return {
      success: true,
      data: "{name: 'John', age: 30,}", // trailing comma
    };
  } else {
    // Third attempt: valid JSON but still wrong type
    return {
      success: true,
      data: '{"name": "John", "age": 30}', // valid!
    };
  }
}

// Example 1: Retry with exponential backoff strategy
console.log('1. Retry with exponential backoff strategy:');
const validationResult = await retry(
  async () => {
    const response = await mockLLMCall(0);
    if (!response.success || !response.data) {
      return { success: false, error: { type: 'ERROR' as const, message: 'LLM failed', timestamp: 0 } };
    }

    // Try to repair the JSON
    const repaired = repairJson(response.data);
    if (!repaired.success) {
      return repaired as any;
    }

    // Parse and validate
    const parsed = JSON.parse(repaired.data);
    return validateSchema(userSchema, parsed);
  },
  RetryStrategies.exponential()
);

if (validationResult.success) {
  console.log('  Success! Valid data:', validationResult.data);
} else {
  console.log('  Failed after retries:', validationResult.error);
}
console.log();

// Example 2: Retry with preset aggressive strategy
console.log('2. Retry with aggressive strategy for transient errors:');

async function mockNetworkErrorLLM(attempt: number): Promise<{ success: boolean; data?: string; error?: any }> {
  console.log(`  Attempt ${attempt + 1}: Calling LLM...`);

  if (attempt < 2) {
    throw new Error('ECONNREFUSED');
  }

  return {
    success: true,
    data: '{"name": "Jane", "age": 25}',
  };
}

const networkResult = await retry(
  async () => {
    const response = await mockNetworkErrorLLM(0);
    if (!response.success || !response.data) {
      return { success: false, error: { type: 'ERROR' as const, message: 'LLM failed', timestamp: 0 } };
    }

    const repaired = repairJson(response.data);
    if (!repaired.success) {
      return repaired as any;
    }

    const parsed = JSON.parse(repaired.data);
    return validateSchema(userSchema, parsed);
  },
  RetryStrategies.aggressive()
);

if (networkResult.success) {
  console.log('  Success! Valid data:', networkResult.data);
} else {
  console.log('  Failed after retries:', networkResult.error);
}
console.log();

// Example 3: Custom retry strategy with specific configuration
console.log('3. Custom retry strategy with specific backoff:');
const customStrategy = createRetryStrategy({
  maxRetries: 4,
  initialDelayMs: 500,
  backoffStrategy: 'exponential-with-jitter',
  jitterFactor: 0.2,
  onRetry: (err, attempt, delayMs) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  Retry ${attempt} after ${delayMs}ms delay: ${msg}`);
  },
});

const customResult = await retry(
  async () => {
    const response = await mockLLMCall(0);
    if (!response.success || !response.data) {
      return { success: false, error: { type: 'ERROR' as const, message: 'LLM failed', timestamp: 0 } };
    }

    const repaired = repairJson(response.data);
    if (!repaired.success) {
      return repaired as any;
    }

    const parsed = JSON.parse(repaired.data);
    return validateSchema(userSchema, parsed);
  },
  customStrategy
);

if (customResult.success) {
  console.log('  Success! Valid data:', customResult.data);
} else {
  console.log('  Failed after retries:', customResult.error);
}
console.log();

// Example 4: Conservative strategy for critical operations
console.log('4. Conservative strategy for critical operations:');
const conservativeResult = await retry(
  async () => {
    const response = await mockLLMCall(0);
    if (!response.success || !response.data) {
      return { success: false, error: { type: 'ERROR' as const, message: 'LLM failed', timestamp: 0 } };
    }

    const repaired = repairJson(response.data);
    if (!repaired.success) {
      return repaired as any;
    }

    const parsed = JSON.parse(repaired.data);
    return validateSchema(userSchema, parsed);
  },
  RetryStrategies.conservative()
);

if (conservativeResult.success) {
  console.log('  Success! Valid data:', conservativeResult.data);
} else {
  console.log('  Failed after retries:', conservativeResult.error);
}
console.log();
