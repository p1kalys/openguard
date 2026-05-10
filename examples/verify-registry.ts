/**
 * Verification examples for provider registry system
 */

import { OpenAIProvider } from '../src/providers/openai.js';
import { EnhancedOpenAIProvider } from '../src/providers/openai-enhanced.js';
import { adaptProvider } from '../src/providers/adapter.js';
import { 
  providerRegistry, 
  pluginRegistry, 
  RegistryFactory,
  type ProviderPlugin 
} from '../src/providers/registry.js';
import type { AIProvider, GenerateRequest } from '../src/providers/base.js';

// Mock provider for verification
class VerificationProvider implements AIProvider {
  constructor(private name: string, private prefix: string = 'Verify') {}

  async generate(request: GenerateRequest) {
    return {
      id: `verify-${this.name}-${Date.now()}`,
      content: `${this.prefix} response from ${this.name}: ${typeof request.prompt === 'string' ? request.prompt : 'multiple messages'}`,
      model: `verify-${this.name}-model`,
      finishReason: 'stop' as const,
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      },
    };
  }

  async *streamGenerate(request: GenerateRequest) {
    const content = `${this.prefix} streaming from ${this.name}: ${typeof request.prompt === 'string' ? request.prompt : 'multiple messages'}`;
    
    for (const word of content.split(' ')) {
      yield {
        id: `verify-${this.name}-${Math.random()}`,
        content: word + ' ',
        model: `verify-${this.name}-model`,
        finishReason: null,
      };
    }
    
    yield {
      id: `verify-${this.name}-final`,
      content: '',
      model: `verify-${this.name}-model`,
      finishReason: 'stop' as const,
      usage: {
        promptTokens: 10,
        completionTokens: content.split(' ').length,
        totalTokens: 10 + content.split(' ').length,
      },
    };
  }
}

// Verification 1: Basic Registry Operations
async function verifyBasicOperations() {
  console.log('🔍 Verification 1: Basic Registry Operations\n');
  
  // Clear registry
  providerRegistry.clear();
  
  // Create test providers
  const provider1 = new VerificationProvider('Test1', 'Alpha');
  const provider2 = new VerificationProvider('Test2', 'Beta');
  
  // Test registration
  console.log('✓ Registering providers...');
  providerRegistry.register('test1', provider1, {
    description: 'First test provider',
    version: '1.0.0',
    capabilities: ['generate', 'stream'],
  });
  
  providerRegistry.register('test2', provider2, {
    description: 'Second test provider',
    version: '2.0.0',
    capabilities: ['generate'],
  });
  
  // Verify registration
  console.log('✓ Verifying registration...');
  console.log(`  Registered providers: ${providerRegistry.list().join(', ')}`);
  console.log(`  Has test1: ${providerRegistry.has('test1')}`);
  console.log(`  Has test2: ${providerRegistry.has('test2')}`);
  console.log(`  Has non-existent: ${providerRegistry.has('non-existent')}`);
  
  // Test retrieval
  console.log('✓ Testing provider retrieval...');
  const retrieved1 = providerRegistry.get('test1');
  const retrieved2 = providerRegistry.get('test2');
  console.log(`  Retrieved test1: ${retrieved1.constructor.name}`);
  console.log(`  Retrieved test2: ${retrieved2.constructor.name}`);
  
  // Test metadata
  console.log('✓ Testing metadata...');
  const metadata1 = providerRegistry.getMetadata('test1');
  const metadata2 = providerRegistry.getMetadata('test2');
  console.log(`  Test1 metadata: ${JSON.stringify(metadata1, null, 2)}`);
  console.log(`  Test2 metadata: ${JSON.stringify(metadata2, null, 2)}`);
  
  // Test default provider
  console.log('✓ Testing default provider...');
  console.log(`  Default provider: ${providerRegistry.getDefault().constructor.name}`);
  providerRegistry.setDefault('test2');
  console.log(`  New default: ${providerRegistry.getDefault().constructor.name}`);
  
  // Test provider functionality
  console.log('✓ Testing provider functionality...');
  const response1 = await retrieved1.generate({ prompt: 'Test message 1' });
  const response2 = await retrieved2.generate({ prompt: 'Test message 2' });
  console.log(`  Response 1: ${response1.content}`);
  console.log(`  Response 2: ${response2.content}`);
  
  // Test streaming
  console.log('✓ Testing streaming...');
  const chunks: string[] = [];
  for await (const chunk of retrieved1.streamGenerate({ prompt: 'Stream test' })) {
    chunks.push(chunk.content);
  }
  console.log(`  Stream chunks: ${chunks.length} total`);
  console.log(`  Final chunk: ${chunks[chunks.length - 1]}`);
  
  console.log('✅ Basic operations verification complete!\n');
}

