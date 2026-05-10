/**
 * Example usage of Middleware system
 */

import { MiddlewareManager } from '../src/middleware/index.js';
import { OpenAIProvider } from '../src/providers/openai.js';
import { GeminiProvider } from '../src/providers/gemini.js';

// Initialize providers
const openai = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-key',
  defaultModel: 'gpt-4o-mini',
});

const gemini = new GeminiProvider({
  apiKey: process.env.GEMINI_API_KEY || 'your-gemini-key',
  defaultModel: 'gemini-1.5-flash',
});

// Example 1: Basic middleware setup
async function basicMiddlewareExample() {
  console.log('=== Basic Middleware Example ===');
  
  const middleware = new MiddlewareManager()
    .addBeforeRequest({
      name: 'logging',
      order: 1,
      handler: async (context, next) => {
        console.log('🔵 Before Request:', context.request.prompt);
        return next();
      },
    })
    .addAfterResponse({
      name: 'response-logging',
      order: 1,
      handler: async (context, next) => {
        console.log('🟢 After Response:', context.response?.content?.substring(0, 50) + '...');
        return next();
      },
    })
    .addValidationError({
      name: 'error-logging',
      order: 1,
      handler: async (context, next) => {
        console.log('🔴 Validation Error:', context.error?.message);
        return next();
      },
    });

  try {
    // Execute before request middleware
    const { request, metadata } = await middleware.executeBeforeRequest({
      prompt: 'What is the capital of France?',
      temperature: 0.3,
      maxTokens: 100,
    });

    console.log('✅ Modified request:', request);
    console.log('📊 Metadata:', metadata);

    // Simulate response
    const mockResponse = {
      id: 'test-id',
      content: 'The capital of France is Paris.',
      model: 'test-model',
      finishReason: 'stop' as const,
    };

    // Execute after response middleware
    const finalResponse = await middleware.executeAfterResponse(request, mockResponse, metadata);
    console.log('✅ Final response:', finalResponse.content);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Example 2: Request transformation middleware
async function requestTransformationExample() {
  console.log('\n=== Request Transformation Example ===');
  
  const middleware = new MiddlewareManager()
    .addBeforeRequest({
      name: 'add-system-prompt',
      order: 1,
      handler: async (context, next) => {
        const currentPrompt = context.request.prompt;
        
        // Add system prompt if not present
        if (typeof currentPrompt === 'string') {
          context.request.prompt = [
            { role: 'system', content: 'You are a helpful assistant. Be concise.' },
            { role: 'user', content: currentPrompt }
          ];
        }
        
        console.log('📝 Added system prompt');
        return next();
      },
    })
    .addBeforeRequest({
      name: 'rate-limiter',
      order: 2,
      handler: async (context, next) => {
        // Simulate rate limiting
        const now = Date.now();
        const lastRequest = context.metadata.lastRequestTime || 0;
        
        if (now - lastRequest < 1000) {
          console.log('⏱️ Rate limiting - waiting...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        context.metadata.lastRequestTime = now;
        return next();
      },
    });

  try {
    const { request } = await middleware.executeBeforeRequest({
      prompt: 'Explain quantum computing.',
      temperature: 0.7,
      maxTokens: 200,
    });

    console.log('✅ Transformed request type:', typeof request.prompt);
    if (Array.isArray(request.prompt)) {
      console.log('📋 System prompt added:', request.prompt[0]?.content);
      console.log('👤 User prompt:', request.prompt[1]?.content);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Example 3: Response filtering middleware
async function responseFilteringExample() {
  console.log('\n=== Response Filtering Example ===');
  
  const middleware = new MiddlewareManager()
    .addAfterResponse({
      name: 'content-filter',
      order: 1,
      handler: async (context, next) => {
        let content = context.response?.content || '';
        
        // Filter out sensitive information
        content = content.replace(/\b\d{4}-\d{4}-\d{4}-\d{4}\b/g, '[REDACTED_CARD]');
        content = content.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]');
        
        if (context.response) {
          context.response.content = content;
        }
        
        console.log('🔒 Applied content filters');
        return next();
      },
    })
    .addAfterResponse({
      name: 'response-validator',
      order: 2,
      handler: async (context, next) => {
        const content = context.response?.content || '';
        
        // Validate response length
        if (content.length > 1000) {
          console.log('⚠️ Response too long, truncating...');
          if (context.response) {
            context.response.content = content.substring(0, 1000) + '...';
          }
        }
        
        // Check for required content
        if (!content.includes('answer') && !content.includes('explain')) {
          console.log('⚠️ Response missing expected content');
        }
        
        return next();
      },
    });

  try {
    const mockResponse = {
      id: 'test-id',
      content: 'Here is my email: user@example.com and card: 1234-5678-9012-3456. The answer is 42.',
      model: 'test-model',
      finishReason: 'stop' as const,
    };

    const filteredResponse = await middleware.executeAfterResponse(
      { prompt: 'test', temperature: 0.5, maxTokens: 500 },
      mockResponse,
      {}
    );

    console.log('✅ Filtered response:', filteredResponse.content);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Example 4: Error handling middleware
async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===');
  
  const middleware = new MiddlewareManager()
    .addValidationError({
      name: 'error-reporter',
      order: 1,
      handler: async (context, next) => {
        console.log('🚨 Error Reporter:', {
          error: context.error?.message,
          request: context.request.prompt,
          timestamp: new Date().toISOString(),
        });
        
        // Store error for analytics
        context.metadata.errorReported = true;
        return next();
      },
    })
    .addValidationError({
      name: 'fallback-trigger',
      order: 2,
      handler: async (context, next) => {
        if (context.error?.message.includes('timeout')) {
          console.log('⏰ Timeout detected, triggering fallback...');
          context.metadata.shouldFallback = true;
        }
        
        return next();
      },
    });

  try {
    const testError = new Error('Request timeout occurred');
    
    await middleware.executeValidationError(
      { prompt: 'test', temperature: 0.5, maxTokens: 500 },
      testError,
      {}
    );

    console.log('✅ Error middleware executed successfully');
  } catch (error) {
    console.error('❌ Error in error handling:', error);
  }
}

// Example 5: Composable middleware chains
async function composableMiddlewareExample() {
  console.log('\n=== Composable Middleware Example ===');
  
  const middleware = new MiddlewareManager()
    // Authentication middleware
    .addBeforeRequest({
      name: 'auth',
      order: 1,
      handler: async (context, next) => {
        context.metadata.authenticated = true;
        context.metadata.userId = 'user-123';
        console.log('🔐 Authentication check passed');
        return next();
      },
    })
    // Caching middleware
    .addBeforeRequest({
      name: 'cache',
      order: 2,
      handler: async (context, next) => {
        const cacheKey = JSON.stringify(context.request);
        context.metadata.cacheKey = cacheKey;
        
        // Simulate cache hit
        if (cacheKey.includes('capital')) {
          console.log('💾 Cache hit for capital query');
          context.request.prompt = 'The capital of France is Paris (cached).';
        }
        
        return next();
      },
    })
    // Analytics middleware
    .addAfterResponse({
      name: 'analytics',
      order: 1,
      handler: async (context, next) => {
        const analytics = {
          userId: context.metadata.userId,
          model: context.response?.model,
          tokens: context.response?.usage?.totalTokens || 0,
          timestamp: Date.now(),
        };
        
        console.log('📊 Analytics recorded:', analytics);
        return next();
      },
    });

  try {
    const { request, metadata } = await middleware.executeBeforeRequest({
      prompt: 'What is the capital of France?',
      temperature: 0.3,
      maxTokens: 100,
    });

    console.log('🔗 Composed metadata:', metadata);

    const mockResponse = {
      id: 'test-id',
      content: 'The capital of France is Paris (cached).',
      model: 'test-model',
      finishReason: 'stop' as const,
      usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
    };

    const finalResponse = await middleware.executeAfterResponse(request, mockResponse, metadata);
    console.log('✅ Composed response:', finalResponse.content);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Example 6: Middleware management
async function middlewareManagementExample() {
  console.log('\n=== Middleware Management Example ===');
  
  const middleware = new MiddlewareManager()
    .addBeforeRequest({
      name: 'test-middleware-1',
      order: 1,
      handler: async (context, next) => {
        console.log('🧪 Test Middleware 1 executed');
        return next();
      },
    })
    .addBeforeRequest({
      name: 'test-middleware-2',
      order: 2,
      handler: async (context, next) => {
        console.log('🧪 Test Middleware 2 executed');
        return next();
      },
    });

  console.log('📋 Initial enabled middleware:', middleware.getEnabledMiddleware());

  // Disable a middleware
  middleware.setMiddlewareEnabled('test-middleware-1', false);
  console.log('📋 After disabling test-middleware-1:', middleware.getEnabledMiddleware());

  // Remove a middleware
  middleware.removeMiddleware('test-middleware-2');
  console.log('📋 After removing test-middleware-2:', middleware.getEnabledMiddleware());

  // Clear all middleware
  middleware.clear();
  console.log('📋 After clearing all:', middleware.getEnabledMiddleware());
}

// Run all examples
async function main() {
  await basicMiddlewareExample();
  await requestTransformationExample();
  await responseFilteringExample();
  await errorHandlingExample();
  await composableMiddlewareExample();
  await middlewareManagementExample();
}

main().catch(console.error);
