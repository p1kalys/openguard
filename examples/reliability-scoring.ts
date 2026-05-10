/**
 * Example usage of OpenGuard reliability scoring system
 */

import { 
  calculateReliabilityScore, 
  quickScore,
  batchScore,
  getScoringSummary,
  DEFAULT_SCORING_CONFIG 
} from '../src/reliability/index.js';
import { NormalizedResponse } from '../src/types/normalized.js';

// Example responses for testing
const exampleResponses: NormalizedResponse[] = [
  {
    text: '{"name": "John", "age": 30}',
    provider: 'openai',
    model: 'gpt-4',
    finishReason: 'stop',
    usage: {
      inputTokens: 10,
      outputTokens: 15,
      totalTokens: 25,
    },
  },
  {
    text: 'This is a truncated response that',
    provider: 'openai',
    model: 'gpt-4',
    finishReason: 'length',
    usage: {
      inputTokens: 10,
      outputTokens: 100,
      totalTokens: 110,
    },
  },
  {
    text: '{"invalid": json}',
    provider: 'openai',
    model: 'gpt-4',
    finishReason: 'stop',
  },
  {
    text: '',
    provider: 'openai',
    model: 'gpt-4',
    finishReason: 'content_filter',
  },
];

// Example 1: Basic scoring
console.log('=== Basic Reliability Scoring ===');
const basicScore = quickScore(exampleResponses[0]);
console.log(`Score: ${basicScore.score} (${basicScore.confidence} confidence)`);
console.log('Factors:', basicScore.factors.map(f => `${f.name}: ${f.score}`).join(', '));

// Example 2: Scoring with repair context
console.log('\n=== Scoring with Repair Context ===');
const repairedScore = calculateReliabilityScore(
  exampleResponses[2],
  {},
  {
    repairCount: 2,
    originalError: 'Invalid JSON format',
  }
);
console.log(`Score: ${repairedScore.score} (${repairedScore.confidence} confidence)`);
console.log('Repair metadata:', repairedScore.factors.find(f => f.name === 'repair')?.metadata);

// Example 3: Batch scoring
console.log('\n=== Batch Scoring ===');
const batchScores = batchScore(exampleResponses);
batchScores.forEach((score, index) => {
  console.log(`Response ${index + 1}: ${score.score} (${score.confidence})`);
});

// Example 4: Summary statistics
console.log('\n=== Summary Statistics ===');
const summary = getScoringSummary(batchScores);
console.log(`Total: ${summary.total}`);
console.log(`Average: ${summary.average}`);
console.log(`Min: ${summary.min}, Max: ${summary.max}`);
console.log(`High: ${summary.high}, Medium: ${summary.medium}, Low: ${summary.low}`);

// Example 5: Custom scoring configuration
console.log('\n=== Custom Scoring Configuration ===');
const customConfig = {
  ...DEFAULT_SCORING_CONFIG,
  weights: {
    schemaValidation: 0.5,
    repair: 0.1,
    retry: 0.1,
    finishReason: 0.2,
    completeness: 0.1,
  },
  thresholds: {
    low: 0.3,
    medium: 0.6,
  },
};

const customScore = calculateReliabilityScore(exampleResponses[0], customConfig);
console.log(`Custom score: ${customScore.score} (${customScore.confidence} confidence)`);

// Example 6: JSON schema validation
console.log('\n=== JSON Schema Validation ===');
const schemaConfig = {
  ...DEFAULT_SCORING_CONFIG,
  schema: {
    requireValidJson: true,
    expectedSchema: {
      type: 'object',
      required: ['name', 'age'],
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
    },
  },
};

const schemaScore = calculateReliabilityScore(exampleResponses[0], schemaConfig);
console.log(`Schema score: ${schemaScore.score} (${schemaScore.confidence} confidence)`);
const schemaMetadata = schemaScore.factors.find(f => f.name === 'schemaValidation')?.metadata;
console.log('Schema validation metadata:', schemaMetadata);
