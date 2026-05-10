/**
 * Base verification provider implementation
 */

import { 
  VerificationProvider, 
  VerificationRequest, 
  VerificationProviderResponse 
} from '../types.js';

/**
 * Abstract base class for verification providers
 */
export abstract class BaseVerificationProvider implements VerificationProvider {
  abstract name: string;
  
  protected config: {
    model?: string;
    temperature: number;
    maxTokens: number;
  };

  constructor(config: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}) {
    this.config = {
      temperature: 0.1,
      maxTokens: 1000,
      ...config,
    };
  }

  abstract verify(request: VerificationRequest): Promise<VerificationProviderResponse>;
  abstract isAvailable(): boolean;

  /**
   * Create standardized response
   */
  protected createResponse(
    response: string,
    model: string,
    tokens?: { input: number; output: number; total: number },
    processingTime: number = 0
  ): VerificationProviderResponse {
    return {
      response,
      metadata: {
        provider: this.name,
        model,
        tokens,
        processingTime,
      },
    };
  }

  /**
   * Measure processing time for async operations
   */
  protected async measureTime<T>(
    operation: () => Promise<T>
  ): Promise<{ result: T; processingTime: number }> {
    const startTime = Date.now();
    const result = await operation();
    const processingTime = Date.now() - startTime;
    return { result, processingTime };
  }
}
