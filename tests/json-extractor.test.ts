import { describe, it, expect } from 'vitest';
import { extractJsonFromMarkdown, extractAllJsonFromMarkdown, extractJsonFromMarkdownSafe } from '../src/utils/json-extractor.js';

describe('JSON Extraction', () => {
  describe('extractJsonFromMarkdown', () => {
    it('should extract JSON from markdown code blocks with json specifier', () => {
      const input = 'Here is the result:\n```json\n{"key": "value"}\n```';
      const result = extractJsonFromMarkdown(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ key: 'value' });
      }
    });

    it('should extract JSON from markdown code blocks without specifier', () => {
      const input = 'Here is the result:\n```\n{"key": "value"}\n```';
      const result = extractJsonFromMarkdown(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ key: 'value' });
      }
    });

    it('should extract JSON from single backticks', () => {
      const input = 'Result: `{"key": "value"}`';
      const result = extractJsonFromMarkdown(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ key: 'value' });
      }
    });

    it('should parse plain JSON without markdown', () => {
      const input = '{"key": "value"}';
      const result = extractJsonFromMarkdown(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ key: 'value' });
      }
    });

    it('should return error for invalid JSON', () => {
      const input = 'Not JSON at all';
      const result = extractJsonFromMarkdown(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('JSON_PARSE_ERROR');
      }
    });

    it('should handle arrays', () => {
      const input = '```json\n[1, 2, 3]\n```';
      const result = extractJsonFromMarkdown<number[]>(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([1, 2, 3]);
      }
    });

    it('should handle nested objects', () => {
      const input = '```json\n{"user": {"name": "John", "age": 30}}\n```';
      const result = extractJsonFromMarkdown(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ user: { name: 'John', age: 30 } });
      }
    });
  });

  describe('extractAllJsonFromMarkdown', () => {
    it('should extract multiple JSON blocks', () => {
      const input = 'First:\n```json\n{"id": 1}\n```\nSecond:\n```json\n{"id": 2}\n```';
      const result = extractAllJsonFromMarkdown(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([{ id: 1 }, { id: 2 }]);
      }
    });

    it('should return error if no JSON blocks found', () => {
      const input = 'No JSON here';
      const result = extractAllJsonFromMarkdown(input);
      expect(result.success).toBe(false);
    });

    it('should skip invalid JSON blocks', () => {
      const input = 'Valid:\n```json\n{"id": 1}\n```\nInvalid:\n```json\nnot json\n```';
      const result = extractAllJsonFromMarkdown(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([{ id: 1 }]);
      }
    });
  });

  describe('extractJsonFromMarkdownSafe', () => {
    it('should return fallback on error', () => {
      const input = 'Not JSON';
      const fallback = { default: true };
      const result = extractJsonFromMarkdownSafe(input, fallback);
      expect(result).toEqual(fallback);
    });

    it('should return parsed data on success', () => {
      const input = '{"key": "value"}';
      const fallback = { default: true };
      const result = extractJsonFromMarkdownSafe(input, fallback);
      expect(result).toEqual({ key: 'value' });
    });
  });
});
