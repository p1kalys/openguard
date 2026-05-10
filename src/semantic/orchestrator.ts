/**
 * Semantic validation orchestrator for OpenGuard
 */

import {
  SemanticValidationResponse,
  SemanticValidationConfig,
  ValidationResult,
  ValidationIssue,
  DEFAULT_SEMANTIC_CONFIG
} from './types.js';
import { SemanticRulesEngine } from './rules-engine.js';
import { BuiltinValidators } from './validators.js';
import { NormalizedResponse } from '../types/normalized.js';

/**
 * Semantic validation orchestrator
 */
export class SemanticValidationOrchestrator {
  private rulesEngine: SemanticRulesEngine;
  private config: SemanticValidationConfig;

  constructor(config: Partial<SemanticValidationConfig> = {}) {
    this.config = { ...DEFAULT_SEMANTIC_CONFIG, ...config };
    this.rulesEngine = new SemanticRulesEngine(this.config);
    this.loadBuiltinValidators();
  }

  /**
   * Validate a normalized response
   */
  async validateResponse(
    response: NormalizedResponse,
    config?: Partial<SemanticValidationConfig>
  ): Promise<SemanticValidationResponse> {
    const startTime = Date.now();
    const finalConfig = { ...this.config, ...config };

    // Parse response data
    let data: any;
    try {
      data = this.parseResponseData(response.text);
    } catch (error) {
      return this.createErrorResponse(response, finalConfig, error);
    }

    // Update rules engine config if needed
    if (config) {
      this.rulesEngine.updateConfig(finalConfig);
    }

    // Validate data
    const validationResult = this.validateData(data, finalConfig);

    // Calculate validation result
    const result = this.calculateValidationResult(validationResult.issues, finalConfig);

    // Create response
    const validationResponse: SemanticValidationResponse = {
      originalResponse: response,
      result,
      config: finalConfig,
      summary: this.calculateSummary(result),
    };

    // Update processing time
    result.metadata.processingTime = Date.now() - startTime;

    return validationResponse;
  }

  /**
   * Validate raw data directly
   */
  validateData(
    data: any,
    config?: Partial<SemanticValidationConfig>
  ): ValidationResult {
    const finalConfig = { ...this.config, ...config };

    // Update rules engine config if needed
    if (config) {
      this.rulesEngine.updateConfig(finalConfig);
    }

    const startTime = Date.now();

    // Validate at root level
    let allIssues = this.rulesEngine.validate(data, {
      data,
      fieldPath: 'root',
      config: finalConfig,
    });

    // Validate nested objects if enabled
    if (finalConfig.options.validateNested) {
      const nestedIssues = this.validateNestedObjects(data, finalConfig, 0);
      allIssues.push(...nestedIssues);
    }

    // Apply custom field validators
    const fieldIssues = this.validateFieldConfigs(data, finalConfig);
    allIssues.push(...fieldIssues);

    // Remove duplicates and sort
    const uniqueIssues = this.deduplicateIssues(allIssues);

    // Calculate result
    const result: ValidationResult = {
      passed: this.calculatePassed(uniqueIssues, finalConfig),
      score: this.calculateScore(uniqueIssues, finalConfig),
      issues: uniqueIssues,
      metadata: {
        timestamp: Date.now(),
        processingTime: Date.now() - startTime,
        rulesApplied: this.rulesEngine.getEnabledRules().map(r => r.name),
        structure: this.getDataStructure(data),
      },
    };

    return result;
  }

  /**
   * Add custom validation rule
   */
  addCustomRule(rule: any): void {
    this.rulesEngine.registerRule(rule);
  }

  /**
   * Add field configuration
   */
  addFieldConfig(fieldName: string, config: any): void {
    this.config.fieldConfigs[fieldName] = config;
    this.rulesEngine.updateConfig(this.config);
  }

  /**
   * Enable/disable rule
   */
  setRuleEnabled(ruleName: string, enabled: boolean): void {
    this.rulesEngine.setRuleEnabled(ruleName, enabled);

    if (enabled && !this.config.enabledRules.includes(ruleName)) {
      this.config.enabledRules.push(ruleName);
    } else if (!enabled) {
      this.config.enabledRules = this.config.enabledRules.filter(name => name !== ruleName);
    }
  }

