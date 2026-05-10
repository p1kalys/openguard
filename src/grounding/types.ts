/**
 * Grounding validation system for OpenGuard
 * Validates generated outputs against provided context and source documents
 */

import { NormalizedResponse } from '../types/normalized.js';

/**
 * Supported source document types
 */
export type SourceType = 'text' | 'retrieval_chunk' | 'structured' | 'metadata';

/**
 * Source document interface
 */
export interface SourceDocument {
  /** Unique document identifier */
  id: string;
  /** Document type */
  type: SourceType;
  /** Document content */
  content: string;
  /** Document metadata */
  metadata: {
    /** Document title */
    title?: string;
    /** Source URL or reference */
    source?: string;
    /** Creation timestamp */
    createdAt?: number;
    /** Author or creator */
    author?: string;
    /** Document tags */
    tags?: string[];
    /** Relevance score */
    relevanceScore?: number;
    /** Additional metadata */
    [key: string]: any;
  };
  /** Text chunks for retrieval */
  chunks?: TextChunk[];
}

/**
 * Text chunk for retrieval-based grounding
 */
export interface TextChunk {
  /** Chunk identifier */
  id: string;
  /** Chunk content */
  text: string;
  /** Chunk position in document */
  position: {
    start: number;
    end: number;
  };
  /** Chunk metadata */
  metadata: {
    /** Chunk relevance score */
    relevanceScore?: number;
    /** Chunk type */
    type?: 'sentence' | 'paragraph' | 'section';
    /** Additional metadata */
    [key: string]: any;
  };
}

/**
 * Extracted claim from generated response
 */
export interface Claim {
  /** Claim identifier */
  id: string;
  /** Claim text */
  text: string;
  /** Claim type */
  type: 'factual' | 'numerical' | 'temporal' | 'causal' | 'comparative';
  /** Claim confidence */
  confidence: number;
  /** Claim position in response */
  position: {
    start: number;
    end: number;
  };
  /** Claim metadata */
  metadata: {
    /** Key entities mentioned */
    entities?: string[];
    /** Claim sentiment */
    sentiment?: 'positive' | 'negative' | 'neutral';
    /** Claim specificity */
    specificity: 'general' | 'specific' | 'detailed';
  };
}

/**
 * Grounding validation result for a claim
 */
export interface ClaimValidationResult {
  /** Original claim */
  claim: Claim;
  /** Whether claim is grounded in sources */
  isGrounded: boolean;
  /** Grounding confidence (0-1) */
  confidence: number;
  /** Supporting evidence from sources */
  supportingEvidence: Evidence[];
  /** Contradicting evidence from sources */
  contradictingEvidence: Evidence[];
  /** Missing information */
  missingInformation: string[];
  /** Validation metadata */
  metadata: {
    /** Validation method used */
    method: 'heuristic' | 'prompt_based' | 'hybrid';
    /** Processing time in milliseconds */
    processingTime: number;
    /** Sources consulted */
    sourcesConsulted: string[];
  };
}

/**
 * Evidence from source documents
 */
export interface Evidence {
  /** Evidence identifier */
  id: string;
  /** Source document ID */
  sourceId: string;
  /** Evidence text */
  text: string;
  /** Evidence type */
  type: 'direct_match' | 'partial_match' | 'contradiction' | 'context';
  /** Relevance score */
  relevanceScore: number;
  /** Evidence position in source */
  position: {
    chunkId?: string;
    start: number;
    end: number;
  };
  /** Evidence metadata */
  metadata: {
    /** Match type */
    matchType?: 'exact' | 'semantic' | 'fuzzy';
    /** Match confidence */
    matchConfidence?: number;
    /** Additional metadata */
    [key: string]: any;
  };
}

/**
 * Grounding validation severity
 */
export type GroundingSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Unsupported claim issue
 */
export interface UnsupportedClaimIssue {
  /** Issue identifier */
  id: string;
  /** Claim that is unsupported */
  claim: Claim;
  /** Issue severity */
  severity: GroundingSeverity;
  /** Issue description */
  description: string;
  /** Why the claim is unsupported */
  reason: string;
  /** Suggested action */
  suggestion: string;
  /** Confidence in this assessment */
  confidence: number;
}

/**
 * Complete grounding validation response
 */
export interface GroundingValidationResponse {
  /** Original response being validated */
  originalResponse: NormalizedResponse;
  /** Source documents used for validation */
  sourceDocuments: SourceDocument[];
  /** All extracted claims */
  claims: Claim[];
  /** Claim validation results */
  claimResults: ClaimValidationResult[];
  /** Unsupported claim issues */
  unsupportedClaims: UnsupportedClaimIssue[];
  /** Overall grounding metrics */
  metrics: {
    /** Overall grounding score (0-1) */
    groundingScore: number;
    /** Percentage of grounded claims */
    groundedClaimsPercentage: number;
    /** Total claims extracted */
    totalClaims: number;
    /** Grounded claims count */
    groundedClaimsCount: number;
    /** Unsupported claims count */
    unsupportedClaimsCount: number;
  };
  /** Validation metadata */
  metadata: {
    /** Validation timestamp */
    timestamp: number;
    /** Total processing time */
    processingTime: number;
    /** Validation configuration used */
    config: GroundingValidationConfig;
  };
}

/**
 * Grounding validation configuration
 */
export interface GroundingValidationConfig {
  /** Claim extraction settings */
  claimExtraction: {
    /** Minimum claim length */
    minClaimLength: number;
    /** Maximum claim length */
    maxClaimLength: number;
    /** Claim types to extract */
    claimTypes: Claim['type'][];
    /** Whether to extract numerical claims */
    extractNumerical: boolean;
    /** Whether to extract temporal claims */
    extractTemporal: boolean;
  };
  /** Evidence matching settings */
  evidenceMatching: {
    /** Minimum similarity threshold for matching */
    minSimilarity: number;
    /** Maximum evidence distance */
    maxEvidenceDistance: number;
    /** Whether to use semantic matching */
    useSemanticMatching: boolean;
    /** Whether to use fuzzy matching */
    useFuzzyMatching: boolean;
  };
  /** Validation thresholds */
  thresholds: {
    /** Minimum grounding score to pass */
    minGroundingScore: number;
    /** Maximum unsupported claims allowed */
    maxUnsupportedClaims: number;
    /** Minimum evidence support */
    minEvidenceSupport: number;
  };
  /** Processing options */
  options: {
    /** Whether to use prompt-based validation */
    usePromptValidation: boolean;
    /** Whether to use heuristic validation */
    useHeuristicValidation: boolean;
    /** Maximum processing time per claim (ms) */
    maxProcessingTimePerClaim: number;
    /** Whether to cache results */
    cacheResults: boolean;
  };
}

/**
 * Default grounding validation configuration
 */
export const DEFAULT_GROUNDING_CONFIG: GroundingValidationConfig = {
  claimExtraction: {
    minClaimLength: 10,
    maxClaimLength: 500,
    claimTypes: ['factual', 'numerical', 'temporal', 'causal', 'comparative'],
    extractNumerical: true,
    extractTemporal: true,
  },
  evidenceMatching: {
    minSimilarity: 0.7,
    maxEvidenceDistance: 1000,
    useSemanticMatching: true,
    useFuzzyMatching: true,
  },
  thresholds: {
    minGroundingScore: 0.7,
    maxUnsupportedClaims: 3,
    minEvidenceSupport: 0.5,
  },
  options: {
    usePromptValidation: true,
    useHeuristicValidation: true,
    maxProcessingTimePerClaim: 5000,
    cacheResults: true,
  },
};
