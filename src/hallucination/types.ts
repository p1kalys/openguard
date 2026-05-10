/**
 * Hallucination detection system for OpenGuard
 * Detects unsupported claims, fabricated fields, inconsistent outputs, and speculative language
 */

import { NormalizedResponse } from '../types/normalized.js';

/**
 * Hallucination detection severity levels
 */
export type HallucinationSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Hallucination detection types
 */
export type HallucinationType =
  | 'unsupported_claim'
  | 'fabricated_field'
  | 'inconsistent_output'
  | 'speculative_language'
  | 'contradictory_statement'
  | 'unverifiable_statistic'
  | 'fictional_content'
  | 'misleading_reference';

/**
 * Individual hallucination issue
 */
export interface HallucinationIssue {
  /** Issue identifier */
  id: string;
  /** Issue type */
  type: HallucinationType;
  /** Severity level */
  severity: HallucinationSeverity;
  /** Issue description */
  description: string;
  /** Text position where issue was found */
  position: {
    start: number;
    end: number;
  };
  /** Problematic text */
  problematicText: string;
  /** Why this is considered a hallucination */
  reason: string;
  /** Suggested action to fix */
  suggestion: string;
  /** Confidence in this detection (0-1) */
  confidence: number;
  /** Detection method used */
  detectionMethod: 'heuristic' | 'prompt_assisted' | 'hybrid';
}

/**
 * Hallucination detection result for a single analysis
 */
export interface HallucinationDetectionResult {
  /** Overall hallucination score (0-1, higher = more hallucinated) */
  hallucinationScore: number;
  /** Whether hallucination level exceeds threshold */
  isHallucinated: boolean;
  /** All detected issues */
  issues: HallucinationIssue[];
  /** Detection metadata */
  metadata: {
    /** Detection timestamp */
    timestamp: number;
    /** Processing time in milliseconds */
    processingTime: number;
    /** Detection methods used */
    methodsUsed: HallucinationIssue['detectionMethod'][];
    /** Sensitivity level used */
    sensitivityLevel: string;
  };
}

/**
 * Complete hallucination detection response
 */
export interface HallucinationDetectionResponse {
  /** Original response being analyzed */
  originalResponse: NormalizedResponse;
  /** Detection result */
  result: HallucinationDetectionResult;
  /** Detection configuration used */
  config: HallucinationDetectionConfig;
  /** Summary statistics */
  summary: {
    /** Total issues by severity */
    issuesBySeverity: Record<HallucinationSeverity, number>;
    /** Total issues by type */
    issuesByType: Record<HallucinationType, number>;
    /** Most common issue type */
    mostCommonIssue: HallucinationType | null;
    /** Hallucination risk level */
    riskLevel: 'minimal' | 'low' | 'moderate' | 'high' | 'severe';
  };
}

/**
 * Hallucination detection configuration
 */
export interface HallucinationDetectionConfig {
  /** Sensitivity level for detection */
  sensitivity: 'conservative' | 'balanced' | 'aggressive';
  /** Which detection types to enable */
  enabledTypes: HallucinationType[];
  /** Detection thresholds */
  thresholds: {
    /** Maximum hallucination score to pass (0-1) */
    maxHallucinationScore: number;
    /** Maximum issues allowed by severity */
    maxIssues: Record<HallucinationSeverity, number>;
    /** Minimum confidence to flag issue */
    minConfidence: number;
  };
  /** Heuristic detection settings */
  heuristic: {
    /** Whether to use pattern-based detection */
    usePatternDetection: boolean;
    /** Whether to use statistical analysis */
    useStatisticalAnalysis: boolean;
    /** Whether to use language analysis */
    useLanguageAnalysis: boolean;
    /** Custom pattern rules */
    customPatterns: HallucinationPattern[];
  };
  /** Prompt-assisted detection settings */
  promptAssisted: {
    /** Whether to use LLM validation */
    useLLMValidation: boolean;
    /** Model to use for validation */
    model?: string;
    /** Temperature for validation (lower = more consistent) */
    temperature: number;
    /** Maximum tokens for validation response */
    maxTokens: number;
    /** Custom validation prompts */
    customPrompts: Record<HallucinationType, string>;
  };
  /** Output filtering settings */
  filtering: {
    /** Whether to ignore common conversational phrases */
    ignoreConversationalFillers: boolean;
    /** Whether to ignore hedging language */
    ignoreHedgingLanguage: boolean;
    /** Whether to ignore uncertainty expressions */
    ignoreUncertaintyExpressions: boolean;
    /** Custom words/phrases to ignore */
    ignoredPhrases: string[];
  };
}

/**
 * Hallucination pattern for heuristic detection
 */
export interface HallucinationPattern {
  /** Pattern identifier */
  id: string;
  /** Pattern name */
  name: string;
  /** Pattern type */
  type: HallucinationType;
  /** Regex pattern or detection function */
  pattern: RegExp | ((text: string) => boolean);
  /** Pattern description */
  description: string;
  /** Severity level */
  severity: HallucinationSeverity;
  /** Confidence weight */
  confidenceWeight: number;
  /** Whether pattern is enabled */
  enabled: boolean;
}

/**
 * Default hallucination detection configuration
 */
export const DEFAULT_HALLUCINATION_CONFIG: HallucinationDetectionConfig = {
  sensitivity: 'balanced',
  enabledTypes: [
    'unsupported_claim',
    'fabricated_field',
    'inconsistent_output',
    'speculative_language',
    'contradictory_statement',
    'unverifiable_statistic',
    'fictional_content',
    'misleading_reference'
  ],
  thresholds: {
    maxHallucinationScore: 0.3,
    maxIssues: {
      low: 10,
      medium: 5,
      high: 2,
      critical: 0,
    },
    minConfidence: 0.6,
  },
  heuristic: {
    usePatternDetection: true,
    useStatisticalAnalysis: true,
    useLanguageAnalysis: true,
    customPatterns: [],
  },
  promptAssisted: {
    useLLMValidation: false,
    temperature: 0.1,
    maxTokens: 500,
    customPrompts: {} as Record<HallucinationType, string>,
  },
  filtering: {
    ignoreConversationalFillers: true,
    ignoreHedgingLanguage: false,
    ignoreUncertaintyExpressions: false,
    ignoredPhrases: [
      'I think', 'I believe', 'It seems', 'Probably', 'Maybe',
      'I\'m not sure', 'I could be wrong', 'in my opinion'
    ],
  },
};
