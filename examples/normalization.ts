/**
 * Example usage of Response Normalizer
 */

import { normalizeResponse, ResponseNormalizer } from '../src/normalization/response.js';
import type { GenerateResponse } from '../src/providers/base.js';

// Example 1: Basic normalization
async function basicNormalizationExample() {
  console.log('=== Basic Normalization Example ===');
  
  // Simulate different provider responses
  const openaiResponse: GenerateResponse = {
    id: 'chatcmpl-123',
    content: '  The capital of France is Paris.  ',
    model: 'gpt-4o-mini',
    finishReason: 'stop',
    usage: {
      promptTokens: 15,
      completionTokens: 12,
      totalTokens: 27,
    },
  };

  const geminiResponse: GenerateResponse = {
    id: 'gemini-456',
    content: 'Paris is the capital of France.',
    model: 'gemini-1.5-flash',
    finishReason: 'STOP',
    usage: {
      promptTokens: 14,
      completionTokens: 8,
      totalTokens: 22,
    },
  };

  const groqResponse: GenerateResponse = {
    id: 'groq-789',
    content: 'The capital of France is Paris.',
    model: 'llama3-8b-8192',
    finishReason: 'stop',
    usage: {
      promptTokens: 13,
      completionTokens: 9,
      totalTokens: 22,
    },
  };

  // Normalize all responses
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
  console.log('  Usage:', normalizedGemini.usage);

  console.log('\n🔵 Groq Response:');
  console.log('  Content:', `"${normalizedGroq.content}"`);
  console.log('  Model:', normalizedGroq.model);
  console.log('  Provider:', normalizedGroq.provider);
  console.log('  Finish Reason:', normalizedGroq.finishReason);
  console.log('  Usage:', normalizedGroq.usage);
}

// Example 2: Custom normalization configuration
async function customConfigExample() {
  console.log('\n=== Custom Configuration Example ===');
  
  const response: GenerateResponse = {
    id: 'test-123',
    content: 'The answer is 42.',
    model: 'gpt-4',
    finishReason: 'stop',
    usage: {
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    },
  };

  // Custom normalization config
  const customNormalizer = new ResponseNormalizer('CustomProvider', {
    includeProviderInModel: false,
    modelMappings: {
      'gpt-4': 'GPT-4-Turbo',
    },
    sanitizeContent: true,
    costPerToken: {
      'customprovider': 0.00001,
    },
    contentSanitizers: [
      (content) => content.replace(/\b42\b/g, '[ANSWER]'), // Hide the answer
      (content) => content.toUpperCase(), // Convert to uppercase
    ],
  });

  const normalized = customNormalizer.normalize(response, 1500); // 1.5s processing time

  console.log('🔧 Custom Normalization:');
  console.log('  Original Content:', response.content);
  console.log('  Normalized Content:', normalized.content);
  console.log('  Model:', normalized.model);
  console.log('  Provider:', normalized.provider);
  console.log('  Estimated Cost:', normalized.usage?.estimatedCost);
  console.log('  Processing Time:', normalized.processingTime, 'ms');
  console.log('  Metadata:', normalized.metadata);
}

// Example 3: Cost estimation
async function costEstimationExample() {
  console.log('\n=== Cost Estimation Example ===');
  
  const responses = [
    {
      provider: 'OpenAI',
      usage: { totalTokens: 1000 },
    },
    {
      provider: 'Anthropic',
      usage: { totalTokens: 1000 },
    },
    {
      provider: 'Gemini',
      usage: { totalTokens: 1000 },
    },
    {
      provider: 'Groq',
      usage: { totalTokens: 1000 },
    },
  ];

  const normalizer = new ResponseNormalizer('Test', {
    costPerToken: {
      'openai': 0.00002,
      'anthropic': 0.000015,
      'gemini': 0.000001,
      'groq': 0.0000005,
    },
  });

  console.log('💰 Cost Estimation for 1000 tokens:');
  
  for (const { provider, usage } of responses) {
    const mockResponse: GenerateResponse = {
      id: 'test',
      content: 'test',
      model: 'test',
      finishReason: 'stop',
      usage,
    };

    const normalized = normalizer.normalize(mockResponse);
    
    console.log(`\n${provider}:`);
    console.log(`  Estimated Cost: $${normalized.usage?.estimatedCost?.toFixed(6) || 'N/A'}`);
    console.log(`  Token Model: ${normalized.usage?.tokenModel || 'N/A'}`);
  }
}

