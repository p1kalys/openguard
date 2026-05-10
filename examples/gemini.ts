/**
 * Example usage of Gemini provider
 */

import { GeminiProvider } from '../src/providers/gemini.js';

// Initialize the Gemini provider
const gemini = new GeminiProvider({
  apiKey: process.env.GEMINI_API_KEY || 'your-api-key-here',
  defaultModel: 'gemini-1.5-flash',
});

// Example: Generate a complete response
async function generateExample() {
  try {
    const response = await gemini.generate({
      prompt: 'Explain quantum computing in simple terms.',
      temperature: 0.7,
      maxTokens: 500,
    });

    console.log('Generated response:', response.content);
    console.log('Model used:', response.model);
    console.log('Usage:', response.usage);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Example: Stream a response
async function streamExample() {
  try {
    console.log('Streaming response:');
    
    for await (const chunk of gemini.streamGenerate({
      prompt: 'Write a short poem about artificial intelligence.',
      temperature: 0.8,
      maxTokens: 300,
    })) {
      process.stdout.write(chunk.content);
    }
    
    console.log('\n\nStreaming completed.');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run examples
async function main() {
  await generateExample();
  console.log('\n' + '='.repeat(50) + '\n');
  await streamExample();
}

main().catch(console.error);
