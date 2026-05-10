/**
 * Self-verification module for OpenGuard
 * Provides response verification for factual consistency, schema correctness, and unsupported claims
 */

import { NormalizedResponse, NormalizedRequest } from '../types/normalized.js';

/**
 * Verification types
 */
export type VerificationType = 'factual' | 'schema' | 'claims' | 'comprehensive';

/**
 * Verification result severity
 */
export type VerificationSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Individual verification issue
 */
export interface VerificationIssue {
  /** Issue type */
  type: VerificationType;
  /** Severity level */
  severity: VerificationSeverity;
  /** Issue description */
  description: string;
  /** Specific location in response (optional) */
  location?: string;
  /** Suggested fix (optional) */
  suggestion?: string;
  /** Confidence in this issue (0-1) */
  confidence: number;
}

/**
 * Verification result for a single type
 */
export interface VerificationResult {
  /** Verification type */
  type: VerificationType;
  /** Overall score (0-1, higher is better) */
  score: number;
  /** Whether verification passed */
  passed: boolean;
  /** List of issues found */
  issues: VerificationIssue[];
  /** Verification metadata */
  metadata: {
    /** Verification timestamp */
    timestamp: number;
    /** Verification prompt used */
    prompt: string;
    /** Raw verification response */
    rawResponse: string;
    /** Processing time in milliseconds */
    processingTime: number;
  };
}

/**
 * Complete verification response
 */
export interface VerificationResponse {
  /** Original response being verified */
  originalResponse: NormalizedResponse;
  /** Original request context */
  originalRequest?: NormalizedRequest;
  /** All verification results */
  results: VerificationResult[];
  /** Overall verification score (0-1) */
  overallScore: number;
  /** Whether overall verification passed */
  passed: boolean;
  /** Verification metadata */
  metadata: {
    /** Total verification timestamp */
    timestamp: number;
    /** Total processing time */
    processingTime: number;
    /** Verification configuration used */
    config: VerificationConfig;
    /** Verification session ID */
    sessionId: string;
  };
}

/**
 * Verification prompt template
 */
export interface VerificationPrompt {
  /** Template name */
  name: string;
  /** Verification type */
  type: VerificationType;
  /** Prompt template with placeholders */
  template: string;
  /** Expected response format */
  expectedFormat: 'json' | 'text' | 'score';
  /** Default prompt */
  isDefault: boolean;
}

/**
 * Verification configuration
 */
export interface VerificationConfig {
  /** Which verification types to run */
  enabledTypes: VerificationType[];
  /** Custom prompts to use */
  customPrompts?: Record<VerificationType, string>;
  /** Expected schema for validation */
  schema?: any;
  /** Verification thresholds */
  thresholds: {
    /** Minimum score to pass verification */
    minScore: number;
    /** Maximum issues allowed */
    maxIssues: number;
    /** Severity weights for scoring */
    severityWeights: Record<VerificationSeverity, number>;
  };
  /** Loop protection settings */
  loopProtection: {
    /** Maximum verification depth */
    maxDepth: number;
    /** Current verification depth */
    currentDepth: number;
    /** Session identifier for tracking */
    sessionId?: string;
  };
  /** Provider settings */
  provider: {
    /** Model to use for verification */
    model?: string;
    /** Temperature for verification (lower = more consistent) */
    temperature: number;
    /** Maximum tokens for verification response */
    maxTokens: number;
  };
}

/**
 * Provider-agnostic verification interface
 */
export interface VerificationProvider {
  /** Provider name */
  name: string;
  /** Generate verification response */
  verify(request: VerificationRequest): Promise<VerificationProviderResponse>;
  /** Check if provider is available */
  isAvailable(): boolean;
}

/**
 * Verification request sent to provider
 */
export interface VerificationRequest {
  /** Verification prompt */
  prompt: string;
  /** Original response to verify */
  originalResponse: NormalizedResponse;
  /** Original request context */
  originalRequest?: NormalizedRequest;
  /** Verification configuration */
  config: VerificationConfig;
  /** Verification type */
  type: VerificationType;
}

/**
 * Verification provider response
 */
export interface VerificationProviderResponse {
  /** Verification response text */
  response: string;
  /** Provider metadata */
  metadata: {
    /** Provider name */
    provider: string;
    /** Model used */
    model: string;
    /** Tokens used */
    tokens?: {
      input: number;
      output: number;
      total: number;
    };
    /** Processing time */
    processingTime: number;
  };
}

/**
 * Default verification configuration
 */
export const DEFAULT_VERIFICATION_CONFIG: VerificationConfig = {
  enabledTypes: ['factual', 'schema', 'claims'],
  thresholds: {
    minScore: 0.7,
    maxIssues: 5,
    severityWeights: {
      low: 0.1,
      medium: 0.3,
      high: 0.6,
      critical: 1.0,
    },
  },
  loopProtection: {
    maxDepth: 3,
    currentDepth: 0,
  },
  provider: {
    temperature: 0.1,
    maxTokens: 1000,
  },
};
