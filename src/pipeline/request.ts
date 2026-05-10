/**
 * Pipeline request interfaces for future implementation
 */

import type { GenerateRequest } from '../providers/base.js';

/**
 * Pipeline request with metadata
 */
export interface PipelineRequest extends GenerateRequest {
  /** Pipeline execution options */
  pipeline?: PipelineOptions;
  /** Request metadata */
  metadata?: Record<string, any>;
  /** Request timestamp */
  timestamp?: number;
}

/**
 * Pipeline execution options
 */
export interface PipelineOptions {
  /** Whether to enable middleware */
  enableMiddleware?: boolean;
  /** Whether to enable normalization */
  enableNormalization?: boolean;
  /** Whether to enable repair */
  enableRepair?: boolean;
  /** Whether to enable validation */
  enableValidation?: boolean;
  /** Whether to enable retry */
  enableRetry?: boolean;
  /** Pipeline timeout */
  timeout?: number;
}

/**
 * Pipeline context for request processing
 */
export interface PipelineContext {
  /** Original request */
  request: PipelineRequest;
  /** Current processing stage */
  stage: PipelineStage;
  /** Accumulated metadata */
  metadata: Record<string, any>;
  /** Processing start time */
  startTime: number;
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