// Example 4: Content sanitization
async function contentSanitizationExample() {
  console.log('\n=== Content Sanitization Example ===');
  
  const uncleanContent = '  Hello! \x00World\n\n\tTest  ';
  const response: GenerateResponse = {
    id: 'test',
    content: uncleanContent,
    model: 'test-model',
    finishReason: 'stop',
  };

  // Normalizer with sanitization
  const sanitizingNormalizer = new ResponseNormalizer('Test', {
    sanitizeContent: true,
    contentSanitizers: [
      (content) => content.replace(/world/gi, 'Earth'), // Replace words
      (content) => content.replace(/\s+/g, ' '), // Normalize spaces
      (content) => content.trim(), // Trim edges
    ],
  });

  const normalized = sanitizingNormalizer.normalize(response);

  console.log('🧹 Content Sanitization:');
  console.log('  Original:', `"${uncleanContent}"`);
  console.log('  Normalized:', `"${normalized.content}"`);
  console.log('  Lengths - Original:', uncleanContent.length, 'Normalized:', normalized.content.length);
}

// Example 5: Model name standardization
async function modelStandardizationExample() {
  console.log('\n=== Model Standardization Example ===');
  
  const modelVariants = [
    'gpt-4o-mini',
    'gpt-4-turbo',
    'claude-3-haiku-20240307',
    'gemini-1.5-flash',
    'llama3-8b-8192',
    'mistral-tiny',
    'mixtral-8x7b-32768',
  ];

  const normalizer = new ResponseNormalizer('Test');

  console.log('🏷️ Model Standardization:');
  
  for (const model of modelVariants) {
    const response: GenerateResponse = {
      id: 'test',
      content: 'test',
      model,
      finishReason: 'stop',
    };

    const normalized = normalizer.normalize(response);
    console.log(`\nOriginal: ${model}`);
    console.log(`Normalized: ${normalized.model}`);
  }
}

// Example 6: Finish reason mapping
async function finishReasonExample() {
  console.log('\n=== Finish Reason Mapping Example ===');
  
  const finishReasons = [
    { provider: 'OpenAI', reason: 'stop' },
    { provider: 'Gemini', reason: 'STOP' },
    { provider: 'Mistral', reason: 'model_length' },
    { provider: 'Groq', reason: 'content_filter' },
    { provider: 'Anthropic', reason: 'tool_calls' },
    { provider: 'Unknown', reason: 'timeout' },
  ];

  const normalizer = new ResponseNormalizer('Test');

  console.log('🏁 Finish Reason Standardization:');
  
  for (const { provider, reason } of finishReasons) {
    const response: GenerateResponse = {
      id: 'test',
      content: 'test',
      model: 'test',
      finishReason: reason,
    };

    const normalized = normalizer.normalize(response);
    
    console.log(`\n${provider}:`);
    console.log(`  Original: ${reason}`);
    console.log(`  Standardized: ${normalized.finishReason}`);
  }
}

// Example 7: Batch normalization
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
        finishReason: 'STOP',
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

  // Normalize all responses
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
    console.log(`  Estimated Cost: $${normalized.response.usage?.estimatedCost?.toFixed(6) || 'N/A'}`);
  }

  // Calculate statistics
  const totalTokens = normalizedResponses.reduce((sum, r) => 
    sum + (r.response.usage?.totalTokens || 0), 0
  );
  const avgProcessingTime = normalizedResponses.reduce((sum, r) => 
    sum + r.processingTime, 0
  ) / normalizedResponses.length;
  const totalCost = normalizedResponses.reduce((sum, r) => 
    sum + (r.response.usage?.estimatedCost || 0), 0
  );

  console.log('\n📈 Batch Statistics:');
  console.log(`  Total Tokens: ${totalTokens}`);
  console.log(`  Average Processing Time: ${avgProcessingTime.toFixed(2)}ms`);
  console.log(`  Total Estimated Cost: $${totalCost.toFixed(6)}`);
}

// Run all examples
async function main() {
  await basicNormalizationExample();
  await customConfigExample();
  await costEstimationExample();
  await contentSanitizationExample();
  await modelStandardizationExample();
  await finishReasonExample();
  await batchNormalizationExample();
}

main().catch(console.error);
