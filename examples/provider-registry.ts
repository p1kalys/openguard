/**
 * Provider registry usage examples for OpenGuard
 */

import { OpenAIProvider } from '../src/providers/openai.js';
import {
  providerRegistry,
  pluginRegistry,
  RegistryFactory,
  type ProviderPlugin,
} from '../src/providers/registry.js';
import type { AIProvider, GenerateRequest, ProviderCapabilities } from '../src/providers/base.js';

// Mock providers for demonstration
class MockProvider implements AIProvider {
  readonly capabilities: ProviderCapabilities = { streaming: true, jsonMode: false, tools: false, vision: false };

  constructor(private name: string) {}

  async generate(request: GenerateRequest) {
    return {
      id: `mock-${this.name}-${Date.now()}`,
      content: `Response from ${this.name}: ${typeof request.prompt === 'string' ? request.prompt : 'multiple messages'}`,
      model: `mock-${this.name}-model`,
      finishReason: 'stop' as const,
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    };
  }

  async *streamGenerate(request: GenerateRequest) {
    const content = `Streaming from ${this.name}: ${typeof request.prompt === 'string' ? request.prompt : 'multiple messages'}`;
    for (const word of content.split(' ')) {
      yield { id: `mock-${this.name}-${Math.random()}`, content: word + ' ', model: `mock-${this.name}-model`, finishReason: null };
    }
    yield {
      id: `mock-${this.name}-final`,
      content: '',
      model: `mock-${this.name}-model`,
      finishReason: 'stop' as const,
      usage: { promptTokens: 10, completionTokens: content.split(' ').length, totalTokens: 10 + content.split(' ').length },
    };
  }
}

// Example 1: Basic provider registration
async function basicRegistration() {
  console.log('=== Basic Provider Registration ===\n');

  const openaiProvider = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! });
  const secondProvider = new MockProvider('Secondary');

  providerRegistry.register('openai', openaiProvider, {
    description: 'Standard OpenAI provider',
    version: '1.0.0',
    capabilities: ['chat', 'streaming'],
  });

  providerRegistry.register('secondary', secondProvider, {
    description: 'Secondary mock provider',
    version: '1.0.0',
    capabilities: ['chat'],
  });

  console.log('Registered providers:', providerRegistry.list());
  console.log('Registry stats:', providerRegistry.getStats());
}

// Example 2: Default provider management
async function defaultProviderExample() {
  console.log('\n=== Default Provider Management ===\n');

  providerRegistry.setDefault('secondary');
  const defaultProvider = providerRegistry.getDefault();
  console.log('Default provider:', defaultProvider.constructor.name);

  const response = await defaultProvider.generate({ prompt: 'Tell me a joke' });
  console.log('Default provider response:', response.content.substring(0, 50) + '...');
}

// Example 3: Plugin-based provider registration
async function pluginExample() {
  console.log('\n=== Plugin-Based Provider Registration ===\n');

  const anthropicPlugin: ProviderPlugin = {
    name: 'anthropic',
    createProvider: (_config?: unknown) => new MockProvider('Anthropic-Claude'),
    metadata: {
      version: '1.0.0',
      description: 'Anthropic Claude provider',
      dependencies: ['anthropic-sdk'],
    },
  };

  pluginRegistry.register(anthropicPlugin);
  console.log('Registered plugins:', pluginRegistry.list());

  await pluginRegistry.loadProvider('anthropic', 'claude', { apiKey: 'mock-api-key' });
  console.log('Providers after plugin loading:', providerRegistry.list());

  const response = await providerRegistry.get('claude').generate({ prompt: 'Hello from plugin-loaded provider!' });
  console.log('Plugin provider response:', response.content);
}

// Example 4: Isolated registry instances
async function isolatedRegistryExample() {
  console.log('\n=== Isolated Registry Instances ===\n');

  const registry1 = RegistryFactory.createProviderRegistry();
  const registry2 = RegistryFactory.createProviderRegistry();

  registry1.register('provider1', new MockProvider('Registry1'));
  registry2.register('provider2', new MockProvider('Registry2'));

  console.log('Registry1 providers:', registry1.list());
  console.log('Registry2 providers:', registry2.list());

  const response1 = await registry1.get('provider1').generate({ prompt: 'Test registry 1' });
  const response2 = await registry2.get('provider2').generate({ prompt: 'Test registry 2' });
  console.log('Registry1 response:', response1.content);
  console.log('Registry2 response:', response2.content);
}

// Example 5: Advanced registry operations
async function advancedOperations() {
  console.log('\n=== Advanced Registry Operations ===\n');

  console.log('Has openai:', providerRegistry.has('openai'));
  console.log('Has non-existent:', providerRegistry.has('non-existent'));

  const metadata = providerRegistry.getMetadata('openai');
  console.log('OpenAI metadata:', { description: metadata?.description, version: metadata?.version });

  providerRegistry.unregister('secondary');
  providerRegistry.register('secondary', new MockProvider('Replacement'), { description: 'Replaced provider' });
  console.log('After replacement:', providerRegistry.list());

  console.log('Before clear:', providerRegistry.list().length);
  providerRegistry.clear();
  console.log('After clear:', providerRegistry.list().length);
}

// Example 6: Complete registry system
async function completeSystemExample() {
  console.log('\n=== Complete Registry System ===\n');

  const { providers, plugins } = RegistryFactory.createRegistrySystem();

  plugins.register({
    name: 'custom',
    createProvider: () => new MockProvider('Custom'),
    metadata: { description: 'Custom mock provider' },
  });

  await plugins.loadProvider('custom', 'my-custom-provider');

  console.log('System providers:', providers.list());
  console.log('System plugins:', plugins.list());

  const response = await providers.get('my-custom-provider').generate({ prompt: 'Hello from complete system!' });
  console.log('System response:', response.content);
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

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('📋 Running Provider Registry Examples\n');
  runAllExamples();
}
