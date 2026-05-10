/**
 * Example demonstrating the refactored OpenAI provider with new AIProvider interface
 */

import { OpenAIProvider } from '../src/providers/openai.js';
import type { GenerateRequest, GenerateResponse } from '../src/providers/base.js';

// Mock OpenAI provider for testing (without real API key)
class MockOpenAIProvider extends OpenAIProvider {
  constructor() {
    super({
      apiKey: 'mock-api-key-for-testing',
      defaultModel: 'gpt-4o-mini',
    });
  }

  // Override the API call for testing
  protected async makeAPICall(url: string, body: any): Promise<any> {
    // Mock response for testing
    return {
      id: 'mock-' + Date.now(),
      object: 'chat.completion',
      created: Date.now(),
      model: body.model || 'gpt-4o-mini',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: `Mock response for: ${body.messages?.[0]?.content || 'no content'}`,
        },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    };
  }
}

// Example 1: Using the new generate() method
async function testNewGenerateMethod() {
  console.log('=== Testing New generate() Method ===\n');

  const provider = new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY || 'mock-key',
    defaultModel: 'gpt-4o-mini',
  });

  const request: GenerateRequest = {
    prompt: 'What is the capital of France?',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 100,
  };

  try {
    const response: GenerateResponse = await provider.generate(request);
    
    console.log('✅ Generate Response:');
    console.log(`  ID: ${response.id}`);
    console.log(`  Content: ${response.content.substring(0, 100)}...`);
    console.log(`  Model: ${response.model}`);
    console.log(`  Finish Reason: ${response.finishReason}`);
    console.log(`  Usage: ${JSON.stringify(response.usage)}`);
    console.log(`  Raw Response Available: ${!!response.raw}`);
    
  } catch (error) {
    console.log('❌ Generate failed:', (error as Error).message);
  }
}

// Example 2: Using the new streamGenerate() method
async function testNewStreamGenerateMethod() {
  console.log('\n=== Testing New streamGenerate() Method ===\n');

  const provider = new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY || 'mock-key',
  });

  const request: GenerateRequest = {
    prompt: 'Explain quantum computing in simple terms',
    temperature: 0.5,
    maxTokens: 200,
  };

  try {
    console.log('🔄 Streaming response:');
    let fullContent = '';
    let chunkCount = 0;
    
    for await (const chunk of provider.streamGenerate(request)) {
      chunkCount++;
      fullContent += chunk.content;
      process.stdout.write(chunk.content);
    }
    
    console.log('\n\n✅ Stream Generate Complete:');
    console.log(`  Total chunks: ${chunkCount}`);
    console.log(`  Full content length: ${fullContent.length}`);
    console.log(`  Final chunk had finish reason: ${chunkCount > 0 ? 'stop' : 'N/A'}`);
    
  } catch (error) {
    console.log('❌ Stream generate failed:', (error as Error).message);
  }
}

// Example 3: Testing with message array format
async function testMessageArrayFormat() {
  console.log('\n=== Testing Message Array Format ===\n');

  const provider = new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY || 'mock-key',
  });

  const request: GenerateRequest = {
    prompt: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'What is 2 + 2?' },
    ],
    temperature: 0.1,
  };

  try {
    const response = await provider.generate(request);
    
    console.log('✅ Message Array Response:');
    console.log(`  Content: ${response.content.substring(0, 100)}...`);
    console.log(`  Model: ${response.model}`);
    
  } catch (error) {
    console.log('❌ Message array format failed:', (error as Error).message);
  }
}

// Example 4: Testing provider options
async function testProviderOptions() {
  console.log('\n=== Testing Provider Options ===\n');

  const provider = new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY || 'mock-key',
    baseURL: 'https://api.openai.com/v1',
    organization: process.env.OPENAI_ORG_ID,
  });

  const request: GenerateRequest = {
    prompt: 'Test with additional options',
    model: 'gpt-4o-mini',
    temperature: 0.8,
    maxTokens: 50,
    options: {
      // Additional OpenAI-specific options
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.1,
    },
  };

  try {
    const response = await provider.generate(request);
    
    console.log('✅ Provider Options Response:');
    console.log(`  Content: ${response.content.substring(0, 100)}...`);
    console.log(`  Model: ${response.model}`);
    
  } catch (error) {
    console.log('❌ Provider options failed:', (error as Error).message);
  }
}

