/**
 * Built-in semantic validators for OpenGuard
 */

import { 
  SemanticValidationRule, 
  ValidationContext, 
  ValidationIssue,
  FieldValidationConfig 
} from './types.js';

/**
 * Collection of built-in semantic validators
 */
export class BuiltinValidators {
  /**
   * Person data validator - validates age, birth year, etc.
   */
  static personValidator(): SemanticValidationRule {
    return {
      name: 'person_data_validation',
      description: 'Validates person-related data for consistency',
      priority: 90,
      issueType: 'logical_inconsistency',
      defaultSeverity: 'error',
      enabled: true,
      validate: (data: any, context: ValidationContext): ValidationIssue[] => {
        const issues: ValidationIssue[] = [];

        if (typeof data !== 'object' || data === null) {
          return issues;
        }

        // Age validation
        if (data.age !== undefined) {
          if (typeof data.age !== 'number' || data.age < 0 || data.age > 150) {
            issues.push({
              type: 'impossible_value',
              severity: 'critical',
              message: `Age ${data.age} is biologically impossible`,
              fieldPath: `${context.fieldPath}.age`,
              currentValue: data.age,
              rule: 'person_data_validation',
              confidence: 0.95,
            });
          }
        }

        // Birth year validation
        if (data.birthYear !== undefined) {
          const currentYear = new Date().getFullYear();
          if (typeof data.birthYear !== 'number' || 
              data.birthYear < 1800 || 
              data.birthYear > currentYear) {
            issues.push({
              type: 'impossible_value',
              severity: 'error',
              message: `Birth year ${data.birthYear} is unrealistic`,
              fieldPath: `${context.fieldPath}.birthYear`,
              currentValue: data.birthYear,
              rule: 'person_data_validation',
              confidence: 0.8,
            });
          }
        }

        // Age vs birth year consistency
        if (data.age !== undefined && data.birthYear !== undefined) {
          const currentYear = new Date().getFullYear();
          const calculatedAge = currentYear - data.birthYear;
          if (Math.abs(calculatedAge - data.age) > 2) {
            issues.push({
              type: 'contradiction',
              severity: 'error',
              message: `Age ${data.age} contradicts birth year ${data.birthYear} (should be ~${calculatedAge})`,
              fieldPath: context.fieldPath,
              currentValue: { age: data.age, birthYear: data.birthYear },
              relatedFields: ['age', 'birthYear'],
              rule: 'person_data_validation',
              confidence: 0.9,
            });
          }
        }

        return issues;
      },
    };
  }

  /**
   * Financial data validator - validates monetary values, percentages, etc.
   */
  static financialValidator(): SemanticValidationRule {
    return {
      name: 'financial_data_validation',
      description: 'Validates financial data for consistency and realism',
      priority: 95,
      issueType: 'logical_inconsistency',
      defaultSeverity: 'error',
      enabled: true,
      validate: (data: any, context: ValidationContext): ValidationIssue[] => {
        const issues: ValidationIssue[] = [];

        if (typeof data !== 'object' || data === null) {
          return issues;
        }

        // Percentage validation
        if (data.percentage !== undefined) {
          if (typeof data.percentage !== 'number' || 
              data.percentage < 0 || 
              data.percentage > 100) {
            issues.push({
              type: 'range_violation',
              severity: 'error',
              message: `Percentage ${data.percentage}% must be between 0 and 100`,
              fieldPath: `${context.fieldPath}.percentage`,
              currentValue: data.percentage,
              expectedValue: { min: 0, max: 100 },
              rule: 'financial_data_validation',
              confidence: 1.0,
            });
          }
        }

        // Monetary value validation
        const monetaryFields = ['price', 'cost', 'amount', 'salary', 'revenue'];
        for (const field of monetaryFields) {
          if (data[field] !== undefined) {
            if (typeof data[field] !== 'number' || data[field] < 0) {
              issues.push({
                type: 'impossible_value',
                severity: 'error',
                message: `${field} ${data[field]} cannot be negative`,
                fieldPath: `${context.fieldPath}.${field}`,
                currentValue: data[field],
                rule: 'financial_data_validation',
                confidence: 0.9,
              });
            }
          }
        }

        // Discount validation
        if (data.discount !== undefined && data.originalPrice !== undefined) {
          if (data.discount > data.originalPrice) {
            issues.push({
              type: 'logical_inconsistency',
              severity: 'error',
              message: `Discount ${data.discount} cannot exceed original price ${data.originalPrice}`,
              fieldPath: context.fieldPath,
              currentValue: { discount: data.discount, originalPrice: data.originalPrice },
              relatedFields: ['discount', 'originalPrice'],
              rule: 'financial_data_validation',
              confidence: 0.95,
            });
          }
        }

        return issues;
      },
    };
  }

