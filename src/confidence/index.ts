/**
 * Main confidence aggregation module exports for OpenGuard
 */

// Re-export types and interfaces
export {
  ConfidenceSource,
  ConfidenceScore,
  ConfidenceAggregationResult,
  ConfidenceAggregationConfig,
  AggregationStrategy,
  DEFAULT_CONFIDENCE_CONFIG,
} from './types.js';

// Re-export engine
export { ConfidenceAggregationEngine } from './engine.js';

// Convenience functions for quick confidence aggregation
import { ConfidenceAggregationEngine } from './engine.js';
import { ConfidenceAggregationConfig, DEFAULT_CONFIDENCE_CONFIG } from './types.js';

/**
 * Quick confidence aggregation with default configuration
 */
export function quickConfidenceAggregation(scores: any[]): any {
  const engine = new ConfidenceAggregationEngine();
  return engine.aggregateConfidence(scores);
}

/**
 * Create confidence aggregation engine with custom configuration
 */
export function createConfidenceAggregator(
  config?: Partial<ConfidenceAggregationConfig>
): ConfidenceAggregationEngine {
  return new ConfidenceAggregationEngine(config);
}

/**
 * Aggregate confidence from multiple validation sources
 */
export function aggregateFromValidationSources(
  validationResults: {
    schemaValidation?: any;
    repairOperation?: any;
    retryOperation?: any;
    semanticValidation?: any;
    hallucinationCheck?: any;
    groundingValidation?: any;
    selfVerification?: any;
    reliabilityScoring?: any;
  },
  config?: Partial<ConfidenceAggregationConfig>
): any {
  const engine = new ConfidenceAggregationEngine(config);
  const scores: any[] = [];
  
  // Extract confidence scores from each validation source
  if (validationResults.schemaValidation) {
    scores.push(engine.addConfidenceScore('schema_validation', 
      validationResults.schemaValidation.score || 0, 
      { issueCount: validationResults.schemaValidation.issues?.length || 0 }
    ));
  }
  
  if (validationResults.repairOperation) {
    scores.push(engine.addConfidenceScore('repair_operation', 
      validationResults.repairOperation.success ? 0.8 : 0.3, 
      { issueCount: validationResults.repairOperation.attempts || 0 }
    ));
  }
  
  if (validationResults.retryOperation) {
    scores.push(engine.addConfidenceScore('retry_operation', 
      validationResults.retryOperation.success ? 0.7 : 0.2, 
      { issueCount: validationResults.retryOperation.attempts || 0 }
    ));
  }
  
  if (validationResults.semanticValidation) {
    scores.push(engine.addConfidenceScore('semantic_validation', 
      validationResults.semanticValidation.passed ? 0.8 : 0.4, 
      { issueCount: validationResults.semanticValidation.issues?.length || 0 }
    ));
  }
  
  if (validationResults.hallucinationCheck) {
    scores.push(engine.addConfidenceScore('hallucination_check', 
      1 - (validationResults.hallucinationCheck.hallucinationScore || 0), 
      { issueCount: validationResults.hallucinationCheck.issues?.length || 0 }
    ));
  }
  
  if (validationResults.groundingValidation) {
    scores.push(engine.addConfidenceScore('grounding_validation', 
      validationResults.groundingValidation.passed ? 0.9 : 0.3, 
      { issueCount: validationResults.groundingValidation.issues?.length || 0 }
    ));
  }
  
  if (validationResults.selfVerification) {
    scores.push(engine.addConfidenceScore('self_verification', 
      validationResults.selfVerification.passed ? 0.8 : 0.4, 
      { issueCount: validationResults.selfVerification.issues?.length || 0 }
    ));
  }
  
  if (validationResults.reliabilityScoring) {
    scores.push(engine.addConfidenceScore('reliability_scoring', 
      validationResults.reliabilityScoring.score || 0, 
      { issueCount: validationResults.reliabilityScoring.issues?.length || 0 }
    ));
  }
  
  return engine.aggregateConfidence(scores);
}
