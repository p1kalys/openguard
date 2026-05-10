/**
 * Example usage of Mistral provider
 */

import { MistralProvider } from '../src/providers/mistral.js';

// Initialize the Mistral provider
const mistral = new MistralProvider({
  apiKey: process.env.MISTRAL_API_KEY || 'your-api-key-here',
  defaultModel: 'mistral-tiny',
});

// Example: Generate a complete response
async function generateExample() {
  try {
    const response = await mistral.generate({
      prompt: 'Explain the concept of machine learning in simple terms.',
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
    
    for await (const chunk of mistral.streamGenerate({
      prompt: 'Write a short story about a robot discovering emotions.',
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
    const response = await mistral.generate({
      prompt: [
        { role: 'system', content: 'You are a helpful assistant that explains complex topics simply.' },
        { role: 'user', content: 'What is quantum entanglement?' }
      ],
      temperature: 0.6,
      maxTokens: 300,
    });

    console.log('Message array response:', response.content);
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
}

main().catch(console.error);
