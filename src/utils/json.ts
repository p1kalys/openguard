/**
 * JSON extraction utilities for LLM responses
 */

import { error, OpenGuardResult } from '../errors/result.js';

/**
 * Extract valid JSON from markdown-wrapped LLM responses.
 * Handles various markdown code block formats with or without language specifiers.
 *
 * @param input - The input string containing markdown-wrapped JSON
 * @returns The parsed JSON object
 * @throws Error if no valid JSON is found
 */
export function extractJsonFromMarkdown<T = unknown>(input: string): OpenGuardResult<T> {
  // Try to extract from markdown code blocks first
  const markdownPatterns = [
    // ```json ... ```
    /```(?:json)?\s*\n?([\s\S]*?)\n?```/i,
    // ``` ... ```
    /```\s*\n?([\s\S]*?)\n?```/i,
    // `...` (single backticks, less common but possible)
    /`([^`]+)`/i,
  ];

  for (const pattern of markdownPatterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      try {
        return { success: true, data: JSON.parse(match[1].trim()) as T };
      } catch {
        // Continue to next pattern if parsing fails
        continue;
      }
    }
  }

  // If no markdown blocks found, try parsing the entire string
  try {
    return { success: true, data: JSON.parse(input.trim()) as T };
  } catch (e) {
    return error(
      'JSON_PARSE_ERROR',
      'No valid JSON found in the input',
      { originalResponse: input }
    );
  }
}

/**
 * Extract all JSON objects from markdown-wrapped LLM responses.
 * Useful when the response contains multiple JSON blocks.
 *
 * @param input - The input string containing markdown-wrapped JSON
 * @returns Array of parsed JSON objects
 */
export function extractAllJsonFromMarkdown<T = unknown>(input: string): OpenGuardResult<T[]> {
  const results: T[] = [];

  // Match all markdown code blocks
  const blockPattern = /```(?:json)?\s*\n?([\s\S]*?)\n?```/gi;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(input)) !== null) {
    if (match[1]) {
      try {
        results.push(JSON.parse(match[1].trim()) as T);
      } catch {
        // Skip invalid JSON blocks
        continue;
      }
    }
  }

  if (results.length === 0) {
    return error(
      'JSON_PARSE_ERROR',
      'No valid JSON blocks found in the input',
      { originalResponse: input }
    );
  }

  return { success: true, data: results };
}

/**
 * Safely extract JSON from markdown with a fallback value.
 *
 * @param input - The input string containing markdown-wrapped JSON
 * @param fallback - The fallback value to return if extraction fails
 * @returns The parsed JSON object or the fallback value
 */
export function extractJsonFromMarkdownSafe<T = unknown>(
  input: string,
  fallback: T
): T {
  const result = extractJsonFromMarkdown<T>(input);
  return result.success ? result.data : fallback;
}