  /**
   * Get available rules
   */
  getAvailableRules(): any[] {
    return this.rulesEngine.getAllRules();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SemanticValidationConfig>): void {
    this.config = { ...this.config, ...config };
    this.rulesEngine.updateConfig(this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): SemanticValidationConfig {
    return { ...this.config };
  }

  /**
   * Parse response data
   */
  private parseResponseData(text: string): any {
    // Try JSON first
    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      try {
        return JSON.parse(text);
      } catch {
        // Continue to other parsing methods
      }
    }

    // Try to extract JSON from text
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // Continue to other parsing methods
      }
    }

    // Return as string if no structured data found
    return { text: text.trim() };
  }

  /**
   * Validate nested objects
   */
  private validateNestedObjects(
    data: any,
    config: SemanticValidationConfig,
    depth: number
  ): ValidationIssue[] {
    if (depth >= config.options.maxDepth) {
      return [];
    }

    const issues: ValidationIssue[] = [];

    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      for (const [key, value] of Object.entries(data)) {
        // Validate nested object
        if (typeof value === 'object' && value !== null) {
          const nestedIssues = this.rulesEngine.validate(value, {
            data,
            fieldPath: `root.${key}`,
            config,
            parent: data,
          });
          issues.push(...nestedIssues);

          // Recursively validate deeper nested objects
          if (config.options.validateNested) {
            const deeperIssues = this.validateNestedObjects(value, config, depth + 1);
            issues.push(...deeperIssues);
          }
        }
      }
    }

    return issues;
  }

  /**
   * Validate field configurations
   */
  private validateFieldConfigs(data: any, config: SemanticValidationConfig): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (typeof data !== 'object' || data === null) {
      return issues;
    }

    for (const [fieldName, fieldValue] of Object.entries(data)) {
      const fieldConfig = config.fieldConfigs[fieldName];
      if (!fieldConfig) continue;

      // Required field validation
      if (fieldConfig.required && (fieldValue === undefined || fieldValue === null || fieldValue === '')) {
        issues.push({
          type: 'logical_inconsistency',
          severity: 'error',
          message: `Required field ${fieldName} is missing or empty`,
          fieldPath: `root.${fieldName}`,
          currentValue: fieldValue,
          rule: 'field_config_validation',
          confidence: 1.0,
        });
        continue;
      }

      // Skip further validation if field is empty and not required
      if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
        continue;
      }

      // Allowed values validation
      if (fieldConfig.allowedValues && !fieldConfig.allowedValues.includes(fieldValue)) {
        issues.push({
          type: 'format_mismatch',
          severity: 'error',
          message: `Value ${fieldValue} not in allowed values: [${fieldConfig.allowedValues.join(', ')}]`,
          fieldPath: `root.${fieldName}`,
          currentValue: fieldValue,
          expectedValue: fieldConfig.allowedValues,
          rule: 'field_config_validation',
          confidence: 1.0,
        });
      }

      // Custom validators
      if (fieldConfig.customValidators) {
        for (const validator of fieldConfig.customValidators) {
          try {
            const customIssues = validator(fieldValue, {
              data,
              fieldPath: `root.${fieldName}`,
              config,
            });
            issues.push(...customIssues);
          } catch (error) {
            issues.push({
              type: 'semantic_anomaly',
              severity: 'error',
              message: `Custom validator failed for ${fieldName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
              fieldPath: `root.${fieldName}`,
              currentValue: fieldValue,
              rule: 'field_config_validation',
              confidence: 1.0,
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Remove duplicate issues
   */
  private deduplicateIssues(issues: ValidationIssue[]): ValidationIssue[] {
    const seen = new Set<string>();
    return issues.filter(issue => {
      const key = `${issue.fieldPath}:${issue.type}:${issue.message}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Calculate if validation passed
   */
  private calculatePassed(issues: ValidationIssue[], config: SemanticValidationConfig): boolean {
    // Check critical issues
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > config.severityThresholds.maxIssues.critical) {
      return false;
    }

    // Check error issues
    const errorIssues = issues.filter(i => i.severity === 'error');
    if (errorIssues.length > config.severityThresholds.maxIssues.error) {
      return false;
    }

    return true;
  }

  /**
   * Calculate validation score
   */
  private calculateScore(issues: ValidationIssue[], config: SemanticValidationConfig): number {
    if (issues.length === 0) {
      return 1.0;
    }

    // Weight issues by severity
    const severityWeights = {
      info: 0.1,
      warning: 0.3,
      error: 0.6,
      critical: 1.0,
    };

    let totalPenalty = 0;
    for (const issue of issues) {
      totalPenalty += severityWeights[issue.severity] * issue.confidence;
    }

    // Normalize score (0-1)
    const maxPenalty = issues.length * 1.0; // Maximum possible penalty
    const score = Math.max(0, 1.0 - (totalPenalty / Math.max(1, maxPenalty)));

    return Math.round(score * 10000) / 10000; // Round to 4 decimal places
  }

  /**
   * Calculate validation result
   */
  private calculateValidationResult(
    issues: ValidationIssue[],
    config: SemanticValidationConfig
  ): ValidationResult {
    const uniqueIssues = this.deduplicateIssues(issues);

    return {
      passed: this.calculatePassed(uniqueIssues, config),
      score: this.calculateScore(uniqueIssues, config),
      issues: uniqueIssues,
      metadata: {
        timestamp: Date.now(),
        processingTime: 0, // Will be set by caller
        rulesApplied: this.rulesEngine.getEnabledRules().map(r => r.name),
        structure: 'unknown', // Will be set by caller
      },
    };
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(result: ValidationResult): any {
    const issuesBySeverity = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    };

    const issuesByType = {
      contradiction: 0,
      impossible_value: 0,
      incomplete_relationship: 0,
      logical_inconsistency: 0,
      range_violation: 0,
      dependency_violation: 0,
      format_mismatch: 0,
      semantic_anomaly: 0,
    };

    const fieldCounts: Record<string, number> = {};

    for (const issue of result.issues) {
      issuesBySeverity[issue.severity]++;
      issuesByType[issue.type]++;

      const field = issue.fieldPath.split('.').pop() || 'root';
      fieldCounts[field] = (fieldCounts[field] || 0) + 1;
    }

    // Find most common issue type
    let mostCommonIssue: keyof typeof issuesByType | null = null;
    let maxCount = 0;
    for (const [type, count] of Object.entries(issuesByType)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonIssue = type as keyof typeof issuesByType;
      }
    }

    // Find problematic fields
    const problematicFields = Object.entries(fieldCounts)
      .map(([field, count]) => ({ field, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      issuesBySeverity,
      issuesByType,
      mostCommonIssue,
      problematicFields,
    };
  }

  /**
   * Get data structure description
   */
  private getDataStructure(data: any): string {
    if (data === null) return 'null';
    if (Array.isArray(data)) return `array[${data.length}]`;
    if (typeof data === 'object') {
      const keys = Object.keys(data);
      return `object{${keys.length}}`;
    }
    return typeof data;
  }

  /**
   * Create error response for parsing failures
   */
  private createErrorResponse(
    response: NormalizedResponse,
    config: SemanticValidationConfig,
    error: any
  ): SemanticValidationResponse {
    const errorResult: ValidationResult = {
      passed: false,
      score: 0,
      issues: [{
        type: 'format_mismatch',
        severity: 'critical',
        message: `Failed to parse response data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        fieldPath: 'root',
        currentValue: response.text,
        rule: 'data_parsing',
        confidence: 1.0,
      }],
      metadata: {
        timestamp: Date.now(),
        processingTime: 0,
        rulesApplied: [],
        structure: 'parse_error',
      },
    };

    return {
      originalResponse: response,
      result: errorResult,
      config,
      summary: {
        issuesBySeverity: { info: 0, warning: 0, error: 0, critical: 1 },
        issuesByType: {
          contradiction: 0, impossible_value: 0, incomplete_relationship: 0,
          logical_inconsistency: 0, range_violation: 0, dependency_violation: 0,
          format_mismatch: 1, semantic_anomaly: 0
        },
        mostCommonIssue: 'format_mismatch',
        problematicFields: [],
      },
    };
  }

  /**
   * Load builtin validators
   */
  private loadBuiltinValidators(): void {
    this.rulesEngine.registerRule(BuiltinValidators.personValidator());
    this.rulesEngine.registerRule(BuiltinValidators.financialValidator());
    this.rulesEngine.registerRule(BuiltinValidators.dateTimeValidator());
    this.rulesEngine.registerRule(BuiltinValidators.geographicValidator());
    this.rulesEngine.registerRule(BuiltinValidators.contactValidator());
  }
}
