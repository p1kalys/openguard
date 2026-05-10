/**
 * Individual scoring factor implementations
 */

import {
  ScoringFactor,
  SchemaValidationMetadata,
  RepairMetadata,
  RetryMetadata,
  FinishReasonMetadata,
  CompletenessMetadata,
  ScoringConfig
} from './types.js';
import { NormalizedResponse } from '../types/normalized.js';
import { FinishReason } from '../types/types.js';

/**
 * Score schema validation quality
 */
export function scoreSchemaValidation(
  response: NormalizedResponse,
  config: ScoringConfig
): ScoringFactor {
  const metadata: SchemaValidationMetadata = {
    isValidJson: false,
    isValidSchema: false,
    errorCount: 0,
    errors: [],
  };

  let score = 0.5; // Base score

  try {
    // Check if response is valid JSON
    JSON.parse(response.text);
    metadata.isValidJson = true;
    score += 0.3;
  } catch (error) {
    if (metadata.errors) {
      metadata.errors.push(`JSON parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    metadata.errorCount++;
  }

  // Check schema validation if schema is provided
  if (config.schema.expectedSchema && metadata.isValidJson) {
    try {
      const parsed = JSON.parse(response.text);
      // Simple schema validation - in real implementation, use a proper validator
      if (typeof parsed === 'object' && parsed !== null) {
        metadata.isValidSchema = true;
        score += 0.2;
      } else {
        if (metadata.errors) {
          metadata.errors.push('Response is not a valid object');
        }
        metadata.errorCount++;
      }
    } catch (error) {
      if (metadata.errors) {
        metadata.errors.push(`Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      metadata.errorCount++;
    }
  } else if (!config.schema.requireValidJson) {
    // If JSON is not required, give partial credit for having content
    if (response.text.trim().length > 0) {
      score = 0.8;
    }
  }

  // Penalize for errors
  score = Math.max(0, score - (metadata.errorCount * 0.1));

  return {
    name: 'schemaValidation',
    score: Math.min(1, score),
    weight: config.weights.schemaValidation,
    metadata,
  };
}

/**
 * Score based on repair count
 */
export function scoreRepair(
  response: NormalizedResponse,
  config: ScoringConfig,
  repairCount: number = 0,
  originalError?: string
): ScoringFactor {
  const metadata: RepairMetadata = {
    repairCount,
    repairSuccessful: repairCount === 0 || (response.text.trim().length > 0),
    originalError,
  };

  let score = 1.0;

  // Penalize for repair attempts
  if (repairCount > 0) {
    score = Math.max(0.2, 1.0 - (repairCount * 0.2));
  }

  // Additional penalty if repair was unsuccessful
  if (repairCount > 0 && !metadata.repairSuccessful) {
    score = Math.max(0.1, score - 0.3);
  }

  return {
    name: 'repair',
    score,
    weight: config.weights.repair,
    metadata,
  };
}

/**
 * Score based on retry count
 */
export function scoreRetry(
  response: NormalizedResponse,
  retryCount: number = 0,
  maxRetries: number = 3,
  config: ScoringConfig
): ScoringFactor {
  const metadata: RetryMetadata = {
    retryCount,
    maxRetries,
    retriesExhausted: retryCount >= maxRetries,
  };

  let score = 1.0;

  // Penalize for retry attempts
  if (retryCount > 0) {
    score = Math.max(0.3, 1.0 - (retryCount * 0.15));
  }

  // Heavy penalty if retries were exhausted
  if (metadata.retriesExhausted) {
    score = Math.max(0.1, score - 0.4);
  }

  return {
    name: 'retry',
    score,
    weight: config.weights.retry,
    metadata,
  };
}

/**
 * Score based on provider finish reason
 */
export function scoreFinishReason(
  response: NormalizedResponse,
  config: ScoringConfig
): ScoringFactor {
  const finishReason = response.finishReason as FinishReason;

  const metadata: FinishReasonMetadata = {
    finishReason,
    isSuccessful: finishReason === 'stop',
    isTruncated: finishReason === 'length',
  };

  let score = 0.5; // Base score for unknown/missing

  switch (finishReason) {
    case 'stop':
      score = 1.0;
      break;
    case 'tool_calls':
      score = 0.9;
      break;
    case 'length':
      score = 0.6;
      break;
    case 'content_filter':
      score = 0.2;
      break;
    case null:
      score = 0.7; // Assume completion if no finish reason
      break;
  }

  return {
    name: 'finishReason',
    score,
    weight: config.weights.finishReason,
    metadata,
  };
}

/**
 * Score response completeness
 */
export function scoreCompleteness(
  response: NormalizedResponse,
  config: ScoringConfig
): ScoringFactor {
  const responseLength = response.text.trim().length;

  const metadata: CompletenessMetadata = {
    responseLength,
    expectedMinLength: config.completeness.minLength,
    meetsMinLength: responseLength >= config.completeness.minLength,
    appearsComplete: false,
    tokenUsageRatio: undefined,
  };

  let score = 0.5; // Base score

  // Check minimum length
  if (metadata.meetsMinLength) {
    score += 0.3;
  }

  // Check if response appears complete (ends with punctuation, etc.)
  const trimmedText = response.text.trim();
  if (trimmedText.endsWith('.') || trimmedText.endsWith('!') || trimmedText.endsWith('?') ||
    trimmedText.endsWith('}') || trimmedText.endsWith(']') || trimmedText.endsWith('"')) {
    metadata.appearsComplete = true;
    score += 0.2;
  }

  // Consider token usage if available and enabled
  if (config.completeness.considerTokenUsage && response.usage) {
    const { inputTokens = 0, outputTokens = 0, totalTokens = inputTokens + outputTokens } = response.usage;

    if (totalTokens > 0) {
      metadata.tokenUsageRatio = outputTokens / totalTokens;

      // Good token usage ratio (not too short, not cut off)
      if (metadata.tokenUsageRatio > 0.1 && metadata.tokenUsageRatio < 0.9) {
        score += 0.1;
      } else if (metadata.tokenUsageRatio >= 0.9) {
        // Likely truncated
        score -= 0.2;
      }
    }
  }

  // Penalize very short responses
  if (responseLength === 0) {
    score = 0.0;
  } else if (responseLength < 5) {
    score = Math.min(score, 0.2);
  }

  return {
    name: 'completeness',
    score: Math.max(0, Math.min(1, score)),
    weight: config.weights.completeness,
    metadata,
  };
}
