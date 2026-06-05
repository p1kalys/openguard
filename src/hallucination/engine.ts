/**
 * Core hallucination detection engine for OpenGuard
 */

import {
  HallucinationDetectionResponse,
  HallucinationDetectionConfig,
  HallucinationIssue,
  HallucinationDetectionResult,
  DEFAULT_HALLUCINATION_CONFIG
} from './types.js';
import { NormalizedResponse } from '../types/normalized.js';
import type { RequestEventContext } from '../events/helpers.js';
import type { GenerateResponse } from '../providers/base.js';

/**
 * Hallucination detection engine
 */
export class HallucinationDetectionEngine {
  private config: HallucinationDetectionConfig;

  constructor(config: Partial<HallucinationDetectionConfig> = {}) {
    this.config = { ...DEFAULT_HALLUCINATION_CONFIG, ...config };
  }

  /**
   * Detect hallucinations in response
   */
  async detectHallucinations(
    response: NormalizedResponse,
    config?: Partial<HallucinationDetectionConfig>,
    eventContext?: RequestEventContext
  ): Promise<HallucinationDetectionResponse> {
    const startTime = Date.now();
    const finalConfig = { ...this.config, ...config };

    // Analyze response
    const analysis = this.analyzeResponse(response.text, finalConfig);

    // Detect issues using enabled methods
    const issues: HallucinationIssue[] = [];

    if (finalConfig.heuristic.usePatternDetection) {
      const patternIssues = this.detectPatternIssues(analysis, finalConfig);
      issues.push(...patternIssues);
    }

    if (finalConfig.heuristic.useStatisticalAnalysis) {
      const statisticalIssues = this.detectStatisticalIssues(analysis, finalConfig);
      issues.push(...statisticalIssues);
    }

    if (finalConfig.heuristic.useLanguageAnalysis) {
      const languageIssues = this.detectLanguageIssues(analysis, finalConfig);
      issues.push(...languageIssues);
    }

    if (finalConfig.promptAssisted.useLLMValidation) {
      const promptIssues = await this.detectPromptBasedIssues(response, finalConfig);
      issues.push(...promptIssues);
    }

    // Calculate overall result
    const result = this.calculateDetectionResult(issues, finalConfig);

    if (eventContext) {
      const generateResponse: GenerateResponse = {
        id: `hallucination-${Date.now()}`,
        content: response.text,
        model: response.model,
        finishReason: response.finishReason as GenerateResponse['finishReason'],
        usage: response.usage
          ? {
              promptTokens: response.usage.inputTokens ?? 0,
              completionTokens: response.usage.outputTokens ?? 0,
              totalTokens: response.usage.totalTokens ?? 0,
            }
          : undefined,
      };
      const confidence =
        result.issues.length > 0
          ? result.issues.reduce((sum, i) => sum + i.confidence, 0) / result.issues.length
          : 1 - result.hallucinationScore;
      void eventContext.emitHallucinationCheck(
        generateResponse,
        result.hallucinationScore,
        result.isHallucinated,
        confidence,
        { issueCount: result.issues.length }
      );
    }

    return {
      originalResponse: response,
      result,
      config: finalConfig,
      summary: this.calculateSummary(result),
    };
  }

  /**
   * Analyze response text
   */
  private analyzeResponse(text: string, config: HallucinationDetectionConfig): any {
    const sentences = this.splitIntoSentences(text);
    const words = text.split(/\s+/);

    return {
      text,
      sentences,
      words,
      totalCharacters: text.length,
      totalWords: words.length,
      totalSentences: sentences.length,
      averageWordsPerSentence: sentences.length > 0 ? words.length / sentences.length : 0,
      averageSentenceLength: sentences.length > 0 ? text.length / sentences.length : 0,
    };
  }

