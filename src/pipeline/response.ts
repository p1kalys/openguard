/**
 * Pipeline response interfaces for future implementation
 */

import type { GenerateResponse } from '../providers/base.js';

/**
 * Pipeline response with metadata
 */
export interface PipelineResponse extends GenerateResponse {
  /** Pipeline execution metadata */
  pipeline?: PipelineMetadata;
  /** Processing stages that were executed */
  stages?: PipelineStage[];
  /** Total processing time */
  processingTime?: number;
}

/**
 * Pipeline execution metadata
 */
export interface PipelineMetadata {
  /** Provider used */
  provider?: string;
  /** Model used */
  model?: string;
  /** Capabilities used */
  capabilities?: string[];
  /** Error information if any */
  error?: {
    stage: PipelineStage;
    message: string;
    details?: Record<string, any>;
  };
  /** Success indicators */
  success?: {
    middleware?: boolean;
    normalization?: boolean;
    repair?: boolean;
    validation?: boolean;
    retry?: boolean;
  };
}

/**
 * Pipeline result wrapper
 */
export interface PipelineResult {
  /** Final response */
  response?: PipelineResponse;
  /** Whether processing succeeded */
  success: boolean;
  /** Error if processing failed */
  error?: Error;
  /** Execution summary */
  summary?: {
    totalStages: number;
    totalTime: number;
    providerUsed: string;
    capabilitiesUsed: string[];
  };
}

/**
 * Pipeline processing stages
 */
export type PipelineStage = 
  | 'request'
  | 'middleware'
  | 'provider'
  | 'normalization'
  | 'repair'
  | 'validation'
  | 'retry'
  | 'complete';
