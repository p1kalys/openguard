/**
 * Example usage of Response Normalizer
 */

import { normalizeResponse, ResponseNormalizer } from '../src/core/normalization.js';
import type { GenerateResponse } from '../src/providers/base.js';

// Example 1: Basic normalization
async function basicNormalizationExample() {
  console.log('=== Basic Normalization Example ===');

  const openaiResponse: GenerateResponse = {
    id: 'chatcmpl-123',
    content: '  The capital of France is Paris.  ',
    model: 'gpt-4o-mini',
    finishReason: 'stop',
    usage: { promptTokens: 15, completionTokens: 12, totalTokens: 27 },
  };

  const geminiResponse: GenerateResponse = {
    id: 'gemini-456',
    content: 'Paris is the capital of France.',
    model: 'gemini-1.5-flash',
    finishReason: 'stop',
    usage: { promptTokens: 14, completionTokens: 8, totalTokens: 22 },
  };

  const groqResponse: GenerateResponse = {
    id: 'groq-789',
    content: 'The capital of France is Paris.',
    model: 'llama3-8b-8192',
    finishReason: 'stop',
    usage: { promptTokens: 13, completionTokens: 9, totalTokens: 22 },
  };

  const normalizedOpenAI = normalizeResponse(openaiResponse, 'OpenAI');
  const normalizedGemini = normalizeResponse(geminiResponse, 'Gemini');
  const normalizedGroq = normalizeResponse(groqResponse, 'Groq');

  console.log('🔵 OpenAI Response:');
  console.log('  Content:', `"${normalizedOpenAI.content}"`);
  console.log('  Model:', normalizedOpenAI.model);
  console.log('  Provider:', normalizedOpenAI.provider);
  console.log('  Finish Reason:', normalizedOpenAI.finishReason);
  console.log('  Usage:', normalizedOpenAI.usage);

  console.log('\n🔵 Gemini Response:');
  console.log('  Content:', `"${normalizedGemini.content}"`);
  console.log('  Model:', normalizedGemini.model);
  console.log('  Provider:', normalizedGemini.provider);
  console.log('  Finish Reason:', normalizedGemini.finishReason);

  console.log('\n🔵 Groq Response:');
  console.log('  Content:', `"${normalizedGroq.content}"`);
  console.log('  Model:', normalizedGroq.model);
  console.log('  Provider:', normalizedGroq.provider);
  console.log('  Finish Reason:', normalizedGroq.finishReason);
}

// Example 2: ResponseNormalizer class usage
async function normalizerClassExample() {
  console.log('\n=== ResponseNormalizer Class Example ===');

  const normalizer = new ResponseNormalizer('CustomProvider');

  const response: GenerateResponse = {
    id: 'test-123',
    content: 'The answer is 42.',
    model: 'gpt-4',
    finishReason: 'stop',
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
  };

  const normalized = normalizer.normalize(response, 1500);

  console.log('🔧 Normalized Response:');
  console.log('  Content:', normalized.content);
  console.log('  Model:', normalized.model);
  console.log('  Provider:', normalized.provider);
  console.log('  Processing Time:', normalized.processingTime, 'ms');
}

// Example 3: Finish reason mapping
async function finishReasonExample() {
  console.log('\n=== Finish Reason Mapping Example ===');

  const normalizer = new ResponseNormalizer('Test');

  const finishReasons = [
    { provider: 'OpenAI', reason: 'stop' },
    { provider: 'Gemini', reason: 'STOP' },
    { provider: 'Mistral', reason: 'model_length' },
    { provider: 'Groq', reason: 'content_filter' },
    { provider: 'Anthropic', reason: 'tool_calls' },
    { provider: 'Unknown', reason: 'timeout' },
  ];

  console.log('🏁 Finish Reason Standardization:');

  for (const { provider, reason } of finishReasons) {
    const response: GenerateResponse = {
      id: 'test',
      content: 'test',
      model: 'test',
      finishReason: reason as GenerateResponse['finishReason'],
    };

    const normalized = normalizer.normalize(response);
    console.log(`\n${provider}:`);
    console.log(`  Original: ${reason}`);
    console.log(`  Standardized: ${normalized.finishReason}`);
  }
}

// Example 4: Batch normalization
async function batchNormalizationExample() {
  console.log('\n=== Batch Normalization Example ===');

  const responses = [
    {
      response: {
        id: 'openai-123',
        content: 'Response from OpenAI',
        model: 'gpt-4o-mini',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
      },
      provider: 'OpenAI',
      processingTime: 1200,
    },
    {
      response: {
        id: 'gemini-456',
        content: 'Response from Gemini',
        model: 'gemini-1.5-flash',
        finishReason: 'stop' as const,
        usage: { promptTokens: 12, completionTokens: 10, totalTokens: 22 },
      },
      provider: 'Gemini',
      processingTime: 800,
    },
    {
      response: {
        id: 'groq-789',
        content: 'Response from Groq',
        model: 'llama3-8b-8192',
        finishReason: 'length',
        usage: { promptTokens: 8, completionTokens: 20, totalTokens: 28 },
      },
      provider: 'Groq',
      processingTime: 600,
    },
  ];

  const normalizedResponses = responses.map(({ response, provider, processingTime }) => ({
    response: normalizeResponse(response, provider),
    provider,
    processingTime,
  }));

  console.log('📊 Batch Normalization Results:');

  for (const normalized of normalizedResponses) {
    console.log(`\n${normalized.provider}:`);
    console.log(`  Content: "${normalized.response.content}"`);
    console.log(`  Model: ${normalized.response.model}`);
    console.log(`  Processing Time: ${normalized.processingTime}ms`);
    console.log(`  Total Tokens: ${normalized.response.usage?.totalTokens || 0}`);
  }

  const totalTokens = normalizedResponses.reduce(
    (sum, r) => sum + (r.response.usage?.totalTokens || 0), 0
  );
  const avgProcessingTime =
    normalizedResponses.reduce((sum, r) => sum + r.processingTime, 0) / normalizedResponses.length;

  console.log('\n📈 Batch Statistics:');
  console.log(`  Total Tokens: ${totalTokens}`);
  console.log(`  Average Processing Time: ${avgProcessingTime.toFixed(2)}ms`);
}

// Run all examples
async function main() {
  await basicNormalizationExample();
  await normalizerClassExample();
  await finishReasonExample();
  await batchNormalizationExample();
}

main().catch(console.error);