  /**
   * Detect issues using pattern matching
   */
  private detectPatternIssues(
    analysis: any,
    config: HallucinationDetectionConfig
  ): HallucinationIssue[] {
    const issues: HallucinationIssue[] = [];

    // Simple pattern detection
    const patterns = [
      {
        name: 'Unsupported Numerical Claims',
        type: 'unsupported_claim' as any,
        pattern: /\b(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*(?:million|billion|trillion|percent|times|fold|increase|decrease))\b/gi,
        description: 'Detects unsupported numerical claims',
        severity: 'high' as any,
        confidenceWeight: 0.8,
        enabled: true,
      },
      {
        name: 'Speculative Language',
        type: 'speculative_language' as any,
        pattern: /\b(might|could|perhaps|probably|maybe|possibly|likely|seems|appears)\b/g,
        description: 'Detects speculative language',
        severity: 'medium' as any,
        confidenceWeight: 0.7,
        enabled: true,
      },
      {
        name: 'Overconfident Claims',
        type: 'speculative_language' as any,
        pattern: /\b(definitely|certainly|absolutely|without|never|always|completely)\b/g,
        description: 'Detects overconfident language',
        severity: 'medium' as any,
        confidenceWeight: 0.5,
        enabled: true,
      },
    ];

    for (const pattern of patterns) {
      if (!config.enabledTypes.includes(pattern.type)) {
        continue;
      }

      const matches = this.applyPattern(pattern, analysis);
      for (const match of matches) {
        issues.push({
          id: `pattern_${pattern.name}_${issues.length}`,
          type: pattern.type,
          severity: pattern.severity,
          description: pattern.description,
          position: match.position,
          problematicText: match.text,
          reason: `Detected ${pattern.name} pattern: ${match.text}`,
          suggestion: `Review and revise: ${match.text}`,
          confidence: pattern.confidenceWeight,
          detectionMethod: 'heuristic',
        });
      }
    }

    return issues;
  }

  /**
   * Apply pattern to analysis
   */
  private applyPattern(pattern: any, analysis: any): any[] {
    const matches: any[] = [];

    if (typeof pattern.pattern === 'function') {
      const result = pattern.pattern(analysis);
      if (result) {
        matches.push(result);
      }
    } else if (pattern.pattern instanceof RegExp) {
      const regex = pattern.pattern;
      let match;

      while ((match = regex.exec(analysis.text)) !== null) {
        matches.push({
          text: match[0],
          position: {
            start: match.index || 0,
            end: (match.index || 0) + match[0].length,
          },
          groups: match.groups || {},
        });
      }
    }

    return matches;
  }

  /**
   * Detect statistical anomalies
   */
  private detectStatisticalIssues(
    analysis: any,
    config: HallucinationDetectionConfig
  ): HallucinationIssue[] {
    const issues: HallucinationIssue[] = [];

    // Check for unusual word/sentence ratios
    if (analysis.averageWordsPerSentence > 30) {
      issues.push({
        id: `statistical_${issues.length}`,
        type: 'inconsistent_output' as any,
        severity: 'medium' as any,
        description: 'Unusually high words per sentence ratio may indicate hallucination',
        position: { start: 0, end: analysis.totalCharacters },
        problematicText: analysis.text.substring(0, 100),
        reason: `Average ${analysis.averageWordsPerSentence.toFixed(1)} words per sentence (threshold: 30)`,
        suggestion: 'Review for potential hallucination or verbose output',
        confidence: 0.7,
        detectionMethod: 'heuristic',
      });
    }

    return issues;
  }

  /**
   * Detect language-based issues
   */
  private detectLanguageIssues(
    analysis: any,
    config: HallucinationDetectionConfig
  ): HallucinationIssue[] {
    const issues: HallucinationIssue[] = [];
    const text = analysis.text.toLowerCase();

    // Check for speculative language patterns
    if (!config.filtering.ignoreUncertaintyExpressions) {
      const uncertaintyPatterns = [
        /\b(I\'m not sure|I could be wrong|don\'t quote me|this might not be accurate)\b/gi,
        /\b\(unverified|according to some sources|needs verification\)\b/gi,
      ];

      for (const pattern of uncertaintyPatterns) {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
          issues.push({
            id: `language_${issues.length}`,
            type: 'speculative_language' as any,
            severity: 'medium' as any,
            description: 'Uncertainty expressions detected',
            position: { start: 0, end: 100 },
            problematicText: matches[0],
            reason: `Found uncertainty expression: ${matches[0]}`,
            suggestion: 'Remove uncertainty expressions or provide sources',
            confidence: 0.9,
            detectionMethod: 'heuristic',
          });
        }
      }
    }

    return issues;
  }

