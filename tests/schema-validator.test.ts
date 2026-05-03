import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validateSchema } from '../src/validators/schema-validator.js';

describe('Schema Validator', () => {
  describe('validateSchema', () => {
    it('should validate successful schema', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const data = { name: 'John', age: 30 };
      const result = validateSchema(schema, data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(data);
      }
    });

    it('should return error for schema mismatch', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const data = { name: 'John', age: 'thirty' }; // wrong type
      const result = validateSchema(schema, data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('SCHEMA_VALIDATION_ERROR');
        expect(result.error.validationIssues).toBeDefined();
      }
    });

    it('should handle missing required fields', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const data = { name: 'John' }; // missing age
      const result = validateSchema(schema, data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('SCHEMA_VALIDATION_ERROR');
      }
    });

    it('should handle nested object validation', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string().email(),
        }),
      });
      const data = { user: { name: 'John', email: 'invalid' } };
      const result = validateSchema(schema, data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.validationIssues).toBeDefined();
      }
    });

    it('should handle array validation', () => {
      const schema = z.array(z.number());
      const data = [1, 2, 'three'];
      const result = validateSchema(schema, data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('SCHEMA_VALIDATION_ERROR');
      }
    });

    it('should handle invalid arrays', () => {
      const schema = z.object({
        items: z.array(z.string()),
      });
      const data = { items: [1, 2, 3] }; // wrong types in array
      const result = validateSchema(schema, data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.validationIssues).toBeDefined();
      }
    });
  });
});
