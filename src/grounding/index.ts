/**
 * Main grounding validation module exports for OpenGuard
 */

// Re-export types and interfaces
export {
  SourceType,
  SourceDocument,
  TextChunk,
  Claim,
  ClaimValidationResult,
  Evidence,
  GroundingSeverity,
  UnsupportedClaimIssue,
  GroundingValidationResponse,
  GroundingValidationConfig,
  DEFAULT_GROUNDING_CONFIG,
} from './types.js';

// Re-export engine
export { GroundingValidationEngine } from './engine.js';

// Re-export processors
export { DocumentProcessor } from './processors.js';

// Re-export prompts
export { GroundingPrompts } from './prompts.js';

// Convenience functions for quick grounding validation
import { GroundingValidationEngine } from './engine.js';
import { DocumentProcessor } from './processors.js';
import { GroundingValidationConfig, DEFAULT_GROUNDING_CONFIG, SourceDocument } from './types.js';
import { NormalizedResponse } from '../types/normalized.js';

/**
 * Quick grounding validation with default configuration
 */
export async function quickGroundingValidation(
  response: NormalizedResponse,
  sourceDocuments: any[],
  config?: Partial<GroundingValidationConfig>
) {
  const engine = new GroundingValidationEngine(config);
  const processedDocuments = sourceDocuments.map(doc =>
    DocumentProcessor.processDocument(doc)
  );
  return engine.validateResponse(response, processedDocuments);
}

/**
 * Validate response against text sources
 */
export async function validateAgainstTextSources(
  response: NormalizedResponse,
  textSources: string[],
  config?: Partial<GroundingValidationConfig>
) {
  const documents = DocumentProcessor.createDocumentsFromTexts(textSources);
  return quickGroundingValidation(response, documents, config);
}

/**
 * Validate response against JSON sources
 */
export async function validateAgainstJSONSources(
  response: NormalizedResponse,
  jsonSources: any[],
  config?: Partial<GroundingValidationConfig>
) {
  const documents = DocumentProcessor.createDocumentsFromJSON(jsonSources);
  return quickGroundingValidation(response, documents, config);
}

/**
 * Validate response against retrieval chunks
 */
export async function validateAgainstRetrievalChunks(
  response: NormalizedResponse,
  chunks: Array<{ text: string; metadata?: any }>,
  baseId: string = 'retrieval',
  config?: Partial<GroundingValidationConfig>
) {
  const documents = DocumentProcessor.createRetrievalDocuments(chunks, baseId);
  return quickGroundingValidation(response, documents, config);
}

/**
 * Create grounding validation engine
 */
export function createGroundingValidator(
  config?: Partial<GroundingValidationConfig>
): GroundingValidationEngine {
  return new GroundingValidationEngine(config);
}

/**
 * Create source documents from various input types
 */
export function createSourceDocuments(
  sources: Array<{
    id?: string;
    content: string;
    type?: 'text' | 'structured' | 'retrieval_chunk' | 'metadata';
    metadata?: any;
  }>
): SourceDocument[] {
  return sources.map((source, index) => {
    const doc = DocumentProcessor.createDocument(
      source.id || `source_${index}`,
      source.content,
      source.type || 'text',
      source.metadata
    );
    return DocumentProcessor.processDocument(doc);
  });
}