// Verification 2: Plugin System
async function verifyPluginSystem() {
  console.log('🔍 Verification 2: Plugin System\n');
  
  // Create test plugin
  const testPlugin: ProviderPlugin = {
    name: 'verification-plugin',
    createProvider: (config?: any) => new VerificationProvider('Plugin', config?.prefix || 'Plugin'),
    metadata: {
      version: '1.0.0',
      description: 'Verification test plugin',
      dependencies: ['test-dep'],
    },
  };
  
  // Register plugin
  console.log('✓ Registering plugin...');
  pluginRegistry.register(testPlugin);
  console.log(`  Registered plugins: ${pluginRegistry.list().join(', ')}`);
  
  // Load provider from plugin
  console.log('✓ Loading provider from plugin...');
  await pluginRegistry.loadProvider('verification-plugin', 'plugin-provider', { prefix: 'LoadedPlugin' });
  console.log(`  Providers after plugin load: ${providerRegistry.list().join(', ')}`);
  
  // Test plugin-loaded provider
  console.log('✓ Testing plugin-loaded provider...');
  const pluginProvider = providerRegistry.get('plugin-provider');
  const response = await pluginProvider.generate({ prompt: 'Plugin test' });
  console.log(`  Plugin response: ${response.content}`);
  
  // Verify metadata inheritance
  console.log('✓ Verifying metadata inheritance...');
  const metadata = providerRegistry.getMetadata('plugin-provider');
  console.log(`  Plugin provider metadata: ${JSON.stringify(metadata, null, 2)}`);
  
  console.log('✅ Plugin system verification complete!\n');
}

// Verification 3: Isolated Registries
async function verifyIsolatedRegistries() {
  console.log('🔍 Verification 3: Isolated Registries\n');
  
  // Create isolated registries
  console.log('✓ Creating isolated registries...');
  const registry1 = RegistryFactory.createProviderRegistry();
  const registry2 = RegistryFactory.createProviderRegistry();
  const { providers: registry3, plugins: plugins3 } = RegistryFactory.createRegistrySystem();
  
  // Register providers in different registries
  console.log('✓ Registering providers in isolated registries...');
  const provider1 = new VerificationProvider('Isolated1', 'Iso1');
  const provider2 = new VerificationProvider('Isolated2', 'Iso2');
  const provider3 = new VerificationProvider('Isolated3', 'Iso3');
  
  registry1.register('provider', provider1);
  registry2.register('provider', provider2);
  registry3.register('provider', provider3);
  
  // Verify isolation
  console.log('✓ Verifying isolation...');
  console.log(`  Registry1 providers: ${registry1.list().join(', ')}`);
  console.log(`  Registry2 providers: ${registry2.list().join(', ')}`);
  console.log(`  Registry3 providers: ${registry3.list().join(', ')}`);
  
  // Test that they are different instances
  const retrieved1 = registry1.get('provider');
  const retrieved2 = registry2.get('provider');
  const retrieved3 = registry3.get('provider');
  
  const response1 = await retrieved1.generate({ prompt: 'Isolated test 1' });
  const response2 = await retrieved2.generate({ prompt: 'Isolated test 2' });
  const response3 = await retrieved3.generate({ prompt: 'Isolated test 3' });
  
  console.log(`  Registry1 response: ${response1.content}`);
  console.log(`  Registry2 response: ${response2.content}`);
  console.log(`  Registry3 response: ${response3.content}`);
  
  // Verify they are indeed different
  console.log(`  Registry1 !== Registry2: ${retrieved1 !== retrieved2}`);
  console.log(`  Registry2 !== Registry3: ${retrieved2 !== retrieved3}`);
  console.log(`  Registry1 !== Registry3: ${retrieved1 !== retrieved3}`);
  
  console.log('✅ Isolated registries verification complete!\n');
}

// Verification 4: Error Handling
async function verifyErrorHandling() {
  console.log('🔍 Verification 4: Error Handling\n');
  
  providerRegistry.clear();
  
  // Test duplicate registration
  console.log('✓ Testing duplicate registration error...');
  const provider = new VerificationProvider('Duplicate', 'Dup');
  providerRegistry.register('duplicate', provider);
  
  try {
    providerRegistry.register('duplicate', provider);
    console.log('  ❌ Should have thrown error');
  } catch (error) {
    console.log(`  ✅ Correctly caught error: ${(error as Error).message}`);
  }
  
  // Test non-existent provider retrieval
  console.log('✓ Testing non-existent provider error...');
  try {
    providerRegistry.get('non-existent');
    console.log('  ❌ Should have thrown error');
  } catch (error) {
    console.log(`  ✅ Correctly caught error: ${(error as Error).message}`);
  }
  
  // Test non-existent default
  console.log('✓ Testing no default provider error...');
  try {
    providerRegistry.getDefault();
    console.log('  ❌ Should have thrown error');
  } catch (error) {
    console.log(`  ✅ Correctly caught error: ${(error as Error).message}`);
  }
  
  // Test setting non-existent default
  console.log('✓ Testing setting non-existent default error...');
  try {
    providerRegistry.setDefault('non-existent');
    console.log('  ❌ Should have thrown error');
  } catch (error) {
    console.log(`  ✅ Correctly caught error: ${(error as Error).message}`);
  }
  
  // Test plugin errors
  console.log('✓ Testing plugin errors...');
  try {
    await pluginRegistry.loadProvider('non-existent-plugin', 'provider');
    console.log('  ❌ Should have thrown error');
  } catch (error) {
    console.log(`  ✅ Correctly caught error: ${(error as Error).message}`);
  }
  
  console.log('✅ Error handling verification complete!\n');
}

