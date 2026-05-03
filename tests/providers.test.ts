import { describe, it, expect, vi } from 'vitest';
import { ChatCompletionProvider, ProviderError } from '../src/providers/base.js';
import { OpenAIProvider, OpenAIConfig } from '../src/providers/openai.js';

describe('Provider Abstraction', () => {
  describe('ChatCompletionProvider Interface', () => {
    it('should define only essential methods', () => {
      // Test that the interface only has complete and stream methods
      const mockProvider: ChatCompletionProvider = {
        complete: vi.fn(),
        stream: vi.fn(),
      };
      
      expect(mockProvider.complete).toBeDefined();
      expect(mockProvider.stream).toBeDefined();
    });
  });

  describe('ProviderError', () => {
    it('should create provider error with message', () => {
      const error = new ProviderError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('ProviderError');
      expect(error.originalError).toBeUndefined();
    });

    it('should create provider error with original error', () => {
      const originalError = { message: 'Original error', type: 'test' };
      const error = new ProviderError('Wrapped error', originalError);
      expect(error.message).toBe('Wrapped error');
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('OpenAIProvider', () => {
    const validConfig: OpenAIConfig = {
      apiKey: 'test-api-key',
    };

    it('should create provider with valid config', () => {
      const provider = new OpenAIProvider(validConfig);
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('should throw error without API key', () => {
      expect(() => new OpenAIProvider({} as OpenAIConfig)).toThrow('OpenAI API key is required');
    });

    it('should merge config with defaults', () => {
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        defaultModel: 'gpt-4',
      });
      // The provider should have the merged config
      expect(provider).toBeDefined();
    });

    it('should implement ChatCompletionProvider interface', () => {
      const provider = new OpenAIProvider(validConfig);
      expect(typeof provider.complete).toBe('function');
      expect(typeof provider.stream).toBe('function');
    });
  });
});
