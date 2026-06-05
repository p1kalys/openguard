/**
 * JSON repair utilities for OpenGuard
 *
 * Attempts to fix common LLM JSON output issues:
 *  - Trailing commas in objects and arrays
 *  - Single-quoted strings
 *  - Unquoted object keys
 *  - JavaScript-style comments
 *  - Missing closing braces / brackets
 *  - Consecutive commas
 */

import { success, error, type OpenGuardResult } from '../errors/result.js';

/**
 * Attempt to repair a malformed JSON string.
 *
 * @returns OpenGuardResult<string> where data is the repaired JSON *string*
 *          (not yet parsed). Use repairAndParseJson to get the parsed value.
 */
export function repairJson(input: string): OpenGuardResult<string> {
  try {
    // Fast path: already valid
    JSON.parse(input);
    return success(input);
  } catch {
    // fall through to repair
  }

  let s = input;

  // 1. Remove // line comments
  s = s.replace(/\/\/[^\n\r]*/g, '');

  // 2. Remove /* block comments */
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');

  // 3. Fix single-quoted strings → double-quoted strings
  //    Matches 'text' where text may contain escaped single quotes (\')
  //    but does NOT contain unescaped double quotes (to avoid breaking "it's")
  s = s.replace(/'((?:[^'\\]|\\.)*)'/g, (_, inner) => {
    // Unescape \' → ' and escape any bare " inside
    const fixed = inner.replace(/\\'/g, "'").replace(/"/g, '\\"');
    return `"${fixed}"`;
  });

  // 4. Quote unquoted object keys  (word chars directly before a colon)
  //    Only applies to tokens that are directly after { or , and before :
  s = s.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3');

  // 5. Remove trailing commas before } or ]
  s = s.replace(/,(\s*[}\]])/g, '$1');

  // 6. Collapse consecutive commas  ,, → ,
  s = s.replace(/,(\s*,)+/g, ',');

  // 7. Balance unclosed braces
  const openBraces = (s.match(/\{/g) ?? []).length;
  const closeBraces = (s.match(/\}/g) ?? []).length;
  if (openBraces > closeBraces) s += '}'.repeat(openBraces - closeBraces);

  // 8. Balance unclosed brackets
  const openBrackets = (s.match(/\[/g) ?? []).length;
  const closeBrackets = (s.match(/\]/g) ?? []).length;
  if (openBrackets > closeBrackets) s += ']'.repeat(openBrackets - closeBrackets);

  try {
    JSON.parse(s);
    return success(s);
  } catch {
    return error('JSON_REPAIR_ERROR', `Unable to repair JSON: ${input.slice(0, 60)}`);
  }
}

/**
 * Repair and parse JSON, returning the parsed object.
 * On failure returns a typed fallback value.
 */
export function repairJsonSafe<T>(input: string, fallback: T): T {
  const repaired = repairJson(input);
  if (!repaired.success) return fallback;
  try {
    return JSON.parse(repaired.data) as T;
  } catch {
    return fallback;
  }
}

/**
 * Repair and parse JSON in one step.
 *
 * @returns OpenGuardResult<T> where data is the *parsed* object.
 */
export function repairAndParseJson<T = unknown>(input: string): OpenGuardResult<T> {
  const repaired = repairJson(input);
  if (!repaired.success) return repaired;
  try {
    return success(JSON.parse(repaired.data) as T);
  } catch {
    return error('JSON_REPAIR_ERROR', `Repaired string is not parseable: ${repaired.data.slice(0, 60)}`);
  }
}