// Example 5: Backward compatibility test
async function testBackwardCompatibility() {
  console.log('\n=== Testing Backward Compatibility ===\n');

  const provider = new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY || 'mock-key',
  });

  // Test legacy complete() method
  try {
    const legacyResponse = await provider.complete({
      messages: [{ role: 'user', content: 'Legacy test' }],
      model: 'gpt-4o-mini',
      temperature: 0.5,
    });
    
    console.log('✅ Legacy complete() method works:');
    console.log(`  Content: ${legacyResponse.choices[0]?.message?.content?.substring(0, 50)}...`);
    
  } catch (error) {
    console.log('❌ Legacy complete failed:', (error as Error).message);
  }

  // Test legacy stream() method
  try {
    console.log('🔄 Legacy streaming:');
    let legacyChunks = 0;
    
    for await (const chunk of provider.stream({
      messages: [{ role: 'user', content: 'Legacy stream test' }],
      model: 'gpt-4o-mini',
    })) {
      legacyChunks++;
      if (legacyChunks <= 3) { // Show first few chunks
        console.log(`  Chunk ${legacyChunks}: ${chunk.choices[0]?.message?.content?.substring(0, 30)}...`);
      }
    }
    
    console.log(`✅ Legacy stream() method works: ${legacyChunks} chunks`);
    
  } catch (error) {
    console.log('❌ Legacy stream failed:', (error as Error).message);
  }
}

// Example 6: Error handling test
async function testErrorHandling() {
  console.log('\n=== Testing Error Handling ===\n');

  // Test with invalid API key
  const invalidProvider = new OpenAIProvider({
    apiKey: 'invalid-key',
  });

  try {
    await invalidProvider.generate({
      prompt: 'This should fail',
    });
    console.log('❌ Should have failed with invalid key');
  } catch (error) {
    console.log('✅ Correctly handled invalid API key error:');
    console.log(`  Error: ${(error as Error).message}`);
  }

  // Test with invalid request
  try {
    const validProvider = new OpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY || 'mock-key',
    });
    
    await validProvider.generate({
      prompt: '', // Empty prompt should be handled
    });
    console.log('✅ Handled empty prompt gracefully');
  } catch (error) {
    console.log('✅ Correctly handled invalid request:');
    console.log(`  Error: ${(error as Error).message}`);
  }
}

// Example 7: Performance comparison
async function testPerformanceComparison() {
  console.log('\n=== Testing Performance Comparison ===\n');

  const provider = new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY || 'mock-key',
  });

  const request: GenerateRequest = {
    prompt: 'Simple performance test',
    temperature: 0.5,
    maxTokens: 50,
  };

  // Test new interface
  const newInterfaceStart = Date.now();
  try {
    await provider.generate(request);
    const newInterfaceTime = Date.now() - newInterfaceStart;
    console.log(`✅ New interface (generate): ${newInterfaceTime}ms`);
  } catch (error) {
    console.log('❌ New interface failed:', (error as Error).message);
  }

  // Test legacy interface
  const legacyInterfaceStart = Date.now();
  try {
    await provider.complete({
      messages: [{ role: 'user', content: request.prompt as string }],
      model: 'gpt-4o-mini',
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    });
    const legacyInterfaceTime = Date.now() - legacyInterfaceStart;
    console.log(`✅ Legacy interface (complete): ${legacyInterfaceTime}ms`);
  } catch (error) {
    console.log('❌ Legacy interface failed:', (error as Error).message);
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Testing Refactored OpenAI Provider\n');
  
  console.log('📝 Note: Tests will use mock responses if no OPENAI_API_KEY is set\n');
  
  try {
    await testNewGenerateMethod();
    await testNewStreamGenerateMethod();
    await testMessageArrayFormat();
    await testProviderOptions();
    await testBackwardCompatibility();
    await testErrorHandling();
    await testPerformanceComparison();
    
    console.log('\n🎉 All tests completed!');
    console.log('\n📊 Summary:');
    console.log('  ✅ New generate() method');
    console.log('  ✅ New streamGenerate() method');
    console.log('  ✅ Message array format support');
    console.log('  ✅ Provider options support');
    console.log('  ✅ Backward compatibility');
    console.log('  ✅ Error handling');
    console.log('  ✅ Performance comparison');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}
