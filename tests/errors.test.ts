import { describe, it, expect } from 'vitest';
import { success, error, isError, isSuccess, unwrap, OpenGuardError, type OpenGuardResult } from '../src/errors.js';

describe('Error Handling', () => {
  describe('success and error helpers', () => {
    it('should create success result', () => {
      const result = success({ key: 'value' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ key: 'value' });
      }
    });

    it('should create error result', () => {
      const result = error('TEST_ERROR', 'Test message');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('TEST_ERROR');
        expect(result.error.message).toBe('Test message');
        expect(result.error.timestamp).toBeDefined();
      }
    });

    it('should include additional error details', () => {
      const result = error('TEST_ERROR', 'Test message', {
        retries: 3,
        originalResponse: 'bad json',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.retries).toBe(3);
        expect(result.error.originalResponse).toBe('bad json');
      }
    });
  });

  describe('type guards', () => {
    it('should identify error results', () => {
      const errorResult = error('TEST', 'message');
      expect(isError(errorResult)).toBe(true);
      expect(isSuccess(errorResult)).toBe(false);
    });

    it('should identify success results', () => {
      const successResult = success('data');
      expect(isSuccess(successResult)).toBe(true);
      expect(isError(successResult)).toBe(false);
    });
  });

  describe('unwrap', () => {
    it('should return data for success result', () => {
      const result = success('data');
      expect(unwrap(result)).toBe('data');
    });

    it('should throw for error result', () => {
      const result = error('TEST', 'message');
      expect(() => unwrap(result)).toThrow(OpenGuardError);
    });
  });

  describe('OpenGuardError', () => {
    it('should create error with details', () => {
      const details = {
        type: 'SCHEMA_VALIDATION_ERROR' as const,
        message: 'Validation failed',
        timestamp: Date.now(),
        retries: 2,
      };
      const err = new OpenGuardError(details);
      expect(err.message).toBe('Validation failed');
      expect(err.details).toEqual(details);
      expect(err.toJSON()).toEqual(details);
    });
  });
});
