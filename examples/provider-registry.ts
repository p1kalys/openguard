/**
 * Provider registry usage examples for OpenGuard
 */

import { OpenAIProvider } from '../src/providers/openai.js';
import { EnhancedOpenAIProvider } from '../src/providers/openai-enhanced.js';
import { adaptProvider } from '../src/providers/adapter.js';
import {
  providerRegistry,
  pluginRegistry,
  RegistryFactory,
  type ProviderPlugin,
  type AIProvider
} from '../src/providers/registry.js';
import type { GenerateRequest } from '../src/providers/base.js';

// Example 1: Basic provider registration
async function basicRegistration() {
  console.log('=== Basic Provider Registration ===\n');

  // Create providers
  const openaiProvider = adaptProvider(new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!,
  }));

  const enhancedProvider = new EnhancedOpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!,
  });

  // Register providers
  providerRegistry.register('openai', openaiProvider, {
    description: 'Standard OpenAI provider',
    version: '1.0.0',
    capabilities: ['chat', 'streaming'],
  });

  providerRegistry.register('openai-enhanced', enhancedProvider, {
    description: 'Enhanced OpenAI provider with modern interface',
    version: '2.0.0',
    capabilities: ['chat', 'streaming', 'enhanced'],
  });

  // List registered providers
  console.log('Registered providers:', providerRegistry.list());

  // Get registry stats
  const stats = providerRegistry.getStats();
  console.log('Registry stats:', stats);

  // Use a registered provider
  const request: GenerateRequest = {
    prompt: 'What is the capital of France?',
  };

  const response = await providerRegistry.get('openai').generate(request);
  console.log('Response from openai:', response.content.substring(0, 50) + '...');
}

// Example 2: Default provider management
async function defaultProviderExample() {
  console.log('\n=== Default Provider Management ===\n');

  // Set default provider
  providerRegistry.setDefault('openai-enhanced');

  // Get default provider
  const defaultProvider = providerRegistry.getDefault();
  console.log('Default provider:', defaultProvider.constructor.name);

  // Use default provider
  const response = await defaultProvider.generate({
    prompt: 'Tell me a joke',
  });
  console.log('Default provider response:', response.content.substring(0, 50) + '...');
}

// Example 3: Plugin-based provider registration
async function pluginExample() {
  console.log('\n=== Plugin-Based Provider Registration ===\n');

  // Define a plugin
  const anthropicPlugin: ProviderPlugin = {
    name: 'anthropic',
    createProvider: async (config?: any) => {
      // Mock Anthropic provider for demonstration
      return new MockAnthropicProvider(config?.apiKey);
    },
    metadata: {
      version: '1.0.0',
      description: 'Anthropic Claude provider',
      dependencies: ['anthropic-sdk'],
    },
  };

  // Register the plugin
  pluginRegistry.register(anthropicPlugin);
  console.log('Registered plugins:', pluginRegistry.list());

  // Load provider from plugin
  await pluginRegistry.loadProvider(
    'anthropic',
    'claude',
    { apiKey: 'mock-api-key' }
  );

  console.log('Providers after plugin loading:', providerRegistry.list());

  // Use the plugin-loaded provider
  const response = await providerRegistry.get('claude').generate({
    prompt: 'Hello from plugin-loaded provider!',
  });
  console.log('Plugin provider response:', response.content);
}

// Example 4: Isolated registry instances
async function isolatedRegistryExample() {
  console.log('\n=== Isolated Registry Instances ===\n');

  // Create separate registries
  const registry1 = RegistryFactory.createProviderRegistry();
  const registry2 = RegistryFactory.createProviderRegistry();

  // Register different providers in each
  registry1.register('provider1', new MockProvider('Registry1'));
  registry2.register('provider2', new MockProvider('Registry2'));

  console.log('Registry1 providers:', registry1.list());
  console.log('Registry2 providers:', registry2.list());

  // Use each registry independently
  const response1 = await registry1.get('provider1').generate({
    prompt: 'Test registry 1',
  });
  console.log('Registry1 response:', response1.content);

  const response2 = await registry2.get('provider2').generate({
    prompt: 'Test registry 2',
  });
  console.log('Registry2 response:', response2.content);
}

// Example 5: Advanced registry operations
async function advancedOperations() {
  console.log('\n=== Advanced Registry Operations ===\n');

  // Check if provider exists
  console.log('Has openai:', providerRegistry.has('openai'));
  console.log('Has non-existent:', providerRegistry.has('non-existent'));

  // Get provider metadata
  const metadata = providerRegistry.getMetadata('openai');
  console.log('OpenAI metadata:', {
    description: metadata?.description,
    version: metadata?.version,
    registeredAt: metadata?.registeredAt,
  });

  // Provider replacement
  const newProvider = new MockProvider('Replacement');
  providerRegistry.unregister('openai');
  providerRegistry.register('openai', newProvider, {
    description: 'Replaced OpenAI provider',
  });

  console.log('After replacement:', providerRegistry.list());

  // Clear registry
  console.log('Before clear:', providerRegistry.list().length);
  providerRegistry.clear();
  console.log('After clear:', providerRegistry.list().length);
}

// Example 6: Complete registry system
async function completeSystemExample() {
  console.log('\n=== Complete Registry System ===\n');

  // Create a complete registry system
  const { providers, plugins } = RegistryFactory.createRegistrySystem();

  // Register a plugin
  plugins.register({
    name: 'custom',
    createProvider: () => new MockProvider('Custom'),
    metadata: {
      description: 'Custom mock provider',
    },
  });

  // Load provider from plugin
  await plugins.loadProvider('custom', 'my-custom-provider');

  // Use the system
  console.log('System providers:', providers.list());
  console.log('System plugins:', plugins.list());

  const response = await providers.get('my-custom-provider').generate({
    prompt: 'Hello from complete system!',
  });
  console.log('System response:', response.content);
}

// Mock providers for demonstration
class MockProvider implements AIProvider {
  constructor(private name: string) { }

  async generate(request: GenerateRequest) {
    return {
      id: `mock-${this.name}-${Date.now()}`,
      content: `Response from ${this.name}: ${typeof request.prompt === 'string' ? request.prompt : 'multiple messages'}`,
      model: `mock-${this.name}-model`,
      finishReason: 'stop' as const,
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
      finishReason: 'stop' as const,
      usage: {
        promptTokens: 10,
        completionTokens: content.split(' ').length,
        totalTokens: 10 + content.split(' ').length,
      },
    };
  }
}

class MockAnthropicProvider extends MockProvider {
  constructor(apiKey: string) {
    super('Anthropic-Claude');
  }
}

// Run all examples
async function runAllExamples() {
  try {
    await basicRegistration();
    await defaultProviderExample();
    await pluginExample();
    await isolatedRegistryExample();
    await advancedOperations();
    await completeSystemExample();
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('📋 Running Provider Registry Examples\n');
  runAllExamples();
}
