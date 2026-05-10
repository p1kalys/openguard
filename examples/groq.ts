/**
 * Example usage of Groq provider
 */

import { GroqProvider } from '../src/providers/groq.js';

// Initialize the Groq provider
const groq = new GroqProvider({
  apiKey: process.env.GROQ_API_KEY || 'your-api-key-here',
  defaultModel: 'llama3-8b-8192',
});

// Example: Generate a complete response
async function generateExample() {
  try {
    const response = await groq.generate({
      prompt: 'Explain the concept of neural networks in simple terms.',
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
    
    for await (const chunk of groq.streamGenerate({
      prompt: 'Write a short story about artificial intelligence becoming self-aware.',
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
    const response = await groq.generate({
      prompt: [
        { role: 'system', content: 'You are a helpful assistant that explains complex topics clearly and concisely.' },
        { role: 'user', content: 'What is the difference between machine learning and deep learning?' }
      ],
      temperature: 0.6,
      maxTokens: 300,
    });

    console.log('Message array response:', response.content);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Example: Using different Groq models
async function modelVariationExample() {
  try {
    const models = ['llama3-8b-8192', 'llama3-70b-8192', 'mixtral-8x7b-32768'];
    
    for (const model of models) {
      console.log(`\n--- Testing with ${model} ---`);
      
      const response = await groq.generate({
        prompt: 'What is the capital of France?',
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

// Run examples
async function main() {
  await generateExample();
  console.log('\n' + '='.repeat(50) + '\n');
  await streamExample();
  console.log('\n' + '='.repeat(50) + '\n');
  await messageArrayExample();
  console.log('\n' + '='.repeat(50) + '\n');
  await modelVariationExample();
}

main().catch(console.error);
