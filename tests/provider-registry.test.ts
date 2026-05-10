/**
 * Verification tests for provider registry system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  providerRegistry, 
  pluginRegistry, 
  RegistryFactory,
  type ProviderPlugin,
  type IProviderRegistry 
} from '../src/providers/registry.js';
import type { AIProvider, GenerateRequest, GenerateResponse } from '../src/providers/base.js';

// Mock provider for testing
class MockTestProvider implements AIProvider {
  constructor(private name: string, private responsePrefix: string = 'Mock') {}

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    return {
      id: `test-${this.name}-${Date.now()}`,
      content: `${this.responsePrefix} response from ${this.name}: ${typeof request.prompt === 'string' ? request.prompt : 'multiple messages'}`,
      model: `test-${this.name}-model`,
      finishReason: 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      },
    };
  }

  async *streamGenerate(request: GenerateRequest): AsyncIterable<GenerateResponse> {
    const content = `${this.responsePrefix} streaming from ${this.name}: ${typeof request.prompt === 'string' ? request.prompt : 'multiple messages'}`;
    
    for (const word of content.split(' ')) {
      yield {
        id: `test-${this.name}-${Math.random()}`,
        content: word + ' ',
        model: `test-${this.name}-model`,
        finishReason: null,
      };
    }
    
    yield {
      id: `test-${this.name}-final`,
      content: '',
      model: `test-${this.name}-model`,
      finishReason: 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: content.split(' ').length,
        totalTokens: 10 + content.split(' ').length,
      },
    };
  }
}

describe('Provider Registry', () => {
  let provider1: MockTestProvider;
  let provider2: MockTestProvider;

  beforeEach(() => {
    providerRegistry.clear();
    provider1 = new MockTestProvider('Provider1', 'Alpha');
    provider2 = new MockTestProvider('Provider2', 'Beta');
  });

  afterEach(() => {
    providerRegistry.clear();
  });

  describe('Basic Registration and Retrieval', () => {
    it('should register a provider', () => {
      providerRegistry.register('test-provider', provider1);
      
      expect(providerRegistry.has('test-provider')).toBe(true);
      expect(providerRegistry.list()).toContain('test-provider');
    });

    it('should retrieve a registered provider', () => {
      providerRegistry.register('test-provider', provider1);
      
      const retrieved = providerRegistry.get('test-provider');
      expect(retrieved).toBe(provider1);
    });

    it('should throw error when retrieving non-existent provider', () => {
      expect(() => providerRegistry.get('non-existent')).toThrow('Provider \'non-existent\' not found');
    });

    it('should throw error when registering duplicate provider', () => {
      providerRegistry.register('test-provider', provider1);
      
      expect(() => providerRegistry.register('test-provider', provider2)).toThrow('Provider \'test-provider\' is already registered');
    });

    it('should store and retrieve provider metadata', () => {
      providerRegistry.register('test-provider', provider1, {
        description: 'Test provider description',
        version: '1.0.0',
        capabilities: ['chat', 'streaming'],
      });

      const metadata = providerRegistry.getMetadata('test-provider');
      expect(metadata?.description).toBe('Test provider description');
      expect(metadata?.version).toBe('1.0.0');
      expect(metadata?.capabilities).toEqual(['chat', 'streaming']);
      expect(metadata?.registeredAt).toBeInstanceOf(Date);
    });
  });

  describe('Default Provider Management', () => {
    it('should set first registered provider as default', () => {
      providerRegistry.register('provider1', provider1);
      
      expect(() => providerRegistry.getDefault()).not.toThrow();
      expect(providerRegistry.getDefault()).toBe(provider1);
    });

    it('should allow setting default provider explicitly', () => {
      providerRegistry.register('provider1', provider1);
      providerRegistry.register('provider2', provider2);
      
      providerRegistry.setDefault('provider2');
      expect(providerRegistry.getDefault()).toBe(provider2);
    });

    it('should throw error when setting non-existent provider as default', () => {
      expect(() => providerRegistry.setDefault('non-existent')).toThrow('Provider \'non-existent\' not found');
    });

    it('should throw error when no default provider is set', () => {
      expect(() => providerRegistry.getDefault()).toThrow('No default provider set');
    });
  });

  describe('Provider Operations', () => {
    it('should unregister a provider', () => {
      providerRegistry.register('provider1', provider1);
      providerRegistry.register('provider2', provider2);
      
      const removed = providerRegistry.unregister('provider1');
      
      expect(removed).toBe(true);
      expect(providerRegistry.has('provider1')).toBe(false);
      expect(providerRegistry.list()).not.toContain('provider1');
      expect(providerRegistry.list()).toContain('provider2');
    });

    it('should return false when unregistering non-existent provider', () => {
      const removed = providerRegistry.unregister('non-existent');
      expect(removed).toBe(false);
    });

    it('should update default provider when current default is unregistered', () => {
      providerRegistry.register('provider1', provider1);
      providerRegistry.register('provider2', provider2);
      
      providerRegistry.unregister('provider1');
      
      expect(providerRegistry.getDefault()).toBe(provider2);
    });

    it('should clear all providers', () => {
      providerRegistry.register('provider1', provider1);
      providerRegistry.register('provider2', provider2);
      
      providerRegistry.clear();
      
      expect(providerRegistry.list()).toHaveLength(0);
      expect(() => providerRegistry.getDefault()).toThrow('No default provider set');
    });
  });

  describe('Registry Statistics', () => {
    it('should return accurate statistics', () => {
      providerRegistry.register('provider1', provider1);
      providerRegistry.register('provider2', provider2);
      
      const stats = providerRegistry.getStats();
      
      expect(stats.totalProviders).toBe(2);
      expect(stats.defaultProvider).toBe('provider1');
      expect(stats.registeredProviders).toEqual(['provider1', 'provider2']);
    });
  });
});

describe('Plugin Registry', () => {
  let testPlugin: ProviderPlugin;

  beforeEach(() => {
    pluginRegistry.unregister('test-plugin');
    testPlugin = {
      name: 'test-plugin',
      createProvider: (config?: any) => new MockTestProvider('Plugin', config?.prefix || 'Plugin'),
      metadata: {
        version: '1.0.0',
        description: 'Test plugin for verification',
        dependencies: ['test-dep'],
      },
    };
  });

  afterEach(() => {
    try {
      pluginRegistry.unregister('test-plugin');
    } catch {
      // Plugin might not exist
    }
  });

  it('should register a plugin', () => {
    pluginRegistry.register(testPlugin);
    
    expect(pluginRegistry.list()).toContain('test-plugin');
    expect(pluginRegistry.get('test-plugin')).toBe(testPlugin);
  });

  it('should throw error when registering duplicate plugin', () => {
    pluginRegistry.register(testPlugin);
    
    expect(() => pluginRegistry.register(testPlugin)).toThrow('Plugin \'test-plugin\' is already registered');
  });

  it('should load provider from plugin', async () => {
    pluginRegistry.register(testPlugin);
    
    await pluginRegistry.loadProvider('test-plugin', 'loaded-provider', { prefix: 'Loaded' });
    
    expect(providerRegistry.has('loaded-provider')).toBe(true);
    
    const provider = providerRegistry.get('loaded-provider');
    const response = await provider.generate({ prompt: 'test' });
    expect(response.content).toContain('Loaded response from Plugin');
  });

  it('should throw error when loading from non-existent plugin', async () => {
    await expect(
      pluginRegistry.loadProvider('non-existent', 'provider')
    ).rejects.toThrow('Plugin \'non-existent\' not found');
  });
});

describe('Isolated Registry Instances', () => {
  it('should create isolated provider registries', () => {
    const registry1 = RegistryFactory.createProviderRegistry();
    const registry2 = RegistryFactory.createProviderRegistry();
    
    const provider1 = new MockTestProvider('Isolated1');
    const provider2 = new MockTestProvider('Isolated2');
    
    registry1.register('provider', provider1);
    registry2.register('provider', provider2);
    
    expect(registry1.get('provider')).toBe(provider1);
    expect(registry2.get('provider')).toBe(provider2);
    expect(registry1.get('provider')).not.toBe(registry2.get('provider'));
  });

  it('should create complete isolated registry system', () => {
    const { providers, plugins } = RegistryFactory.createRegistrySystem();
    
    expect(providers).toBeDefined();
    expect(plugins).toBeDefined();
    expect(providers.list()).toHaveLength(0);
    expect(plugins.list()).toHaveLength(0);
  });
});

describe('End-to-End Functionality', () => {
  beforeEach(() => {
    providerRegistry.clear();
  });

  it('should work with complete provider lifecycle', async () => {
    // Register provider
    const provider = new MockTestProvider('E2E', 'EndToEnd');
    providerRegistry.register('e2e-provider', provider, {
      description: 'End-to-end test provider',
      version: '1.0.0',
    });

    // Verify registration
    expect(providerRegistry.has('e2e-provider')).toBe(true);
    expect(providerRegistry.getMetadata('e2e-provider')?.description).toBe('End-to-end test provider');

    // Test generate functionality
    const response = await provider.generate({ prompt: 'E2E test' });
    expect(response.content).toContain('EndToEnd response from E2E');
    expect(response.model).toBe('test-E2E-model');

    // Test streaming functionality
    const chunks: GenerateResponse[] = [];
    for await (const chunk of provider.streamGenerate({ prompt: 'Stream test' })) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[chunks.length - 1].finishReason).toBe('stop');

    // Test provider replacement
    const newProvider = new MockTestProvider('NewE2E', 'NewEndToEnd');
    providerRegistry.unregister('e2e-provider');
    providerRegistry.register('e2e-provider', newProvider);

    const newResponse = await providerRegistry.get('e2e-provider').generate({ prompt: 'New test' });
    expect(newResponse.content).toContain('NewEndToEnd response from NewE2E');
  });

  it('should handle plugin-based provider loading end-to-end', async () => {
    // Register plugin
    const plugin: ProviderPlugin = {
      name: 'e2e-plugin',
      createProvider: () => new MockTestProvider('E2EPlugin', 'PluginE2E'),
      metadata: {
        version: '2.0.0',
        description: 'E2E test plugin',
      },
    };
    pluginRegistry.register(plugin);

    // Load provider from plugin
    await pluginRegistry.loadProvider('e2e-plugin', 'plugin-provider');

    // Verify loaded provider works
    const provider = providerRegistry.get('plugin-provider');
    const response = await provider.generate({ prompt: 'Plugin test' });
    expect(response.content).toContain('PluginE2E response from E2EPlugin');

    // Verify metadata
    const metadata = providerRegistry.getMetadata('plugin-provider');
    expect(metadata?.description).toBe('E2E test plugin');
    expect(metadata?.version).toBe('2.0.0');
  });

  it('should maintain provider functionality across registry operations', async () => {
    const provider1 = new MockTestProvider('Multi1', 'Multi');
    const provider2 = new MockTestProvider('Multi2', 'Multi');

    // Register multiple providers
    providerRegistry.register('multi1', provider1);
    providerRegistry.register('multi2', provider2);

    // Set default and use
    providerRegistry.setDefault('multi2');
    const defaultResponse = await providerRegistry.getDefault().generate({ prompt: 'Default test' });
    expect(defaultResponse.content).toContain('Multi response from Multi2');

    // Switch default
    providerRegistry.setDefault('multi1');
    const newDefaultResponse = await providerRegistry.getDefault().generate({ prompt: 'New default test' });
    expect(newDefaultResponse.content).toContain('Multi response from Multi1');

    // Remove one provider
    providerRegistry.unregister('multi1');
    expect(providerRegistry.getDefault()).toBe(provider2);

    // Clear and verify empty state
    providerRegistry.clear();
    expect(providerRegistry.list()).toHaveLength(0);
    expect(() => providerRegistry.getDefault()).toThrow();
  });
});
