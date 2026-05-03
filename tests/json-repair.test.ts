import { describe, it, expect } from 'vitest';
import { repairJson, repairJsonSafe, repairAndParseJson } from '../src/repair/json-repair.js';

describe('JSON Repair', () => {
  describe('repairJson', () => {
    it('should fix trailing commas in objects', () => {
      const input = '{"key": "value",}';
      const result = repairJson(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('{"key": "value"}');
      }
    });

    it('should fix trailing commas in arrays', () => {
      const input = '[1, 2, 3,]';
      const result = repairJson(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('[1, 2, 3]');
      }
    });

    it('should fix single quotes to double quotes', () => {
      const input = "{'key': 'value'}";
      const result = repairJson(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('{"key": "value"}');
      }
    });

    it('should fix unquoted property names', () => {
      const input = '{name: "John", age: 30}';
      const result = repairJson(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('{"name": "John", "age": 30}');
      }
    });

    it('should remove JavaScript-style comments', () => {
      const input = '{\n  // comment\n  "key": "value"\n}';
      const result = repairJson(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toContain('"key": "value"');
        expect(result.data).not.toContain('comment');
      }
    });

    it('should fix missing closing braces', () => {
      const input = '{"key": "value"';
      const result = repairJson(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('{"key": "value"}');
      }
    });

    it('should fix missing closing brackets', () => {
      const input = '[1, 2, 3';
      const result = repairJson(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('[1, 2, 3]');
      }
    });

    it('should fix multiple issues at once', () => {
      const input = "{name: 'John', age: 30,}";
      const result = repairJson(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const parsed = JSON.parse(result.data);
        expect(parsed).toEqual({ name: 'John', age: 30 });
      }
    });

    it('should return error for unrepairable JSON', () => {
      const input = 'totally broken { not json';
      const result = repairJson(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('JSON_REPAIR_ERROR');
      }
    });

    it('should handle invalid arrays', () => {
      const input = '[1, 2,, 3]';
      const result = repairJson(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const parsed = JSON.parse(result.data);
        expect(parsed).toEqual([1, 2, 3]);
      }
    });
  });

  describe('repairJsonSafe', () => {
    it('should return fallback on error', () => {
      const input = 'unrepairable';
      const fallback = { default: true };
      const result = repairJsonSafe(input, fallback);
      expect(result).toEqual(fallback);
    });

    it('should return parsed data on success', () => {
      const input = "{'key': 'value'}";
      const fallback = { default: true };
      const result = repairJsonSafe(input, fallback);
      expect(result).toEqual({ key: 'value' });
    });
  });

  describe('repairAndParseJson', () => {
    it('should repair and parse in one step', () => {
      const input = "{'key': 'value'}";
      const result = repairAndParseJson(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ key: 'value' });
      }
    });

    it('should return error if repair fails', () => {
      const input = 'broken';
      const result = repairAndParseJson(input);
      expect(result.success).toBe(false);
    });
  });
});
