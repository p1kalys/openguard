/**
 * Response repair utilities for OpenGuard
 */

import type { GenerateResponse } from '../providers/base.js';

/**
 * Repair result
 */
export interface RepairResult {
  /** Whether repair was successful */
  success: boolean;
  /** Repaired response */
  response?: GenerateResponse;
  /** Error if repair failed */
  error?: string;
  /** Repair strategy used */
  strategy?: string;
}

/**
 * Response repairer interface
 */
export interface ResponseRepairer {
  /** Attempt to repair response */
  repair(response: GenerateResponse): RepairResult;
}

/**
 * JSON repairer for malformed JSON responses
 */
export class JSONRepairer implements ResponseRepairer {
  repair(response: GenerateResponse): RepairResult {
    try {
      const content = response.content || '';
      
      // Try to parse JSON
      JSON.parse(content);
      
      // If parsing succeeds, no repair needed
      return { 
        success: true, 
        response,
        strategy: 'none' 
      };
    } catch (error) {
      // Attempt to repair common JSON issues
      const repaired = this.attemptJSONRepair(response.content || '');
      
      if (repaired) {
        return { 
          success: true, 
          response: { ...response, content: repaired },
          strategy: 'json-repair' 
        };
      }
      
      return { 
        success: false, 
        error: `JSON repair failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  private attemptJSONRepair(content: string): string | null {
    let repaired = content.trim();
    
    // Add missing braces
    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;
    if (openBraces > closeBraces) {
      repaired += '}'.repeat(openBraces - closeBraces);
    }
    
    // Add missing brackets
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) {
      repaired += ']'.repeat(openBrackets - closeBrackets);
    }
    
    // Try to parse repaired content
    try {
      JSON.parse(repaired);
      return repaired;
    } catch {
      return null;
    }
  }
}

/**
 * Utility function to repair response
 */
export function repairResponse(
  response: GenerateResponse,
  repairer: ResponseRepairer
): RepairResult {
  return repairer.repair(response);
}
