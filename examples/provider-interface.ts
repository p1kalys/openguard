/**
 * Example usage of the new AIProvider interface
 */

import { OpenAIProvider } from '../src/providers/openai.js';
import { EnhancedOpenAIProvider } from '../src/providers/openai-enhanced.js';
import { adaptProvider } from '../src/providers/adapter.js';
import type { AIProvider, GenerateRequest } from '../src/providers/base.js';

// Example 1: Using the enhanced provider directly
async function exampleDirectUsage() {
  const provider: AIProvider = new EnhancedOpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!,
    defaultModel: 'gpt-4o-mini',
  });

  const request: GenerateRequest = {
    prompt: 'Explain quantum computing in simple terms',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 500,
  };

  // Generate a complete response
  const response = await provider.generate(request);
  console.log('Response:', response.content);
  console.log('Tokens used:', response.usage?.totalTokens);

  // Stream a response
  console.log('\nStreaming response:');
  for await (const chunk of provider.streamGenerate(request)) {
    process.stdout.write(chunk.content);
  }
}

// Example 2: Using adapter with existing provider
async function exampleAdapterUsage() {
  const legacyProvider = new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!,
  });

  const provider: AIProvider = adaptProvider(legacyProvider);

  const request: GenerateRequest = {
    prompt: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'What is the capital of France?' }
    ],
    temperature: 0.3,
  };

  const response = await provider.generate(request);
  console.log('Adapter response:', response.content);
}

// Example 3: Custom provider implementation
class MockProvider implements AIProvider {
  async generate(request: GenerateRequest) {
    return {
      id: 'mock-123',
      content: `Mock response for: ${typeof request.prompt === 'string' ? request.prompt : request.prompt.map(m => m.content).join(' ')}`,
      model: request.model || 'mock-model',
      finishReason: 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      },
    };
  }

  async *streamGenerate(request: GenerateRequest) {
    const content = `Streaming mock response for: ${typeof request.prompt === 'string' ? request.prompt : 'multiple messages'}`;
    
    for (const word of content.split(' ')) {
      yield {
        id: 'mock-stream-' + Math.random(),
        content: word + ' ',
        model: request.model || 'mock-model',
        finishReason: null,
      };
    }
    
    yield {
      id: 'mock-stream-final',
      content: '',
      model: request.model || 'mock-model',
      finishReason: 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: content.split(' ').length,
        totalTokens: 10 + content.split(' ').length,
      },
    };
  }
}

async function exampleCustomProvider() {
  const provider: AIProvider = new MockProvider();

  const response = await provider.generate({
    prompt: 'Hello, custom provider!',
  });

  console.log('Custom provider response:', response.content);

  console.log('\nCustom provider stream:');
  for await (const chunk of provider.streamGenerate({
    prompt: 'Stream this message'
  })) {
    process.stdout.write(chunk.content);
  }
}

// Run examples
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Provider Interface Examples ===\n');
  
  console.log('1. Direct usage:');
  await exampleDirectUsage().catch(console.error);
  
  console.log('\n2. Adapter usage:');
  await exampleAdapterUsage().catch(console.error);
  
  console.log('\n3. Custom provider:');
  await exampleCustomProvider().catch(console.error);
}
