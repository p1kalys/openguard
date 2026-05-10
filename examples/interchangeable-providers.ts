/**
 * Example demonstrating interchangeable provider usage
 */

import { OpenAIProvider } from '../src/providers/openai.js';
import { EnhancedOpenAIProvider } from '../src/providers/openai-enhanced.js';
import { adaptProvider, ProviderRegistry, ProviderFactory, ProviderManager, ProviderUtils } from '../src/providers/index.js';
import { ValidationUtils, ComparisonUtils } from '../src/providers/index.js';
import type { AIProvider, GenerateRequest } from '../src/providers/base.js';

// Example 1: Basic provider interchangeability
async function basicInterchangeability() {
  console.log('=== Basic Provider Interchangeability ===\n');

  // Create different providers
  const legacyProvider = adaptProvider(new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!,
  }));

  const enhancedProvider = new EnhancedOpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!,
  });

  const providers = [legacyProvider, enhancedProvider];

  // Test if they're interchangeable
  const areInterchangeable = await ComparisonUtils.quickCheck(providers);
  console.log('Providers are interchangeable:', areInterchangeable);

  // Use them interchangeably
  const request: GenerateRequest = {
    prompt: 'What is the capital of France?',
    temperature: 0.3,
  };

  for (let i = 0; i < providers.length; i++) {
    const response = await providers[i].generate(request);
    console.log(`Provider ${i + 1}: ${response.content.substring(0, 50)}...`);
  }
}

// Example 2: Provider registry for dynamic switching
async function registryExample() {
  console.log('\n=== Provider Registry Example ===\n');

  // Register providers
  ProviderRegistry.register('openai-legacy', adaptProvider(new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!,
  })));

  ProviderRegistry.register('openai-enhanced', new EnhancedOpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!,
  }));

  // List available providers
  console.log('Available providers:', ProviderRegistry.list());

  // Switch between providers
  const request: GenerateRequest = {
    prompt: 'Explain the concept of provider abstraction',
  };

  for (const providerName of ProviderRegistry.list()) {
    console.log(`\nUsing ${providerName}:`);
    const provider = ProviderRegistry.get(providerName);
    const response = await provider.generate(request);
    console.log(response.content.substring(0, 100) + '...');
  }
}

// Example 3: Provider factory for configuration-based creation
async function factoryExample() {
  console.log('\n=== Provider Factory Example ===\n');

  // Create providers from configuration
  const configs = [
    {
      type: 'openai' as const,
      config: { apiKey: process.env.OPENAI_API_KEY!, defaultModel: 'gpt-4o-mini' }
    },
    {
      type: 'openai' as const,
      config: { apiKey: process.env.OPENAI_API_KEY!, defaultModel: 'gpt-3.5-turbo' }
    }
  ];

  const providers = configs.map(config => ProviderFactory.create(config));

  // Test interchangeability
  const testRequest = ValidationUtils.createTestRequest();
  const results = await ValidationUtils.validateProviders(providers);

  console.log('Provider validation results:');
  results.forEach(result => {
    console.log(`${result.providerName}: ${result.overallCompliance ? '✅' : '❌'}`);
    if (!result.overallCompliance) {
      console.log(`  Issues: ${result.failedTests.join(', ')}`);
    }
  });
}

// Example 4: Provider manager with fallbacks
async function managerExample() {
  console.log('\n=== Provider Manager with Fallbacks ===\n');

  const primaryProvider = new EnhancedOpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!,
  });

  const fallbackProvider = adaptProvider(new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!,
  }));

  const manager = ProviderUtils.withFallbacks(primaryProvider, [fallbackProvider]);

  const request: GenerateRequest = {
    prompt: 'Test message for fallback behavior',
  };

  try {
    const response = await manager.generate(request);
    console.log('Response from primary provider:', response.content.substring(0, 50) + '...');
  } catch (error) {
    console.log('All providers failed:', error);
  }
}

// Example 5: Full compatibility analysis
async function compatibilityAnalysis() {
  console.log('\n=== Full Compatibility Analysis ===\n');

  const providers = [
    new EnhancedOpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! }),
    adaptProvider(new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! })),
  ];

  const testRequests = [
    ValidationUtils.createTestRequest({ prompt: 'Simple test' }),
    ValidationUtils.createTestRequest({ prompt: 'Complex test with multiple requirements', maxTokens: 200 }),
    ValidationUtils.createTestRequest({ prompt: 'Edge case test', temperature: 0 }),
  ];

  const report = await ComparisonUtils.fullAnalysis(providers, testRequests);

  console.log('Interchangeability Report:');
  console.log(`Total comparisons: ${report.summary.totalComparisons}`);
  console.log(`Interchangeable: ${report.summary.interchangeable}`);
  console.log(`Rate: ${(report.summary.interchangeabilityRate * 100).toFixed(1)}%`);
  console.log(`Status: ${report.summary.overallStatus}`);

  if (report.commonIssues.length > 0) {
    console.log('\nCommon issues:');
    report.commonIssues.forEach(issue => console.log(`- ${issue}`));
  }

  if (report.recommendations.length > 0) {
    console.log('\nRecommendations:');
    report.recommendations.forEach(rec => console.log(`- ${rec}`));
  }
}

// Example 6: Custom provider implementation
class MockInterchangeableProvider implements AIProvider {
  constructor(private name: string) {}

  async generate(request: GenerateRequest) {
    return {
      id: `mock-${this.name}-${Date.now()}`,
      content: `Response from ${this.name}: ${typeof request.prompt === 'string' ? request.prompt : 'multiple messages'}`,
      model: `mock-${this.name}-model`,
      finishReason: 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      },
    };
  }

  async *streamGenerate(request: GenerateRequest) {
    const content = `Streaming from ${this.name}: ${typeof request.prompt === 'string' ? request.prompt : 'multiple messages'}`;
    
    for (const word of content.split(' ')) {
      yield {
        id: `mock-${this.name}-${Math.random()}`,
        content: word + ' ',
        model: `mock-${this.name}-model`,
        finishReason: null,
      };
    }
    
    yield {
      id: `mock-${this.name}-final`,
      content: '',
      model: `mock-${this.name}-model`,
      finishReason: 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: content.split(' ').length,
        totalTokens: 10 + content.split(' ').length,
      },
    };
  }
}

async function customProviderExample() {
  console.log('\n=== Custom Provider Example ===\n');

  const providers = [
    new MockInterchangeableProvider('Alpha'),
    new MockInterchangeableProvider('Beta'),
    new MockInterchangeableProvider('Gamma'),
  ];

  // Register custom providers
  providers.forEach((provider, index) => {
    ProviderRegistry.register(`custom-${index + 1}`, provider);
  });

  console.log('Custom providers registered:', ProviderRegistry.list());

  // Test interchangeability
  const areInterchangeable = await ComparisonUtils.quickCheck(providers);
  console.log('Custom providers are interchangeable:', areInterchangeable);

  // Use them interchangeably
  const request: GenerateRequest = {
    prompt: 'Test custom provider interchangeability',
  };

  for (const providerName of ProviderRegistry.list().filter(name => name.startsWith('custom'))) {
    console.log(`\nUsing ${providerName}:`);
    const provider = ProviderRegistry.get(providerName);
    const response = await provider.generate(request);
    console.log(response.content);
  }
}

// Run all examples
async function runAllExamples() {
  try {
    await basicInterchangeability();
    await registryExample();
    await factoryExample();
    await managerExample();
    await compatibilityAnalysis();
    await customProviderExample();
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🔄 Running Interchangeable Provider Examples\n');
  runAllExamples();
}
