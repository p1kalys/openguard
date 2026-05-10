/**
 * Guardrails utilities for OpenGuard
 */

import type { GenerateResponse } from '../providers/base.js';

/**
 * Guardrail result
 */
export interface GuardrailResult {
  /** Whether guardrail check passed */
  passed: boolean;
  /** Reason for failure */
  reason?: string;
  /** Severity level */
  severity?: 'low' | 'medium' | 'high';
  /** Additional details */
  details?: Record<string, any>;
}

/**
 * Guardrail interface
 */
export interface Guardrail {
  /** Check response against guardrail */
  check(response: GenerateResponse): GuardrailResult;
}

/**
 * Content length guardrail
 */
export class LengthGuardrail implements Guardrail {
  constructor(
    private minLength: number = 0,
    private maxLength: number = 10000
  ) {}

  check(response: GenerateResponse): GuardrailResult {
    const content = response.content || '';
    const length = content.length;

    if (length < this.minLength) {
      return {
        passed: false,
        reason: `Content too short: ${length} < ${this.minLength}`,
        severity: 'low',
      };
    }

    if (length > this.maxLength) {
      return {
        passed: false,
        reason: `Content too long: ${length} > ${this.maxLength}`,
        severity: 'medium',
      };
    }

    return { passed: true };
  }
}

/**
 * Keyword guardrail
 */
export class KeywordGuardrail implements Guardrail {
  constructor(
    private blockedKeywords: string[],
    private severity: 'low' | 'medium' | 'high' = 'medium'
  ) {}

  check(response: GenerateResponse): GuardrailResult {
    const content = response.content || '';
    const contentLower = content.toLowerCase();

    for (const keyword of this.blockedKeywords) {
      if (contentLower.includes(keyword.toLowerCase())) {
        return {
          passed: false,
          reason: `Blocked keyword found: ${keyword}`,
          severity: this.severity,
          details: { keyword, position: contentLower.indexOf(keyword) },
        };
      }
    }

    return { passed: true };
  }
}

/**
 * Utility function to check guardrails
 */
export function checkGuardrails(
  response: GenerateResponse,
  guardrails: Guardrail[]
): GuardrailResult {
  for (const guardrail of guardrails) {
    const result = guardrail.check(response);
    if (!result.passed) {
      return result;
    }
  }

  return { passed: true };
}