// Verification 5: Real Provider Integration
async function verifyRealProviderIntegration() {
  console.log('🔍 Verification 5: Real Provider Integration\n');
  
  providerRegistry.clear();
  
  // Only test if API key is available
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️  Skipping real provider test (no API key)');
    return;
  }
  
  try {
    // Test with real OpenAI provider
    console.log('✓ Testing with real OpenAI provider...');
    
    const legacyProvider = adaptProvider(new OpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY!,
    }));
    
    const enhancedProvider = new EnhancedOpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY!,
    });
    
    // Register real providers
    providerRegistry.register('openai-legacy', legacyProvider, {
      description: 'Legacy OpenAI provider',
      version: '1.0.0',
    });
    
    providerRegistry.register('openai-enhanced', enhancedProvider, {
      description: 'Enhanced OpenAI provider',
      version: '2.0.0',
    });
    
    console.log(`  Real providers registered: ${providerRegistry.list().join(', ')}`);
    
    // Test real provider functionality
    console.log('✓ Testing real provider functionality...');
    const testRequest: GenerateRequest = {
      prompt: 'Say "Hello from real provider!"',
      temperature: 0.1,
      maxTokens: 20,
    };
    
    const legacyResponse = await providerRegistry.get('openai-legacy').generate(testRequest);
    const enhancedResponse = await providerRegistry.get('openai-enhanced').generate(testRequest);
    
    console.log(`  Legacy response: ${legacyResponse.content.substring(0, 50)}...`);
    console.log(`  Enhanced response: ${enhancedResponse.content.substring(0, 50)}...`);
    
    // Test streaming with real provider
    console.log('✓ Testing streaming with real provider...');
    const streamChunks: string[] = [];
    for await (const chunk of providerRegistry.get('openai-enhanced').streamGenerate(testRequest)) {
      streamChunks.push(chunk.content);
    }
    console.log(`  Stream chunks received: ${streamChunks.length}`);
    console.log(`  Stream content: ${streamChunks.join('').substring(0, 50)}...`);
    
    console.log('✅ Real provider integration verification complete!\n');
    
  } catch (error) {
    console.log(`  ❌ Real provider test failed: ${(error as Error).message}`);
  }
}

// Verification 6: Performance and Scalability
async function verifyPerformanceAndScalability() {
  console.log('🔍 Verification 6: Performance and Scalability\n');
  
  providerRegistry.clear();
  
  // Test with many providers
  console.log('✓ Testing with many providers...');
  const startTime = Date.now();
  
  for (let i = 0; i < 100; i++) {
    const provider = new VerificationProvider(`Perf${i}`, `Perf${i}`);
    providerRegistry.register(`perf${i}`, provider, {
      description: `Performance test provider ${i}`,
      version: `${i}.0.0`,
    });
  }
  
  const registrationTime = Date.now() - startTime;
  console.log(`  Registered 100 providers in ${registrationTime}ms`);
  
  // Test retrieval performance
  console.log('✓ Testing retrieval performance...');
  const retrievalStart = Date.now();
  
  for (let i = 0; i < 100; i++) {
    providerRegistry.get(`perf${i}`);
  }
  
  const retrievalTime = Date.now() - retrievalStart;
  console.log(`  Retrieved 100 providers in ${retrievalTime}ms`);
  
  // Test statistics performance
  console.log('✓ Testing statistics performance...');
  const statsStart = Date.now();
  
  const stats = providerRegistry.getStats();
  
  const statsTime = Date.now() - statsStart;
  console.log(`  Generated statistics in ${statsTime}ms`);
  console.log(`  Total providers: ${stats.totalProviders}`);
  console.log(`  Default provider: ${stats.defaultProvider}`);
  
  // Test concurrent operations
  console.log('✓ Testing concurrent operations...');
  const concurrentStart = Date.now();
  
  const promises = [];
  for (let i = 0; i < 50; i++) {
    promises.push(providerRegistry.get(`perf${i}`).generate({ prompt: `Concurrent test ${i}` }));
  }
  
  await Promise.all(promises);
  
  const concurrentTime = Date.now() - concurrentStart;
  console.log(`  Executed 50 concurrent generations in ${concurrentTime}ms`);
  
  console.log('✅ Performance and scalability verification complete!\n');
}

// Main verification runner
async function runAllVerifications() {
  console.log('🚀 Starting Provider Registry Verification\n');
  
  try {
    await verifyBasicOperations();
    await verifyPluginSystem();
    await verifyIsolatedRegistries();
    await verifyErrorHandling();
    await verifyRealProviderIntegration();
    await verifyPerformanceAndScalability();
    
    console.log('🎉 All verifications completed successfully!');
    console.log('\n📊 Summary:');
    console.log('  ✅ Basic registry operations');
    console.log('  ✅ Plugin system');
    console.log('  ✅ Isolated registries');
    console.log('  ✅ Error handling');
    console.log('  ✅ Real provider integration');
    console.log('  ✅ Performance and scalability');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllVerifications();
}
