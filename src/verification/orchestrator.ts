/**
 * Verification orchestrator for OpenGuard self-verification
 */

import { 
  VerificationResponse, 
  VerificationResult, 
  VerificationConfig, 
  VerificationRequest,
  VerificationProvider,
  VerificationIssue,
  VerificationType,
  DEFAULT_VERIFICATION_CONFIG 
} from './types.js';
import { getPrompt, renderPrompt, PromptVariables } from './prompts.js';
import { NormalizedResponse, NormalizedRequest } from '../types/normalized.js';

/**
 * Verification orchestrator class
 */
export class VerificationOrchestrator {
  private providers: Map<string, VerificationProvider> = new Map();
  private config: VerificationConfig;

  constructor(config: Partial<VerificationConfig> = {}) {
    this.config = { ...DEFAULT_VERIFICATION_CONFIG, ...config };
  }

  /**
   * Register a verification provider
   */
  registerProvider(provider: VerificationProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * Get available provider
   */
  private getProvider(): VerificationProvider {
    for (const provider of this.providers.values()) {
      if (provider.isAvailable()) {
        return provider;
      }
    }
    throw new Error('No available verification provider found');
  }

  /**
   * Verify a single response
   */
  async verifyResponse(
    response: NormalizedResponse,
    request?: NormalizedRequest,
    config?: Partial<VerificationConfig>
  ): Promise<VerificationResponse> {
    const finalConfig = { ...this.config, ...config };
    const startTime = Date.now();
    const sessionId = this.generateSessionId();

    // Check loop protection
    if (finalConfig.loopProtection.currentDepth >= finalConfig.loopProtection.maxDepth) {
      throw new Error(`Maximum verification depth (${finalConfig.loopProtection.maxDepth}) exceeded`);
    }

    const results: VerificationResult[] = [];

    // Run enabled verification types
    for (const type of finalConfig.enabledTypes) {
      try {
        const result = await this.runVerification(
          type, 
          response, 
          request, 
          finalConfig
        );
        results.push(result);
      } catch (error) {
        // Create error result
        const errorResult: VerificationResult = {
          type,
          score: 0,
          passed: false,
          issues: [{
            type,
            severity: 'critical',
            description: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            confidence: 1.0,
          }],
          metadata: {
            timestamp: Date.now(),
            prompt: '',
            rawResponse: '',
            processingTime: 0,
          },
        };
        results.push(errorResult);
      }
    }

    // Calculate overall score
    const overallScore = this.calculateOverallScore(results, finalConfig);
    const passed = this.isOverallPass(results, finalConfig);

    const verificationResponse: VerificationResponse = {
      originalResponse: response,
      originalRequest: request,
      results,
      overallScore,
      passed,
      metadata: {
        timestamp: Date.now(),
        processingTime: Date.now() - startTime,
        config: finalConfig,
        sessionId,
      },
    };

    return verificationResponse;
  }

  /**
   * Run verification for a specific type
   */
  private async runVerification(
    type: VerificationType,
    response: NormalizedResponse,
    request?: NormalizedRequest,
    config?: VerificationConfig
  ): Promise<VerificationResult> {
    const startTime = Date.now();
    const provider = this.getProvider();
    
    // Get prompt template
    const promptTemplate = getPrompt(type, config?.customPrompts);
    
    // Prepare prompt variables
    const variables: PromptVariables = {
      request: request?.text || '',
      response: response.text,
      schema: config?.schema ? JSON.stringify(config.schema) : undefined,
      context: request?.metadata?.context || '',
    };

    // Render prompt
    const prompt = renderPrompt(promptTemplate, variables);

    // Create verification request
    const verificationRequest: VerificationRequest = {
      prompt,
      originalResponse: response,
      originalRequest: request,
      config: config || this.config,
      type,
    };

    // Get verification from provider
    const providerResponse = await provider.verify(verificationRequest);

    // Parse verification response
    const parsedResult = this.parseVerificationResponse(
      providerResponse.response,
      type,
      promptTemplate.expectedFormat
    );

    return {
      ...parsedResult,
      metadata: {
        timestamp: Date.now(),
        prompt,
        rawResponse: providerResponse.response,
        processingTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Parse verification response from provider
   */
  private parseVerificationResponse(
    response: string,
    type: VerificationType,
    expectedFormat: string
  ): Omit<VerificationResult, 'metadata'> {
    try {
      if (expectedFormat === 'json') {
        const parsed = JSON.parse(response);
        
        // Validate structure
        if (typeof parsed.score !== 'number' || typeof parsed.passed !== 'boolean') {
          throw new Error('Invalid response structure');
        }

        return {
          type,
          score: Math.max(0, Math.min(1, parsed.score)),
          passed: parsed.passed,
          issues: Array.isArray(parsed.issues) ? parsed.issues.map(this.normalizeIssue) : [],
        };
      } else {
        // For text responses, create a simple result
        const hasIssues = response.toLowerCase().includes('issue') || 
                         response.toLowerCase().includes('error') ||
                         response.toLowerCase().includes('problem');

        return {
          type,
          score: hasIssues ? 0.5 : 0.8,
          passed: !hasIssues,
          issues: hasIssues ? [{
            type,
            severity: 'medium',
            description: response.substring(0, 200),
            confidence: 0.7,
          }] : [],
        };
      }
    } catch (error) {
      // Fallback for parsing errors
      return {
        type,
        score: 0.3,
        passed: false,
        issues: [{
          type,
          severity: 'high',
          description: `Failed to parse verification response: ${error instanceof Error ? error.message : 'Unknown error'}`,
          confidence: 1.0,
        }],
      };
    }
  }

  /**
   * Normalize issue object
   */
  private normalizeIssue(issue: any): VerificationIssue {
    return {
      type: issue.type || 'factual',
      severity: issue.severity || 'medium',
      description: issue.description || 'Unknown issue',
      location: issue.location,
      suggestion: issue.suggestion,
      confidence: typeof issue.confidence === 'number' ? Math.max(0, Math.min(1, issue.confidence)) : 0.5,
    };
  }

  /**
   * Calculate overall verification score
   */
  private calculateOverallScore(
    results: VerificationResult[],
    config: VerificationConfig
  ): number {
    if (results.length === 0) return 0;

    let totalScore = 0;
    let totalWeight = 0;

    for (const result of results) {
      // Weight by severity of issues
      let issuePenalty = 0;
      for (const issue of result.issues) {
        issuePenalty += config.thresholds.severityWeights[issue.severity] * issue.confidence;
      }

      // Adjust score based on issues
      const adjustedScore = Math.max(0, result.score - issuePenalty);
      totalScore += adjustedScore;
      totalWeight += 1;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Determine if overall verification passed
   */
  private isOverallPass(
    results: VerificationResult[],
    config: VerificationConfig
  ): boolean {
    // Check if any verification failed
    const hasFailedVerification = results.some(result => !result.passed);
    if (hasFailedVerification) return false;

    // Check total issue count
    const totalIssues = results.reduce((sum, result) => sum + result.issues.length, 0);
    if (totalIssues > config.thresholds.maxIssues) return false;

    // Check for critical issues
    const hasCriticalIssues = results.some(result =>
      result.issues.some(issue => issue.severity === 'critical')
    );
    if (hasCriticalIssues) return false;

    return true;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VerificationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): VerificationConfig {
    return { ...this.config };
  }
}