  /**
   * Date/time validator - validates temporal consistency
   */
  static dateTimeValidator(): SemanticValidationRule {
    return {
      name: 'datetime_validation',
      description: 'Validates date and time consistency',
      priority: 85,
      issueType: 'logical_inconsistency',
      defaultSeverity: 'error',
      enabled: true,
      validate: (data: any, context: ValidationContext): ValidationIssue[] => {
        const issues: ValidationIssue[] = [];

        if (typeof data !== 'object' || data === null) {
          return issues;
        }

        // Date parsing and validation
        const dateFields = ['startDate', 'endDate', 'createdAt', 'updatedAt', 'date'];
        const parsedDates: Record<string, Date> = {};

        for (const field of dateFields) {
          if (data[field] !== undefined) {
            const parsed = new Date(data[field]);
            if (isNaN(parsed.getTime())) {
              issues.push({
                type: 'format_mismatch',
                severity: 'error',
                message: `Invalid date format for ${field}: ${data[field]}`,
                fieldPath: `${context.fieldPath}.${field}`,
                currentValue: data[field],
                rule: 'datetime_validation',
                confidence: 1.0,
              });
            } else {
              parsedDates[field] = parsed;
            }
          }
        }

        // Start date vs end date
        if (parsedDates.startDate && parsedDates.endDate) {
          if (parsedDates.startDate > parsedDates.endDate) {
            issues.push({
              type: 'contradiction',
              severity: 'error',
              message: `Start date ${data.startDate} is after end date ${data.endDate}`,
              fieldPath: context.fieldPath,
              currentValue: { startDate: data.startDate, endDate: data.endDate },
              relatedFields: ['startDate', 'endDate'],
              rule: 'datetime_validation',
              confidence: 0.95,
            });
          }
        }

        // Created vs updated timestamps
        if (parsedDates.createdAt && parsedDates.updatedAt) {
          if (parsedDates.createdAt > parsedDates.updatedAt) {
            issues.push({
              type: 'contradiction',
              severity: 'error',
              message: `Created date ${data.createdAt} is after updated date ${data.updatedAt}`,
              fieldPath: context.fieldPath,
              currentValue: { createdAt: data.createdAt, updatedAt: data.updatedAt },
              relatedFields: ['createdAt', 'updatedAt'],
              rule: 'datetime_validation',
              confidence: 0.9,
            });
          }
        }

        // Future date validation
        const now = new Date();
        for (const [field, date] of Object.entries(parsedDates)) {
          if (date > now && !['endDate', 'targetDate', 'plannedDate'].includes(field)) {
            issues.push({
              type: 'logical_inconsistency',
              severity: 'warning',
              message: `${field} ${data[field]} is in the future`,
              fieldPath: `${context.fieldPath}.${field}`,
              currentValue: data[field],
              rule: 'datetime_validation',
              confidence: 0.7,
            });
          }
        }

        return issues;
      },
    };
  }

