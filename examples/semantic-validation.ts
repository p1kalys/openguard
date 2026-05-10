/**
 * Example usage of OpenGuard semantic validation system
 */

import { 
  quickSemanticValidate,
  createSemanticValidator,
  BuiltinValidators,
  CustomRuleBuilder,
  RuleTemplates,
  ExampleCustomRules,
  SemanticValidationConfig 
} from '../src/semantic/index.js';
import { NormalizedResponse } from '../src/types/normalized.js';

// Example data for testing semantic validation
const exampleResponses: NormalizedResponse[] = [
  {
    text: JSON.stringify({
      name: "John Doe",
      age: 25,
      birthYear: 1998,
      email: "john.doe@example.com",
      isActive: true,
      deactivationDate: null,
    }),
    provider: 'openai',
    model: 'gpt-4',
    finishReason: 'stop',
  },
  {
    text: JSON.stringify({
      name: "Jane Smith",
      age: 30,
      birthYear: 1995, // Contradiction: 2024 - 1995 = 29, not 30
      email: "invalid-email", // Invalid format
      percentage: 150, // Impossible percentage
      startDate: "2024-01-01",
      endDate: "2023-12-31", // Contradiction: end before start
    }),
    provider: 'openai',
    model: 'gpt-4',
    finishReason: 'stop',
  },
  {
    text: JSON.stringify({
      product: "Laptop",
      price: -100, // Impossible negative price
      discount: 1200, // Discount exceeds price
      originalPrice: 1000,
      stock: 50,
      reserved: 30,
      available: 25, // Should be 20 (50-30)
      rating: 6, // Invalid rating (should be 1-5)
      coordinates: {
        latitude: 95, // Invalid latitude (>90)
        longitude: 200, // Invalid longitude (>180)
        altitude: 10000, // Unreasonable altitude
      },
    }),
    provider: 'openai',
    model: 'gpt-4',
    finishReason: 'stop',
  },
  {
    text: JSON.stringify({
      orderId: "ORD-12345",
      items: [
        { name: "Product A", price: 100, quantity: 2 },
        { name: "Product B", price: 50, quantity: 1 },
      ],
      subtotal: 240, // Should be 250 (100*2 + 50*1)
      tax: 20,
      shipping: 15,
      total: 275, // Should be 275 (240+20+15) - this one is correct
    }),
    provider: 'openai',
    model: 'gpt-4',
    finishReason: 'stop',
  },
];

