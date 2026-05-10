/**
 * Example usage of OpenRouter provider
 */

import { OpenRouterProvider } from '../src/providers/openrouter.js';

// Initialize the OpenRouter provider
const openrouter = new OpenRouterProvider({
  apiKey: process.env.OPENROUTER_API_KEY || 'your-api-key-here',
  defaultModel: 'meta-llama/llama-3.1-8b-instruct:free',
  siteName: 'OpenGuard Example',
  siteUrl: 'https://github.com/pavanemani/openguard',
});

// Example: Generate a complete response
async function generateExample() {
  try {
    const response = await openrouter.generate({
      prompt: 'Explain the concept of distributed systems in simple terms.',
      temperature: 0.7,
      maxTokens: 500,
    });

    console.log('Generated response:', response.content);
    console.log('Model used:', response.model);
    console.log('Finish reason:', response.finishReason);
    console.log('Usage:', response.usage);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Example: Stream a response
async function streamExample() {
  try {
    console.log('Streaming response:');
    
    for await (const chunk of openrouter.streamGenerate({
      prompt: 'Write a short story about a programmer discovering artificial general intelligence.',
      temperature: 0.8,
      maxTokens: 400,
    })) {
      process.stdout.write(chunk.content);
    }
    
    console.log('\n\nStreaming completed.');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Example: Using message array
async function messageArrayExample() {
  try {
    const response = await openrouter.generate({
      prompt: [
        { role: 'system', content: 'You are a helpful assistant that explains complex topics clearly and concisely.' },
        { role: 'user', content: 'What is the difference between REST and GraphQL?' }
      ],
      temperature: 0.6,
      maxTokens: 300,
    });

    console.log('Message array response:', response.content);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Example: Using different OpenRouter models
async function modelVariationExample() {
  try {
    const models = [
      'meta-llama/llama-3.1-8b-instruct:free',
      'meta-llama/llama-3.1-70b-instruct:free',
      'anthropic/claude-3-haiku',
      'google/gemini-flash',
    ];
    
    for (const model of models) {
      console.log(`\n--- Testing with ${model} ---`);
      
      const response = await openrouter.generate({
        prompt: 'What is the capital of Japan?',
        model,
        temperature: 0.3,
        maxTokens: 100,
      });
      
      console.log(response.content);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Example: Using premium models (requires paid account)
async function premiumModelExample() {
  try {
    const response = await openrouter.generate({
      prompt: 'Explain quantum computing in detail.',
      model: 'anthropic/claude-3.5-sonnet',
      temperature: 0.5,
      maxTokens: 600,
    });

    console.log('Premium model response:', response.content);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run examples
async function main() {
  await generateExample();
  console.log('\n' + '='.repeat(50) + '\n');
  await streamExample();
  console.log('\n' + '='.repeat(50) + '\n');
  await messageArrayExample();
  console.log('\n' + '='.repeat(50) + '\n');
  await modelVariationExample();
  console.log('\n' + '='.repeat(50) + '\n');
  await premiumModelExample();
}

main().catch(console.error);
