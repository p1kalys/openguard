// Simple test to verify grounding validation module exports
import { 
  quickGroundingValidation,
  createGroundingValidator,
  GroundingValidationEngine,
  DocumentProcessor,
  createSourceDocuments,
  DEFAULT_GROUNDING_CONFIG
} from './dist/grounding/index.js';

console.log('✅ Grounding validation module exports work!');
console.log('Available exports:');
console.log('- quickGroundingValidation:', typeof quickGroundingValidation);
console.log('- createGroundingValidator:', typeof createGroundingValidator);
console.log('- GroundingValidationEngine:', typeof GroundingValidationEngine);
console.log('- DocumentProcessor:', typeof DocumentProcessor);
console.log('- createSourceDocuments:', typeof createSourceDocuments);
console.log('- DEFAULT_GROUNDING_CONFIG:', typeof DEFAULT_GROUNDING_CONFIG);

// Test basic validation
const validator = createGroundingValidator();
console.log('✅ Grounding validation engine created');

// Test document processing
const testDocuments = createSourceDocuments([
  { content: 'Company revenue was $8 million in 2023.', type: 'text' },
  { content: 'Revenue increased 15% from previous year.', type: 'text' }
]);

console.log('✅ Source documents created:', testDocuments.length);

// Test validation with simple data
const testResponse = {
  text: 'According to the 2024 report, company revenue increased by 25% to $10 million.',
  provider: 'openai',
  model: 'gpt-4',
  finishReason: 'stop',
};

// Run validation (this would normally be async)
validator.validateResponse(testResponse, testDocuments).then(result => {
  console.log(`✅ Basic grounding validation completed`);
  console.log(`Score: ${result.metrics.groundingScore.toFixed(3)}`);
  console.log(`Claims extracted: ${result.claims.length}`);
  console.log(`Unsupported claims: ${result.unsupportedClaims.length}`);
}).catch(error => {
  console.log(`❌ Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
});

console.log('\n🎯 Grounding validation module is ready!');
console.log('\nTo test with full examples:');
console.log('Run: npx tsx examples/grounding-validation.ts');