  /**
   * Geographic data validator - validates locations, coordinates, etc.
   */
  static geographicValidator(): SemanticValidationRule {
    return {
      name: 'geographic_validation',
      description: 'Validates geographic data for consistency',
      priority: 80,
      issueType: 'logical_inconsistency',
      defaultSeverity: 'error',
      enabled: true,
      validate: (data: any, context: ValidationContext): ValidationIssue[] => {
        const issues: ValidationIssue[] = [];

        if (typeof data !== 'object' || data === null) {
          return issues;
        }

        // Latitude validation
        if (data.latitude !== undefined) {
          if (typeof data.latitude !== 'number' || 
              data.latitude < -90 || 
              data.latitude > 90) {
            issues.push({
              type: 'range_violation',
              severity: 'error',
              message: `Latitude ${data.latitude} must be between -90 and 90`,
              fieldPath: `${context.fieldPath}.latitude`,
              currentValue: data.latitude,
              expectedValue: { min: -90, max: 90 },
              rule: 'geographic_validation',
              confidence: 1.0,
            });
          }
        }

        // Longitude validation
        if (data.longitude !== undefined) {
          if (typeof data.longitude !== 'number' || 
              data.longitude < -180 || 
              data.longitude > 180) {
            issues.push({
              type: 'range_violation',
              severity: 'error',
              message: `Longitude ${data.longitude} must be between -180 and 180`,
              fieldPath: `${context.fieldPath}.longitude`,
              currentValue: data.longitude,
              expectedValue: { min: -180, max: 180 },
              rule: 'geographic_validation',
              confidence: 1.0,
            });
          }
        }

        // Altitude validation (reasonable range)
        if (data.altitude !== undefined) {
          if (typeof data.altitude !== 'number' || 
              data.altitude < -500 || 
              data.altitude > 8848) { // Dead sea to Everest
            issues.push({
              type: 'range_violation',
              severity: 'warning',
              message: `Altitude ${data.altitude}m is outside typical range [-500, 8848]`,
              fieldPath: `${context.fieldPath}.altitude`,
              currentValue: data.altitude,
              expectedValue: { min: -500, max: 8848 },
              rule: 'geographic_validation',
              confidence: 0.8,
            });
          }
        }

        return issues;
      },
    };
  }

  /**
   * Contact information validator - validates emails, phones, etc.
   */
  static contactValidator(): SemanticValidationRule {
    return {
      name: 'contact_validation',
      description: 'Validates contact information format',
      priority: 70,
      issueType: 'format_mismatch',
      defaultSeverity: 'error',
      enabled: true,
      validate: (data: any, context: ValidationContext): ValidationIssue[] => {
        const issues: ValidationIssue[] = [];

        if (typeof data !== 'object' || data === null) {
          return issues;
        }

        // Email validation
        if (data.email !== undefined) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (typeof data.email !== 'string' || !emailRegex.test(data.email)) {
            issues.push({
              type: 'format_mismatch',
              severity: 'error',
              message: `Invalid email format: ${data.email}`,
              fieldPath: `${context.fieldPath}.email`,
              currentValue: data.email,
              rule: 'contact_validation',
              confidence: 0.9,
            });
          }
        }

        // Phone validation (basic)
        if (data.phone !== undefined) {
          const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
          if (typeof data.phone !== 'string' || !phoneRegex.test(data.phone)) {
            issues.push({
              type: 'format_mismatch',
              severity: 'warning',
              message: `Invalid phone format: ${data.phone}`,
              fieldPath: `${context.fieldPath}.phone`,
              currentValue: data.phone,
              rule: 'contact_validation',
              confidence: 0.7,
            });
          }
        }

        // URL validation
        if (data.website !== undefined) {
          try {
            new URL(data.website);
          } catch {
            issues.push({
              type: 'format_mismatch',
              severity: 'error',
              message: `Invalid URL format: ${data.website}`,
              fieldPath: `${context.fieldPath}.website`,
              currentValue: data.website,
              rule: 'contact_validation',
              confidence: 0.9,
            });
          }
        }

        return issues;
      },
    };
  }
}
