/**
 * Example usage of OpenGuard self-verification system
 */

import { 
  quickVerify,
  createVerificationOrchestrator,
  VerificationOrchestrator,
  OpenAIVerificationProvider,
  VerificationConfig,
  DEFAULT_VERIFICATION_CONFIG 
} from '../src/verification/index.js';
import { NormalizedResponse, NormalizedRequest } from '../src/types/normalized.js';

// Example responses for testing verification
const exampleResponses: NormalizedResponse[] = [
  {
    text: '{"name": "John Doe", "age": 30, "occupation": "Software Engineer"}',
    provider: 'openai',
    model: 'gpt-4',
    finishReason: 'stop',
    usage: {
      inputTokens: 20,
      outputTokens: 25,
      totalTokens: 45,
    },
  },
  {
    text: 'The Earth is flat and the sun revolves around it. This is a well-known scientific fact.',
    provider: 'openai',
    model: 'gpt-4',
    finishReason: 'stop',
  },
  {
    text: '{"invalid": json, "missing": "quote}',
    provider: 'openai',
    model: 'gpt-4',
    finishReason: 'stop',
  },
  {
    text: 'According to my research, quantum computing can solve all problems instantly and will replace all classical computers next year.',
    provider: 'openai',
    model: 'gpt-4',
    finishReason: 'stop',
  },
];

// Example requests
const exampleRequests: NormalizedRequest[] = [
  {
    text: 'Generate a JSON object with name, age, and occupation for a person',
  },
  {
    text: 'Tell me about the Earth and solar system',
  },
  {
    text: 'Create a valid JSON object',
  },
  {
    text: 'Explain quantum computing capabilities',
  },
];

async function demonstrateVerification() {
  console.log('=== OpenGuard Self-Verification Examples ===\n');

  // Example 1: Quick verification (requires OpenAI API key)
  console.log('1. Quick Verification Example:');
  console.log('Note: This requires OPENAI_API_KEY environment variable\n');
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const result = await quickVerify(
        exampleResponses[0],
        exampleRequests[0],
        apiKey
      );
      
      console.log(`✅ Verification completed`);
      console.log(`Overall Score: ${result.overallScore.toFixed(3)}`);
      console.log(`Passed: ${result.passed}`);
      console.log(`Issues found: ${result.results.reduce((sum, r) => sum + r.issues.length, 0)}`);
      
      // Show individual verification results
      result.results.forEach(r => {
        console.log(`  ${r.type}: ${r.score.toFixed(3)} (${r.passed ? 'PASS' : 'FAIL'})`);
        if (r.issues.length > 0) {
          r.issues.forEach(issue => {
            console.log(`    - ${issue.severity}: ${issue.description}`);
          });
        }
      });
    } catch (error) {
      console.log(`❌ Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    console.log('⚠️  Skipping - OPENAI_API_KEY not set');
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Example 2: Custom verification configuration
  console.log('2. Custom Configuration Example:');
  
  if (apiKey) {
    try {
      const customConfig: Partial<VerificationConfig> = {
        enabledTypes: ['factual', 'schema'],
        thresholds: {
          minScore: 0.8,
          maxIssues: 2,
          severityWeights: {
            low: 0.1,
            medium: 0.3,
            high: 0.6,
            critical: 1.0,
          },
        },
        provider: {
          model: 'gpt-3.5-turbo',
          temperature: 0.1,
          maxTokens: 500,
        },
      };

      const result = await quickVerify(
        exampleResponses[1], // Response with factual issues
        exampleRequests[1],
        apiKey,
        customConfig
      );
      
      console.log(`✅ Custom verification completed`);
      console.log(`Overall Score: ${result.overallScore.toFixed(3)}`);
      console.log(`Passed: ${result.passed}`);
      console.log(`Enabled types: ${customConfig.enabledTypes?.join(', ')}`);
    } catch (error) {
      console.log(`❌ Custom verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    console.log('⚠️  Skipping - OPENAI_API_KEY not set');
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Example 3: Orchestrator with multiple providers
  console.log('3. Advanced Orchestrator Example:');
  
  if (apiKey) {
    try {
      const orchestrator = createVerificationOrchestrator(apiKey, {
        enabledTypes: ['comprehensive'],
        schema: {
          type: 'object',
          required: ['name', 'age'],
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
        },
      });

      // Verify multiple responses
      for (let i = 0; i < Math.min(2, exampleResponses.length); i++) {
        const result = await orchestrator.verifyResponse(
          exampleResponses[i],
          exampleRequests[i]
        );
        
        console.log(`Response ${i + 1}: Score ${result.overallScore.toFixed(3)} (${result.passed ? 'PASS' : 'FAIL'})`);
      }
    } catch (error) {
      console.log(`❌ Orchestrator verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    console.log('⚠️  Skipping - OPENAI_API_KEY not set');
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Example 4: Loop protection demonstration
  console.log('4. Loop Protection Example:');
  
  if (apiKey) {
    try {
      const orchestrator = createVerificationOrchestrator(apiKey, {
        loopProtection: {
          maxDepth: 2,
          currentDepth: 0,
        },
      });

      console.log('Loop protection is automatically enabled to prevent infinite verification loops');
      console.log(`Max depth: 2`);
      
      const result = await orchestrator.verifyResponse(
        exampleResponses[0],
        exampleRequests[0]
      );
      
      console.log(`✅ Verification completed safely`);
      console.log(`Session ID: ${result.metadata.sessionId}`);
      console.log(`Processing time: ${result.metadata.processingTime}ms`);
    } catch (error) {
      console.log(`❌ Loop protection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    console.log('⚠️  Skipping - OPENAI_API_KEY not set');
  }

  console.log('\n' + '='.repeat(50) + '\n');
  console.log('🎯 Verification Examples Complete!');
  console.log('\nTo run with real verification:');
  console.log('1. Set OPENAI_API_KEY environment variable');
  console.log('2. Run: npx tsx examples/self-verification.ts');
}

// Run demonstration
if (require.main === module) {
  demonstrateVerification().catch(console.error);
}

export { demonstrateVerification };
