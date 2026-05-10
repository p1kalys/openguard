/**
 * Main hallucination detection module exports for OpenGuard
 */

// Re-export types and interfaces
export {
  HallucinationSeverity,
  HallucinationType,
  HallucinationIssue,
  HallucinationDetectionResult,
  HallucinationDetectionResponse,
  HallucinationDetectionConfig,
  HallucinationPattern,
  DEFAULT_HALLUCINATION_CONFIG,
} from './types.js';

// Re-export engines
export { HallucinationDetectionEngine } from './engine.js';

// Convenience functions for quick hallucination detection
import { HallucinationDetectionEngine } from './engine.js';
import { HallucinationDetectionConfig, DEFAULT_HALLUCINATION_CONFIG } from './types.js';
import { NormalizedResponse } from '../types/normalized.js';

/**
 * Quick hallucination detection with default configuration
 */
export async function quickHallucinationDetection(
  response: NormalizedResponse,
  config?: Partial<HallucinationDetectionConfig>
) {
  const engine = new HallucinationDetectionEngine(config);
  return engine.detectHallucinations(response);
}

/**
 * Create hallucination detection engine with custom configuration
 */
export function createHallucinationDetector(
  config?: Partial<HallucinationDetectionConfig>
): HallucinationDetectionEngine {
  return new HallucinationDetectionEngine(config);
}

/**
 * Detect hallucinations in text directly
 */
export function detectHallucinationsInText(
  text: string,
  config?: Partial<HallucinationDetectionConfig>
) {
  const engine = new HallucinationDetectionEngine(config);
  return engine.detectHallucinations({ text, provider: 'unknown', model: 'unknown', finishReason: 'stop' } as NormalizedResponse);
}