async function demonstrateSemanticValidation() {
  console.log('=== OpenGuard Semantic Validation Examples ===\n');

  // Example 1: Basic validation with default configuration
  console.log('1. Basic Semantic Validation:');
  console.log('=' .repeat(50));

  try {
    const result = await quickSemanticValidate(exampleResponses[0]);
    
    console.log(`✅ Validation completed`);
    console.log(`Overall Score: ${result.result.score.toFixed(3)} (${result.result.passed ? 'PASS' : 'FAIL'})`);
    console.log(`Issues Found: ${result.result.issues.length}`);
    console.log(`Processing Time: ${result.result.metadata.processingTime}ms`);
    
    if (result.result.issues.length > 0) {
      console.log('\n🚨 Issues:');
      result.result.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.message}`);
        console.log(`     Field: ${issue.fieldPath}`);
        console.log(`     Rule: ${issue.rule}`);
        console.log(`     Confidence: ${(issue.confidence * 100).toFixed(1)}%`);
      });
    }
  } catch (error) {
    console.log(`❌ Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('\n' + '=' .repeat(50) + '\n');

  // Example 2: Validation with contradictions and impossible values
  console.log('2. Validation with Contradictions and Impossible Values:');
  console.log('=' .repeat(50));

  try {
    const result = await quickSemanticValidate(exampleResponses[1]);
    
    console.log(`Overall Score: ${result.result.score.toFixed(3)} (${result.result.passed ? 'PASS' : 'FAIL'})`);
    console.log(`Issues Found: ${result.result.issues.length}`);
    
    if (result.result.issues.length > 0) {
      console.log('\n🚨 Issues by type:');
      const issuesByType = result.summary.issuesByType;
      Object.entries(issuesByType).forEach(([type, count]) => {
        if (count > 0) {
          console.log(`  ${type}: ${count}`);
        }
      });

      console.log('\n🚨 Issues by severity:');
      const issuesBySeverity = result.summary.issuesBySeverity;
      Object.entries(issuesBySeverity).forEach(([severity, count]) => {
        if (count > 0) {
          console.log(`  ${severity}: ${count}`);
        }
      });
    }
  } catch (error) {
    console.log(`❌ Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('\n' + '=' .repeat(50) + '\n');

  // Example 3: Advanced validation with custom configuration
  console.log('3. Advanced Validation with Custom Configuration:');
  console.log('=' .repeat(50));

  const customConfig: Partial<SemanticValidationConfig> = {
    enabledRules: [
      'contradiction_detection',
      'impossible_values',
      'range_validation',
      'person_data_validation',
    ],
    fieldConfigs: {
      age: {
        type: 'number',
        range: { min: 0, max: 120 },
        required: true,
      },
      email: {
        type: 'string',
        required: true,
        customValidators: [
          (value: any) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
              return [{
                type: 'format_mismatch',
                severity: 'error',
                message: `Invalid email format: ${value}`,
                fieldPath: 'email',
                currentValue: value,
                rule: 'custom_email_validator',
                confidence: 0.9,
              }];
            }
            return [];
          },
        ],
      },
    },
    options: {
      validateNested: true,
      maxDepth: 3,
      collectAllIssues: true,
    },
  };

  try {
    const validator = createSemanticValidator(customConfig);
    const result = await validator.validateResponse(exampleResponses[2]);
    
    console.log(`Overall Score: ${result.result.score.toFixed(3)} (${result.result.passed ? 'PASS' : 'FAIL'})`);
    console.log(`Rules Applied: ${result.result.metadata.rulesApplied.join(', ')}`);
    console.log(`Data Structure: ${result.result.metadata.structure}`);
    
    if (result.summary.problematicFields.length > 0) {
      console.log('\n🚨 Most problematic fields:');
      result.summary.problematicFields.forEach(({ field, count }) => {
        console.log(`  ${field}: ${count} issues`);
      });
    }
  } catch (error) {
    console.log(`❌ Advanced validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('\n' + '=' .repeat(50) + '\n');

  // Example 4: Custom business rules
  console.log('4. Custom Business Rules Validation:');
  console.log('=' .repeat(50));

  try {
    const validator = createSemanticValidator();
    
    // Add custom business rules
    validator.addCustomRule(ExampleCustomRules.inventoryRule());
    validator.addCustomRule(ExampleCustomRules.orderTotalRule());
    validator.addCustomRule(ExampleCustomRules.businessHoursRule());
    
    const result = await validator.validateResponse(exampleResponses[3]);
    
    console.log(`Overall Score: ${result.result.score.toFixed(3)} (${result.result.passed ? 'PASS' : 'FAIL'})`);
    console.log(`Issues Found: ${result.result.issues.length}`);
    
    if (result.result.issues.length > 0) {
      console.log('\n🚨 Business rule violations:');
      result.result.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.message}`);
        console.log(`     Rule: ${issue.rule}`);
        if (issue.relatedFields && issue.relatedFields.length > 0) {
          console.log(`     Related fields: ${issue.relatedFields.join(', ')}`);
        }
      });
    }
  } catch (error) {
    console.log(`❌ Business rules validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('\n' + '=' .repeat(50) + '\n');

  // Example 5: Custom rule templates
  console.log('5. Custom Rule Templates:');
  console.log('=' .repeat(50));

  try {
    const validator = createSemanticValidator();
    
    // Add enum validation rule
    validator.addCustomRule(RuleTemplates.enumRule('status', ['active', 'inactive', 'pending']));
    
    // Add pattern validation rule
    validator.addCustomRule(RuleTemplates.patternRule('phone', /^\+?[\d\s\-\(\)]+$/));
    
    // Add custom range rule
    validator.addCustomRule(RuleTemplates.customRangeRule('score', 
      (value: number) => ({
        valid: value >= 0 && value <= 100,
        min: 0,
        max: 100,
        message: `Score ${value} must be between 0 and 100`
      })
    ));
    
    const testData = {
      name: "Test User",
      status: "unknown", // Invalid enum value
      phone: "invalid-phone", // Invalid pattern
      score: 150, // Invalid range
    };
    
    const result = validator.validateData(testData);
    
    console.log(`Overall Score: ${result.score.toFixed(3)} (${result.passed ? 'PASS' : 'FAIL'})`);
    console.log(`Issues Found: ${result.issues.length}`);
    
    if (result.issues.length > 0) {
      console.log('\n🚨 Custom rule violations:');
      result.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.message}`);
        console.log(`     Field: ${issue.fieldPath}`);
        console.log(`     Expected: ${JSON.stringify(issue.expectedValue)}`);
      });
    }
  } catch (error) {
    console.log(`❌ Custom rule validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('\n' + '=' .repeat(50));
  console.log('🎯 Semantic Validation Examples Complete!');
  console.log('\nKey features demonstrated:');
  console.log('✅ Contradiction detection');
  console.log('✅ Impossible value detection');
  console.log('✅ Range validation');
  console.log('✅ Type consistency checking');
  console.log('✅ Custom business rules');
  console.log('✅ Field configuration');
  console.log('✅ Nested object validation');
  console.log('✅ Custom rule templates');
}

// Run demonstration
demonstrateSemanticValidation().catch(console.error);

export { demonstrateSemanticValidation };
