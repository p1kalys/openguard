/**
 * Core semantic validation rules engine for OpenGuard
 */

import {
  SemanticValidationRule,
  ValidationContext,
  ValidationIssue,
  SemanticValidationConfig
} from './types.js';

/**
 * Rules engine for semantic validation
 */
export class SemanticRulesEngine {
  private rules: Map<string, SemanticValidationRule> = new Map();
  private config: SemanticValidationConfig;

  constructor(config: SemanticValidationConfig) {
    this.config = config;
    this.loadBuiltinRules();
  }

  /**
   * Validate data using configured rules
   */
  validate(data: any, context: Partial<ValidationContext> = {}): ValidationIssue[] {
    const allIssues: ValidationIssue[] = [];
    const fullContext: ValidationContext = {
      data,
      fieldPath: context.fieldPath || 'root',
      parent: context.parent,
      config: this.config,
      schema: context.schema,
    };

    // Get enabled rules
    const enabledRules = this.getEnabledRules();

    // Apply each rule
    for (const rule of enabledRules) {
      try {
        const issues = rule.validate(data, fullContext);
        allIssues.push(...issues);

        // Stop on critical error if configured
        if (this.config.options.stopOnCritical &&
          issues.some(issue => issue.severity === 'critical')) {
          break;
        }
      } catch (error) {
        // Create error issue for rule failure
        const errorIssue: ValidationIssue = {
          type: 'semantic_anomaly',
          severity: 'error',
          message: `Rule '${rule.name}' failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          fieldPath: fullContext.fieldPath,
          currentValue: data,
          rule: rule.name,
          confidence: 1.0,
        };
        allIssues.push(errorIssue);
      }
    }

    return allIssues;
  }

  /**
   * Register a custom rule
   */
  registerRule(rule: SemanticValidationRule): void {
    this.rules.set(rule.name, rule);
  }

  /**
   * Remove a rule
   */
  removeRule(ruleName: string): boolean {
    return this.rules.delete(ruleName);
  }

  /**
   * Get all registered rules
   */
  getAllRules(): SemanticValidationRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get enabled rules based on configuration
   */
  getEnabledRules(): SemanticValidationRule[] {
    return this.getAllRules()
      .filter(rule => rule.enabled && this.config.enabledRules.includes(rule.name))
      .sort((a, b) => b.priority - a.priority); // Higher priority first
  }

  /**
   * Get rule by name
   */
  getRule(name: string): SemanticValidationRule | undefined {
    return this.rules.get(name);
  }

  /**
   * Enable/disable a rule
   */
  setRuleEnabled(name: string, enabled: boolean): void {
    const rule = this.rules.get(name);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SemanticValidationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Load built-in validation rules
   */
  private loadBuiltinRules(): void {
    // Contradiction detection rule
    this.registerRule({
      name: 'contradiction_detection',
      description: 'Detects contradictory values in related fields',
      priority: 100,
      issueType: 'contradiction',
      defaultSeverity: 'error',
      enabled: true,
      validate: this.validateContradictions.bind(this),
    });

    // Range validation rule
    this.registerRule({
      name: 'range_validation',
      description: 'Validates numeric values against defined ranges',
      priority: 90,
      issueType: 'range_violation',
      defaultSeverity: 'error',
      enabled: true,
      validate: this.validateRanges.bind(this),
    });

    // Dependency validation rule
    this.registerRule({
      name: 'dependency_validation',
      description: 'Validates field dependencies',
      priority: 85,
      issueType: 'dependency_violation',
      defaultSeverity: 'warning',
      enabled: true,
      validate: this.validateDependencies.bind(this),
    });

    // Type consistency rule
    this.registerRule({
      name: 'type_consistency',
      description: 'Validates data type consistency',
      priority: 80,
      issueType: 'format_mismatch',
      defaultSeverity: 'error',
      enabled: true,
      validate: this.validateTypes.bind(this),
    });

    // Logical relationships rule
    this.registerRule({
      name: 'logical_relationships',
      description: 'Validates logical relationships between fields',
      priority: 75,
      issueType: 'logical_inconsistency',
      defaultSeverity: 'warning',
      enabled: true,
      validate: this.validateLogicalRelationships.bind(this),
    });

    // Impossible values rule
    this.registerRule({
      name: 'impossible_values',
      description: 'Detects impossible or unrealistic values',
      priority: 95,
      issueType: 'impossible_value',
      defaultSeverity: 'critical',
      enabled: true,
      validate: this.validateImpossibleValues.bind(this),
    });
  }

  /**
   * Validate contradictions between fields
   */
  private validateContradictions(data: any, context: ValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (typeof data !== 'object' || data === null) {
      return issues;
    }

    // Common contradiction patterns
    const contradictions = [
      {
        condition: (obj: any) => obj.age !== undefined && obj.birthYear !== undefined,
        check: (obj: any) => {
          const currentYear = new Date().getFullYear();
          const calculatedAge = currentYear - obj.birthYear;
          return Math.abs(calculatedAge - obj.age) > 1;
        },
        message: (obj: any) => `Age ${obj.age} contradicts birth year ${obj.birthYear}`,
        fields: ['age', 'birthYear'],
      },
      {
        condition: (obj: any) => obj.startDate !== undefined && obj.endDate !== undefined,
        check: (obj: any) => new Date(obj.startDate) > new Date(obj.endDate),
        message: (obj: any) => `Start date ${obj.startDate} is after end date ${obj.endDate}`,
        fields: ['startDate', 'endDate'],
      },
      {
        condition: (obj: any) => obj.isAdult !== undefined && obj.age !== undefined,
        check: (obj: any) => obj.isAdult && obj.age < 18,
        message: (obj: any) => `isAdult=true but age=${obj.age} is less than 18`,
        fields: ['isAdult', 'age'],
      },
      {
        condition: (obj: any) => obj.isActive !== undefined && obj.deactivationDate !== undefined,
        check: (obj: any) => obj.isActive && obj.deactivationDate,
        message: (obj: any) => `isActive=true but deactivationDate is set`,
        fields: ['isActive', 'deactivationDate'],
      },
    ];

    for (const contradiction of contradictions) {
      if (contradiction.condition(data)) {
        if (contradiction.check(data)) {
          issues.push({
            type: 'contradiction',
            severity: 'error',
            message: contradiction.message(data),
            fieldPath: context.fieldPath,
            currentValue: data,
            relatedFields: contradiction.fields,
            rule: 'contradiction_detection',
            confidence: 0.9,
          });
        }
      }
    }

    return issues;
  }

  /**
   * Validate numeric ranges
   */
  private validateRanges(data: any, context: ValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (typeof data !== 'object' || data === null) {
      return issues;
    }

    for (const [fieldName, fieldValue] of Object.entries(data)) {
      const fieldConfig = this.config.fieldConfigs[fieldName];
      if (!fieldConfig || !fieldConfig.range || typeof fieldValue !== 'number') {
        continue;
      }

      const { min, max } = fieldConfig.range;
      if (min !== undefined && fieldValue < min) {
        issues.push({
          type: 'range_violation',
          severity: 'error',
          message: `Value ${fieldValue} is below minimum ${min}`,
          fieldPath: `${context.fieldPath}.${fieldName}`,
          currentValue: fieldValue,
          expectedValue: { min, max },
          rule: 'range_validation',
          confidence: 1.0,
        });
      }

      if (max !== undefined && fieldValue > max) {
        issues.push({
          type: 'range_violation',
          severity: 'error',
          message: `Value ${fieldValue} is above maximum ${max}`,
          fieldPath: `${context.fieldPath}.${fieldName}`,
          currentValue: fieldValue,
          expectedValue: { min, max },
          rule: 'range_validation',
          confidence: 1.0,
        });
      }
    }

    return issues;
  }

  /**
   * Validate field dependencies
   */
  private validateDependencies(data: any, context: ValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (typeof data !== 'object' || data === null) {
      return issues;
    }

    for (const [fieldName, fieldValue] of Object.entries(data)) {
      const fieldConfig = this.config.fieldConfigs[fieldName];
      if (!fieldConfig?.dependencies) {
        continue;
      }

      for (const dependency of fieldConfig.dependencies) {
        const dependentValue = data[dependency.field];
        if (dependentValue === undefined) continue;

        if (!dependency.condition(fieldValue, dependentValue)) {
          issues.push({
            type: 'dependency_violation',
            severity: 'warning',
            message: dependency.message,
            fieldPath: `${context.fieldPath}.${fieldName}`,
            currentValue: fieldValue,
            relatedFields: [dependency.field],
            rule: 'dependency_validation',
            confidence: 0.8,
          });
        }
      }
    }

    return issues;
  }

  /**
   * Validate data types
   */
  private validateTypes(data: any, context: ValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (typeof data !== 'object' || data === null) {
      return issues;
    }

    for (const [fieldName, fieldValue] of Object.entries(data)) {
      const fieldConfig = this.config.fieldConfigs[fieldName];
      if (!fieldConfig?.type) continue;

      let isValidType = false;
      switch (fieldConfig.type) {
        case 'string':
          isValidType = typeof fieldValue === 'string';
          break;
        case 'number':
          isValidType = typeof fieldValue === 'number' && !isNaN(fieldValue);
          break;
        case 'boolean':
          isValidType = typeof fieldValue === 'boolean';
          break;
        case 'array':
          isValidType = Array.isArray(fieldValue);
          break;
        case 'object':
          isValidType = typeof fieldValue === 'object' && fieldValue !== null && !Array.isArray(fieldValue);
          break;
        case 'date':
          isValidType = typeof fieldValue === 'string' && !isNaN(Date.parse(fieldValue));
          break;
      }

      if (!isValidType) {
        issues.push({
          type: 'format_mismatch',
          severity: 'error',
          message: `Expected ${fieldConfig.type}, got ${typeof fieldValue}`,
          fieldPath: `${context.fieldPath}.${fieldName}`,
          currentValue: fieldValue,
          expectedValue: fieldConfig.type,
          rule: 'type_consistency',
          confidence: 1.0,
        });
      }
    }

    return issues;
  }

  /**
   * Validate logical relationships
   */
  private validateLogicalRelationships(data: any, context: ValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (typeof data !== 'object' || data === null) {
      return issues;
    }

    // Common logical relationship validations
    const relationships = [
      {
        condition: (obj: any) => obj.percentage !== undefined,
        check: (obj: any) => obj.percentage < 0 || obj.percentage > 100,
        message: (obj: any) => `Percentage ${obj.percentage} must be between 0 and 100`,
        field: 'percentage',
      },
      {
        condition: (obj: any) => obj.probability !== undefined,
        check: (obj: any) => obj.probability < 0 || obj.probability > 1,
        message: (obj: any) => `Probability ${obj.probability} must be between 0 and 1`,
        field: 'probability',
      },
      {
        condition: (obj: any) => obj.rating !== undefined,
        check: (obj: any) => obj.rating < 1 || obj.rating > 5,
        message: (obj: any) => `Rating ${obj.rating} must be between 1 and 5`,
        field: 'rating',
      },
    ];

    for (const relationship of relationships) {
      if (relationship.condition(data)) {
        if (relationship.check(data)) {
          issues.push({
            type: 'logical_inconsistency',
            severity: 'warning',
            message: relationship.message(data),
            fieldPath: `${context.fieldPath}.${relationship.field}`,
            currentValue: data[relationship.field],
            rule: 'logical_relationships',
            confidence: 0.85,
          });
        }
      }
    }

    return issues;
  }

  /**
   * Validate impossible values
   */
  private validateImpossibleValues(data: any, context: ValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (typeof data !== 'object' || data === null) {
      return issues;
    }

    // Impossible value patterns
    const impossiblePatterns = [
      {
        field: 'age',
        check: (value: any) => value < 0 || value > 150,
        message: (value: any) => `Age ${value} is biologically impossible`,
      },
      {
        field: 'temperature',
        check: (value: any) => value < -273.15, // Absolute zero
        message: (value: any) => `Temperature ${value}°C is below absolute zero`,
      },
      {
        field: 'speed',
        check: (value: any) => value > 299792458, // Speed of light
        message: (value: any) => `Speed ${value} m/s exceeds speed of light`,
      },
      {
        field: 'percentage',
        check: (value: any) => value < 0 || value > 100,
        message: (value: any) => `Percentage ${value}% is impossible`,
      },
      {
        field: 'probability',
        check: (value: any) => value < 0 || value > 1,
        message: (value: any) => `Probability ${value} is outside valid range [0,1]`,
      },
    ];

    for (const pattern of impossiblePatterns) {
      const value = data[pattern.field];
      if (value !== undefined && typeof value === 'number' && pattern.check(value)) {
        issues.push({
          type: 'impossible_value',
          severity: 'critical',
          message: pattern.message(value),
          fieldPath: `${context.fieldPath}.${pattern.field}`,
          currentValue: value,
          rule: 'impossible_values',
          confidence: 0.95,
        });
      }
    }

    return issues;
  }
}
