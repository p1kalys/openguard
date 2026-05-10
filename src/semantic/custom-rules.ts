/**
 * Custom rule support for OpenGuard semantic validation
 */

import { 
  SemanticValidationRule, 
  ValidationContext, 
  ValidationIssue,
  FieldValidationConfig 
} from './types.js';

/**
 * Custom rule builder utilities
 */
export class CustomRuleBuilder {
  /**
   * Create a simple field validation rule
   */
  static fieldRule(
    name: string,
    fieldName: string,
    validator: (value: any, context: ValidationContext) => ValidationIssue[],
    options: {
      description?: string;
      priority?: number;
      issueType?: string;
      severity?: string;
    } = {}
  ): SemanticValidationRule {
    return {
      name,
      description: options.description || `Validates ${fieldName} field`,
      priority: options.priority || 50,
      issueType: (options.issueType as any) || 'logical_inconsistency',
      defaultSeverity: (options.severity as any) || 'error',
      enabled: true,
      validate: (data: any, context: ValidationContext) => {
        if (typeof data !== 'object' || data === null) {
          return [];
        }
        
        const value = data[fieldName];
        if (value === undefined) {
          return [];
        }

        return validator(value, {
          ...context,
          fieldPath: `${context.fieldPath}.${fieldName}`,
        });
      },
    };
  }

  /**
   * Create a cross-field validation rule
   */
  static crossFieldRule(
    name: string,
    fields: string[],
    validator: (values: Record<string, any>, context: ValidationContext) => ValidationIssue[],
    options: {
      description?: string;
      priority?: number;
      issueType?: string;
      severity?: string;
    } = {}
  ): SemanticValidationRule {
    return {
      name,
      description: options.description || `Validates relationship between ${fields.join(', ')}`,
      priority: options.priority || 60,
      issueType: (options.issueType as any) || 'logical_inconsistency',
      defaultSeverity: (options.severity as any) || 'error',
      enabled: true,
      validate: (data: any, context: ValidationContext) => {
        if (typeof data !== 'object' || data === null) {
          return [];
        }

        const values: Record<string, any> = {};
        for (const field of fields) {
          if (data[field] !== undefined) {
            values[field] = data[field];
          }
        }

        // Only validate if all required fields are present
        if (Object.keys(values).length !== fields.length) {
          return [];
        }

        return validator(values, context);
      },
    };
  }

  /**
   * Create a conditional validation rule
   */
  static conditionalRule(
    name: string,
    condition: (data: any, context: ValidationContext) => boolean,
    validator: (data: any, context: ValidationContext) => ValidationIssue[],
    options: {
      description?: string;
      priority?: number;
      issueType?: string;
      severity?: string;
    } = {}
  ): SemanticValidationRule {
    return {
      name,
      description: options.description || 'Conditional validation rule',
      priority: options.priority || 40,
      issueType: (options.issueType as any) || 'logical_inconsistency',
      defaultSeverity: (options.severity as any) || 'warning',
      enabled: true,
      validate: (data: any, context: ValidationContext) => {
        if (!condition(data, context)) {
          return [];
        }
        return validator(data, context);
      },
    };
  }
}

/**
 * Common custom rule templates
 */
export class RuleTemplates {
  /**
   * Template for enum validation
   */
  static enumRule(
    fieldName: string,
    allowedValues: any[],
    options: { caseSensitive?: boolean } = {}
  ): SemanticValidationRule {
    return CustomRuleBuilder.fieldRule(
      `${fieldName}_enum_validation`,
      fieldName,
      (value: any) => {
        const values = options.caseSensitive 
          ? allowedValues 
          : allowedValues.map(v => typeof v === 'string' ? v.toLowerCase() : v);
        
        const checkValue = options.caseSensitive 
          ? value 
          : typeof value === 'string' ? value.toLowerCase() : value;

        if (!values.includes(checkValue)) {
          return [{
            type: 'format_mismatch',
            severity: 'error',
            message: `Value ${value} not in allowed values: [${allowedValues.join(', ')}]`,
            fieldPath: fieldName,
            currentValue: value,
            expectedValue: allowedValues,
            rule: `${fieldName}_enum_validation`,
            confidence: 1.0,
          }];
        }
        return [];
      },
      {
        description: `Validates ${fieldName} is in allowed values`,
        issueType: 'format_mismatch',
        severity: 'error',
      }
    );
  }

  /**
   * Template for pattern matching
   */
  static patternRule(
    fieldName: string,
    pattern: RegExp,
    options: { message?: string } = {}
  ): SemanticValidationRule {
    return CustomRuleBuilder.fieldRule(
      `${fieldName}_pattern_validation`,
      fieldName,
      (value: any) => {
        if (typeof value !== 'string' || !pattern.test(value)) {
          return [{
            type: 'format_mismatch',
            severity: 'error',
            message: options.message || `Value ${value} does not match required pattern`,
            fieldPath: fieldName,
            currentValue: value,
            expectedValue: pattern.toString(),
            rule: `${fieldName}_pattern_validation`,
            confidence: 0.9,
          }];
        }
        return [];
      },
      {
        description: `Validates ${fieldName} matches pattern ${pattern}`,
        issueType: 'format_mismatch',
        severity: 'error',
      }
    );
  }

