/**
 * Example usage of FallbackOrchestrator
 */

import { FallbackOrchestrator } from '../src/orchestration/fallback.js';
import { OpenAIProvider } from '../src/providers/openai.js';
import { GeminiProvider } from '../src/providers/gemini.js';
import { GroqProvider } from '../src/providers/groq.js';
import { MistralProvider } from '../src/providers/mistral.js';

// Initialize providers
const openai = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-key',
  defaultModel: 'gpt-4o-mini',
});

const gemini = new GeminiProvider({
  apiKey: process.env.GEMINI_API_KEY || 'your-gemini-key',
  defaultModel: 'gemini-1.5-flash',
});

const groq = new GroqProvider({
  apiKey: process.env.GROQ_API_KEY || 'your-groq-key',
  defaultModel: 'llama3-8b-8192',
});

const mistral = new MistralProvider({
  apiKey: process.env.MISTRAL_API_KEY || 'your-mistral-key',
  defaultModel: 'mistral-tiny',
});

// Example 1: Basic fallback with multiple providers
async function basicFallbackExample() {
  console.log('=== Basic Fallback Example ===');
  
  const orchestrator = new FallbackOrchestrator()
    .addProvider({ provider: openai, maxRetries: 2, timeout: 5000 })
    .addProvider({ provider: gemini, maxRetries: 1, timeout: 3000 })
    .addProvider({ provider: groq, maxRetries: 1, timeout: 3000 });

  try {
    const result = await orchestrator.generate({
      prompt: 'What is the capital of France?',
      temperature: 0.3,
      maxTokens: 100,
    });

    console.log('✅ Success!');
    console.log('Response:', result.response.content);
    console.log('Provider:', result.provider);
    console.log('Attempts:', result.attempts);
    console.log('Duration:', result.duration + 'ms');
    console.log('Fallback chain:', result.fallbackChain.join(' → '));
  } catch (error) {
    console.error('❌ All providers failed:', error);
  }
}

// Example 2: Fallback with schema validation
async function schemaValidationExample() {
  console.log('\n=== Schema Validation Example ===');
  
  // Simple schema validation - response must contain "Paris"
  const validateCapitalResponse = (response: any) => {
    return response.content.toLowerCase().includes('paris');
  };

  const orchestrator = new FallbackOrchestrator({
    validateSchema: validateCapitalResponse,
  })
    .addProvider({ provider: groq, maxRetries: 1 })
    .addProvider({ provider: mistral, maxRetries: 1 })
    .addProvider({ provider: gemini, maxRetries: 1 });

  try {
    const result = await orchestrator.generate({
      prompt: 'What is the capital of France? Answer with just the city name.',
      temperature: 0.1,
      maxTokens: 50,
    });

    console.log('✅ Schema validation passed!');
    console.log('Response:', result.response.content);
    console.log('Provider:', result.provider);
  } catch (error) {
    console.error('❌ Schema validation failed for all providers:', error);
  }
}

// Example 3: Streaming fallback
async function streamingFallbackExample() {
  console.log('\n=== Streaming Fallback Example ===');
  
  const orchestrator = new FallbackOrchestrator()
    .addProvider({ provider: groq, maxRetries: 1, timeout: 3000 })
    .addProvider({ provider: mistral, maxRetries: 1, timeout: 3000 });

  try {
    console.log('Streaming response:');
    
    for await (const result of orchestrator.streamGenerate({
      prompt: 'Write a short poem about technology.',
      temperature: 0.8,
      maxTokens: 200,
    })) {
      process.stdout.write(result.chunk.content);
      
      if (result.chunk.content && result.chunk.content.includes('.')) {
        console.log('\n\n✅ Streaming complete!');
        console.log('Provider:', result.provider);
        console.log('Attempts:', result.attempts);
        break;
      }
    }
  } catch (error) {
    console.error('❌ All streaming providers failed:', error);
  }
}

// Example 4: Provider management
async function providerManagementExample() {
  console.log('\n=== Provider Management Example ===');
  
  const orchestrator = new FallbackOrchestrator()
    .addProvider({ provider: openai, enabled: false }) // Disabled
    .addProvider({ provider: gemini })
    .addProvider({ provider: groq });

  console.log('Initial providers:', orchestrator.getProviders());
  
  // Enable OpenAI, disable Gemini
  orchestrator.setProviderEnabled('OpenAIProvider', true);
  orchestrator.setProviderEnabled('GeminiProvider', false);
  
  console.log('Updated providers:', orchestrator.getProviders());
  
  try {
    const result = await orchestrator.generate({
      prompt: 'What is 2 + 2?',
      temperature: 0.1,
      maxTokens: 50,
    });
    
    console.log('Response:', result.response.content);
    console.log('Provider:', result.provider);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Example 5: Advanced configuration with timeouts
async function advancedConfigExample() {
  console.log('\n=== Advanced Configuration Example ===');
  
  const orchestrator = new FallbackOrchestrator({
    globalTimeout: 15000, // 15 seconds total
    continueOnSuccess: false, // Stop at first success
  })
    .addProvider({ 
      provider: openai, 
      maxRetries: 2, 
      timeout: 2000, // 2 seconds per attempt
      enabled: true 
    })
    .addProvider({ 
      provider: groq, 
      maxRetries: 1, 
      timeout: 1000, // 1 second per attempt
      enabled: true 
    });

  try {
    const result = await orchestrator.generate({
      prompt: 'Explain quantum computing in one sentence.',
      temperature: 0.5,
      maxTokens: 100,
    });

    console.log('✅ Success with advanced config!');
    console.log('Response:', result.response.content);
    console.log('Duration:', result.duration + 'ms');
    console.log('Provider:', result.provider);
  } catch (error) {
    console.error('❌ All providers failed:', error);
  }
}

// Run all examples
async function main() {
  await basicFallbackExample();
  await schemaValidationExample();
  await streamingFallbackExample();
  await providerManagementExample();
  await advancedConfigExample();
}

main().catch(console.error);