  /**
   * Detect issues using prompt-based validation
   */
  private async detectPromptBasedIssues(
    response: NormalizedResponse,
    config: HallucinationDetectionConfig
  ): Promise<HallucinationIssue[]> {
    const issues: HallucinationIssue[] = [];

    // Mock implementation for now
    const text = response.text.toLowerCase();

    // Check for fabricated claims (mock implementation)
    if (text.includes('according to a recent study that doesn\'t exist')) {
      issues.push({
        id: `prompt_${issues.length}`,
        type: 'unsupported_claim' as any,
        severity: 'high' as any,
        description: 'Reference to non-existent study detected',
        position: { start: 0, end: 100 },
        problematicText: 'according to a recent study that doesn\'t exist',
        reason: 'References fictional or non-existent source',
        suggestion: 'Verify sources and provide accurate references',
        confidence: 0.9,
        detectionMethod: 'prompt_assisted',
      });
    }

    return issues;
  }

  /**
   * Calculate detection result
   */
  private calculateDetectionResult(
    issues: HallucinationIssue[],
    config: HallucinationDetectionConfig
  ): HallucinationDetectionResult {
    const hallucinationScore = this.calculateHallucinationScore(issues, config);
    const isHallucinated = hallucinationScore > config.thresholds.maxHallucinationScore;

    const methodsUsed = new Set<HallucinationIssue['detectionMethod']>();
    for (const issue of issues) {
      methodsUsed.add(issue.detectionMethod);
    }

    return {
      hallucinationScore,
      isHallucinated,
      issues,
      metadata: {
        timestamp: Date.now(),
        processingTime: 0,
        methodsUsed: Array.from(methodsUsed),
        sensitivityLevel: config.sensitivity,
      },
    };
  }

  /**
   * Calculate hallucination score
   */
  private calculateHallucinationScore(
    issues: HallucinationIssue[],
    config: HallucinationDetectionConfig
  ): number {
    if (issues.length === 0) {
      return 0.0;
    }

    let totalScore = 0;
    const severityWeights = {
      low: 0.1,
      medium: 0.3,
      high: 0.6,
      critical: 1.0,
    };

    for (const issue of issues) {
      if (config.enabledTypes.includes(issue.type)) {
        totalScore += severityWeights[issue.severity] * issue.confidence;
      }
    }

    // Normalize to 0-1 scale
    const maxPossibleScore = issues.length * 1.0;
    return Math.min(1.0, totalScore / maxPossibleScore);
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(result: HallucinationDetectionResult): any {
    const issuesBySeverity = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    const issuesByType = {
      unsupported_claim: 0,
      fabricated_field: 0,
      inconsistent_output: 0,
      speculative_language: 0,
      contradictory_statement: 0,
      unverifiable_statistic: 0,
      fictional_content: 0,
      misleading_reference: 0,
    };

    let mostCommonIssue: HallucinationIssue['type'] | null = null;
    let maxCount = 0;

    for (const issue of result.issues) {
      issuesBySeverity[issue.severity]++;
      issuesByType[issue.type]++;

      if (issuesByType[issue.type] > maxCount) {
        maxCount = issuesByType[issue.type];
        mostCommonIssue = issue.type;
      }
    }

    // Determine risk level
    let riskLevel: 'minimal' | 'low' | 'moderate' | 'high' | 'severe';
    if (result.hallucinationScore < 0.2) riskLevel = 'minimal';
    else if (result.hallucinationScore < 0.4) riskLevel = 'low';
    else if (result.hallucinationScore < 0.6) riskLevel = 'moderate';
    else if (result.hallucinationScore < 0.8) riskLevel = 'high';
    else riskLevel = 'severe';

    return {
      issuesBySeverity,
      issuesByType,
      mostCommonIssue,
      totalIssues: result.issues.length,
      riskLevel,
    };
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  }
}