  /**
   * Template for range validation with custom logic
   */
  static customRangeRule(
    fieldName: string,
    rangeChecker: (value: number) => { valid: boolean; min?: number; max?: number; message?: string },
    options: { severity?: string } = {}
  ): SemanticValidationRule {
    return CustomRuleBuilder.fieldRule(
      `${fieldName}_custom_range_validation`,
      fieldName,
      (value: any) => {
        if (typeof value !== 'number') {
          return [];
        }

        const result = rangeChecker(value);
        if (!result.valid) {
          return [{
            type: 'range_violation',
            severity: (options.severity as any) || 'error',
            message: result.message || `Value ${value} is outside valid range`,
            fieldPath: fieldName,
            currentValue: value,
            expectedValue: { min: result.min, max: result.max },
            rule: `${fieldName}_custom_range_validation`,
            confidence: 1.0,
          }];
        }
        return [];
      },
      {
        description: `Validates ${fieldName} with custom range logic`,
        issueType: 'range_violation',
        severity: options.severity || 'error',
      }
    );
  }

  /**
   * Template for business logic validation
   */
  static businessRule(
    name: string,
    businessLogic: (data: any, context: ValidationContext) => ValidationIssue[],
    options: {
      description?: string;
      priority?: number;
      severity?: string;
    } = {}
  ): SemanticValidationRule {
    return {
      name,
      description: options.description || `Business rule: ${name}`,
      priority: options.priority || 70,
      issueType: 'logical_inconsistency',
      defaultSeverity: (options.severity as any) || 'error',
      enabled: true,
      validate: businessLogic,
    };
  }
}

/**
 * Example custom rules
 */
export class ExampleCustomRules {
  /**
   * Example: Product inventory rule
   */
  static inventoryRule(): SemanticValidationRule {
    return CustomRuleBuilder.crossFieldRule(
      'inventory_validation',
      ['stock', 'reserved', 'available'],
      (values: Record<string, any>) => {
        const { stock, reserved, available } = values;
        const calculatedAvailable = stock - reserved;
        
        if (calculatedAvailable !== available) {
          return [{
            type: 'contradiction',
            severity: 'error',
            message: `Available stock ${available} doesn't match calculated ${calculatedAvailable} (stock ${stock} - reserved ${reserved})`,
            fieldPath: '',
            currentValue: { stock, reserved, available },
            relatedFields: ['stock', 'reserved', 'available'],
            rule: 'inventory_validation',
            confidence: 0.95,
          }];
        }
        
        if (available < 0) {
          return [{
            type: 'impossible_value',
            severity: 'critical',
            message: `Available stock cannot be negative: ${available}`,
            fieldPath: 'available',
            currentValue: available,
            rule: 'inventory_validation',
            confidence: 1.0,
          }];
        }
        
        return [];
      },
      {
        description: 'Validates inventory calculations',
        priority: 80,
        severity: 'error',
      }
    );
  }

  /**
   * Example: Order total validation
   */
  static orderTotalRule(): SemanticValidationRule {
    return CustomRuleBuilder.crossFieldRule(
      'order_total_validation',
      ['items', 'subtotal', 'tax', 'shipping', 'total'],
      (values: Record<string, any>) => {
        const { items, subtotal, tax, shipping, total } = values;
        
        // Calculate expected total
        const calculatedSubtotal = items?.reduce((sum: number, item: any) => 
          sum + (item.price * item.quantity), 0) || 0;
        
        const calculatedTotal = calculatedSubtotal + (tax || 0) + (shipping || 0);
        
        if (Math.abs(calculatedSubtotal - subtotal) > 0.01) {
          return [{
            type: 'contradiction',
            severity: 'error',
            message: `Subtotal ${subtotal} doesn't match calculated ${calculatedSubtotal}`,
            fieldPath: 'subtotal',
            currentValue: subtotal,
            expectedValue: calculatedSubtotal,
            rule: 'order_total_validation',
            confidence: 0.9,
          }];
        }
        
        if (Math.abs(calculatedTotal - total) > 0.01) {
          return [{
            type: 'contradiction',
            severity: 'error',
            message: `Total ${total} doesn't match calculated ${calculatedTotal}`,
            fieldPath: 'total',
            currentValue: total,
            expectedValue: calculatedTotal,
            rule: 'order_total_validation',
            confidence: 0.9,
          }];
        }
        
        return [];
      },
      {
        description: 'Validates order total calculations',
        priority: 85,
        severity: 'error',
      }
    );
  }

  /**
   * Example: Business hours validation
   */
  static businessHoursRule(): SemanticValidationRule {
    return CustomRuleBuilder.crossFieldRule(
      'business_hours_validation',
      ['openingTime', 'closingTime', 'isOpen'],
      (values: Record<string, any>) => {
        const { openingTime, closingTime, isOpen } = values;
        
        // Parse times (assuming HH:MM format)
        const parseTime = (time: string) => {
          const [hours, minutes] = time.split(':').map(Number);
          return hours * 60 + minutes;
        };
        
        const opening = parseTime(openingTime);
        const closing = parseTime(closingTime);
        const now = new Date();
        const current = now.getHours() * 60 + now.getMinutes();
        
        const shouldBeOpen = current >= opening && current <= closing;
        
        if (shouldBeOpen !== isOpen) {
          return [{
            type: 'logical_inconsistency',
            severity: 'warning',
            message: `isOpen=${isOpen} but current time ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')} ${shouldBeOpen ? 'should be open' : 'should be closed'} (hours: ${openingTime}-${closingTime})`,
            fieldPath: 'isOpen',
            currentValue: isOpen,
            relatedFields: ['openingTime', 'closingTime'],
            rule: 'business_hours_validation',
            confidence: 0.8,
          }];
        }
        
        return [];
      },
      {
        description: 'Validates business hours consistency',
        priority: 60,
        severity: 'warning',
      }
    );
  }
}
