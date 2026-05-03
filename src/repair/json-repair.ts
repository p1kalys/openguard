/**
 * JSON repair utilities for common LLM formatting mistakes
 */

import { error, OpenGuardResult } from '../errors.js';

/**
 * Common JSON repair strategies for LLM-generated content
 */
export interface RepairOptions {
  /**
   * Replace single quotes with double quotes
   */
  fixSingleQuotes?: boolean;
  /**
   * Remove trailing commas
   */
  fixTrailingCommas?: boolean;
  /**
   * Add quotes around unquoted property names
   */
  fixUnquotedKeys?: boolean;
  /**
   * Remove JavaScript-style comments
   */
  removeComments?: boolean;
  /**
   * Attempt to fix missing closing braces/brackets
   */
  fixMissingBraces?: boolean;
  /**
   * Unescape common escape sequences
   */
  fixEscapeSequences?: boolean;
}

const defaultOptions: RepairOptions = {
  fixSingleQuotes: true,
  fixTrailingCommas: true,
  fixUnquotedKeys: true,
  removeComments: true,
  fixMissingBraces: true,
  fixEscapeSequences: true,
};

/**
 * Repair malformed JSON commonly produced by LLMs
 *
 * @param input - The potentially malformed JSON string
 * @param options - Repair strategy options
 * @returns Repaired JSON string
 */
export function repairJson(
  input: string,
  options: RepairOptions = {}
): OpenGuardResult<string> {
  const opts = { ...defaultOptions, ...options };
  let repaired = input.trim();
  const original = input;

  // Remove comments (both // and /* */ style)
  if (opts.removeComments) {
    repaired = repaired
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
  }

  // Fix single quotes to double quotes
  if (opts.fixSingleQuotes) {
    repaired = repaired.replace(/'/g, '"');
  }

  // Fix unquoted property names
  if (opts.fixUnquotedKeys) {
    // Match unquoted keys (word characters before colon)
    repaired = repaired.replace(
      /(\s*)(\w+)(\s*):/g,
      '$1"$2"$3:'
    );
  }

  // Fix trailing commas in objects and arrays
  if (opts.fixTrailingCommas) {
    repaired = repaired
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/,(\s*)$/gm, '$1')
      // Fix double commas in arrays
      .replace(/,,+/g, ',');
  }

  // Fix escape sequences (common issues)
  if (opts.fixEscapeSequences) {
    // Fix double-escaped quotes
    repaired = repaired.replace(/\\"/g, '"');
    // Fix escaped backslashes
    repaired = repaired.replace(/\\\\/g, '\\');
  }

  // Attempt to fix missing closing braces/brackets
  if (opts.fixMissingBraces) {
    const openBraces = (repaired.match(/{/g) || []).length;
    const closeBraces = (repaired.match(/}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;

    // Add missing closing braces
    for (let i = 0; i < openBraces - closeBraces; i++) {
      repaired += '}';
    }

    // Add missing closing brackets
    for (let i = 0; i < openBrackets - closeBrackets; i++) {
      repaired += ']';
    }
  }

  // Validate the repaired JSON
  try {
    JSON.parse(repaired);
  } catch (parseError) {
    return error(
      'JSON_REPAIR_ERROR',
      `Failed to repair JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
      { originalResponse: original, repairedResponse: repaired }
    );
  }

  return { success: true, data: repaired };
}

/**
 * Safely repair JSON with a fallback value
 *
 * @param input - The potentially malformed JSON string
 * @param fallback - The fallback value to return if repair fails
 * @param options - Repair strategy options
 * @returns Reparsed JSON object or fallback value
 */
export function repairJsonSafe<T = unknown>(
  input: string,
  fallback: T,
  options?: RepairOptions
): T {
  const repairResult = repairJson(input, options);
  if (!repairResult.success) {
    return fallback;
  }
  try {
    return JSON.parse(repairResult.data) as T;
  } catch {
    return fallback;
  }
}

/**
 * Attempt to repair and parse JSON in one step
 *
 * @param input - The potentially malformed JSON string
 * @param options - Repair strategy options
 * @returns Parsed JSON object
 */
export function repairAndParseJson<T = unknown>(
  input: string,
  options?: RepairOptions
): OpenGuardResult<T> {
  const repairResult = repairJson(input, options);
  if (!repairResult.success) {
    return repairResult as OpenGuardResult<T>;
  }
  try {
    return { success: true, data: JSON.parse(repairResult.data) as T };
  } catch (parseError) {
    return error(
      'JSON_PARSE_ERROR',
      `Failed to parse repaired JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
      { originalResponse: input, repairedResponse: repairResult.data }
    );
  }
}
