/**
 * Streaming stabilization utility for OpenGuard
 */

/**
 * JSON repair result
 */
export interface JSONRepairResult {
  /** Whether JSON was successfully repaired */
  success: boolean;
  /** Repaired JSON object or original if no repair needed */
  data: any;
  /** Error if repair failed */
  error?: string;
  /** Whether the JSON was complete or partial */
  isComplete: boolean;
}

/**
 * Streaming stabilization options
 */
export interface StreamingStabilizerOptions {
  /** Maximum buffer size before forcing repair */
  maxBufferSize?: number;
  /** Timeout for waiting for complete JSON */
  repairTimeout?: number;
  /** Custom validation function */
  validateFn?: (data: any) => boolean | Promise<boolean>;
  /** Whether to attempt progressive repair */
  enableProgressiveRepair?: boolean;
}

/**
 * Lightweight streaming JSON stabilizer
 */
export class StreamingStabilizer {
  private options: Required<StreamingStabilizerOptions>;
  private buffer: string = '';
  private lastValidData: any = null;
  private repairAttempts: number = 0;

  constructor(options: StreamingStabilizerOptions = {}) {
    this.options = {
      maxBufferSize: 10000,
      repairTimeout: 5000,
      enableProgressiveRepair: true,
      validateFn: () => true,
      ...options,
    };
  }

  /**
   * Process a streaming chunk and attempt to extract valid JSON
   */
  async processChunk(chunk: string): Promise<JSONRepairResult> {
    this.buffer += chunk;
    this.repairAttempts = 0;

    // Try to extract JSON from current buffer
    const result = await this.attemptJSONExtraction();
    
    if (result.success) {
      this.lastValidData = result.data;
      return result;
    }

    // If buffer is getting too large, force repair
    if (this.buffer.length > this.options.maxBufferSize!) {
      return await this.forceRepair();
    }

    return {
      success: false,
      data: null,
      isComplete: false,
      error: 'Incomplete JSON in buffer',
    };
  }

  /**
   * Reset the stabilizer state
   */
  reset(): void {
    this.buffer = '';
    this.lastValidData = null;
    this.repairAttempts = 0;
  }

  /**
   * Get current buffer content
   */
  getBuffer(): string {
    return this.buffer;
  }

  /**
   * Get last valid data extracted
   */
  getLastValidData(): any {
    return this.lastValidData;
  }

  /**
   * Attempt to extract and validate JSON from buffer
   */
  private async attemptJSONExtraction(): Promise<JSONRepairResult> {
    const candidates = this.extractJSONCandidates();

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        
        // Validate with custom function if provided
        const isValid = await this.options.validateFn(parsed);
        if (!isValid) {
          continue;
        }

        return {
          success: true,
          data: parsed,
          isComplete: this.isCompleteJSON(candidate),
        };
      } catch (error) {
        // JSON parsing failed, try next candidate
        continue;
      }
    }

    return {
      success: false,
      data: null,
      isComplete: false,
      error: 'No valid JSON found in buffer',
    };
  }

  /**
   * Extract potential JSON candidates from buffer
   */
  private extractJSONCandidates(): string[] {
    const candidates: string[] = [];

    // Try to find JSON objects/arrays in buffer
    const objectMatches = this.buffer.match(/\{[^{}]*\}/g) || [];
    const arrayMatches = this.buffer.match(/\[[^\[\]]*\]/g) || [];

    candidates.push(...objectMatches, ...arrayMatches);

    // Try to extract nested JSON structures
    const nestedCandidates = this.extractNestedJSON(this.buffer);
    candidates.push(...nestedCandidates);

    return candidates.filter((candidate, index, arr) => 
      arr.indexOf(candidate) === index && candidate.trim().length > 0
    );
  }

  /**
   * Extract nested JSON structures
   */
  private extractNestedJSON(text: string): string[] {
    const candidates: string[] = [];
    let braceCount = 0;
    let bracketCount = 0;
    let start = -1;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      if (char === '{') {
        braceCount++;
        if (start === -1) start = i;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && start !== -1) {
          candidates.push(text.substring(start, i + 1));
          start = -1;
        }
      } else if (char === '[') {
        bracketCount++;
        if (start === -1) start = i;
      } else if (char === ']') {
        bracketCount--;
        if (bracketCount === 0 && start !== -1) {
          candidates.push(text.substring(start, i + 1));
          start = -1;
        }
      }
    }

    return candidates;
  }

  /**
   * Check if JSON structure appears complete
   */
  private isCompleteJSON(jsonStr: string): boolean {
    const trimmed = jsonStr.trim();
    
    // Basic completeness checks
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return this.hasBalancedBraces(trimmed);
    }
    
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      return this.hasBalancedBrackets(trimmed);
    }

    return false;
  }

  /**
   * Check for balanced braces
   */
  private hasBalancedBraces(str: string): boolean {
    let count = 0;
    for (const char of str) {
      if (char === '{') count++;
      else if (char === '}') count--;
      if (count < 0) return false;
    }
    return count === 0;
  }

  /**
   * Check for balanced brackets
   */
  private hasBalancedBrackets(str: string): boolean {
    let count = 0;
    for (const char of str) {
      if (char === '[') count++;
      else if (char === ']') count--;
      if (count < 0) return false;
    }
    return count === 0;
  }

  /**
   * Force repair of incomplete JSON in buffer
   */
  private async forceRepair(): Promise<JSONRepairResult> {
    this.repairAttempts++;

    if (!this.options.enableProgressiveRepair) {
      return {
        success: false,
        data: null,
        isComplete: false,
        error: 'Progressive repair disabled',
      };
    }

    const repaired = await this.progressiveRepair();
    
    if (repaired.success) {
      return repaired;
    }

    // Last resort: return what we have
    return {
      success: false,
      data: this.buffer,
      isComplete: false,
      error: `Failed to repair after ${this.repairAttempts} attempts`,
    };
  }

  /**
   * Progressive JSON repair strategies
   */
  private async progressiveRepair(): Promise<JSONRepairResult> {
    const strategies = [
      () => this.repairMissingBraces(),
      () => this.repairMissingBrackets(),
      () => this.repairTruncatedStrings(),
      () => this.repairMissingQuotes(),
      () => this.repairTruncatedNumbers(),
    ];

    for (const strategy of strategies) {
      try {
        const result = await strategy();
        if (result.success) {
          return result;
        }
      } catch (error) {
        // Try next strategy
        continue;
      }
    }

    return {
      success: false,
      data: null,
      isComplete: false,
      error: 'All repair strategies failed',
    };
  }

  /**
   * Repair missing braces
   */
  private async repairMissingBraces(): Promise<JSONRepairResult> {
    let buffer = this.buffer.trim();
    const openBraces = (buffer.match(/\{/g) || []).length;
    const closeBraces = (buffer.match(/\}/g) || []).length;
    const missing = openBraces - closeBraces;

    if (missing > 0) {
      buffer += '}'.repeat(missing);
      
      try {
        const parsed = JSON.parse(buffer);
        const isValid = await this.options.validateFn(parsed);
        
        if (isValid) {
          return {
            success: true,
            data: parsed,
            isComplete: true,
          };
        }
      } catch (error) {
        // Repair failed
      }
    }

    return { success: false, data: null, isComplete: false };
  }

  /**
   * Repair missing brackets
   */
  private async repairMissingBrackets(): Promise<JSONRepairResult> {
    let buffer = this.buffer.trim();
    const openBrackets = (buffer.match(/\[/g) || []).length;
    const closeBrackets = (buffer.match(/\]/g) || []).length;
    const missing = openBrackets - closeBrackets;

    if (missing > 0) {
      buffer += ']'.repeat(missing);
      
      try {
        const parsed = JSON.parse(buffer);
        const isValid = await this.options.validateFn(parsed);
        
        if (isValid) {
          return {
            success: true,
            data: parsed,
            isComplete: true,
          };
        }
      } catch (error) {
        // Repair failed
      }
    }

    return { success: false, data: null, isComplete: false };
  }

  /**
   * Repair truncated strings
   */
  private async repairTruncatedStrings(): Promise<JSONRepairResult> {
    let buffer = this.buffer.trim();
    
    // Find unterminated strings
    const stringMatches = buffer.match(/"([^"\\]|\\.)*"/g) || [];
    const lastMatch = stringMatches[stringMatches.length - 1];
    
    if (lastMatch && !lastMatch.endsWith('"')) {
      // Check if string is truncated
      const beforeLastQuote = buffer.substring(0, buffer.lastIndexOf(lastMatch));
      const afterLastQuote = buffer.substring(buffer.lastIndexOf(lastMatch) + lastMatch.length);
      
      // If we have content after an incomplete string, close it
      if (afterLastQuote.trim()) {
        buffer = beforeLastQuote + lastMatch.slice(0, -1) + '"' + afterLastQuote;
        
        try {
          const parsed = JSON.parse(buffer);
          const isValid = await this.options.validateFn(parsed);
          
          if (isValid) {
            return {
              success: true,
              data: parsed,
              isComplete: true,
            };
          }
        } catch (error) {
          // Repair failed
        }
      }
    }

    return { success: false, data: null, isComplete: false };
  }

  /**
   * Repair missing quotes
   */
  private async repairMissingQuotes(): Promise<JSONRepairResult> {
    let buffer = this.buffer.trim();
    
    // Add missing quotes around unquoted property names
    buffer = buffer.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    
    try {
      const parsed = JSON.parse(buffer);
      const isValid = await this.options.validateFn(parsed);
      
      if (isValid) {
        return {
          success: true,
          data: parsed,
          isComplete: true,
        };
      }
    } catch (error) {
      // Repair failed
    }

    return { success: false, data: null, isComplete: false };
  }

  /**
   * Repair truncated numbers
   */
  private async repairTruncatedNumbers(): Promise<JSONRepairResult> {
    let buffer = this.buffer.trim();
    
    // Find truncated numbers at end of JSON
    const numberMatch = buffer.match(/([0-9]+)$/);
    if (numberMatch && buffer.length > 10) { // Reasonable minimum length
      // Try to complete the JSON structure
      if (buffer.includes('{') && !buffer.endsWith('}')) {
        buffer += '}';
      } else if (buffer.includes('[') && !buffer.endsWith(']')) {
        buffer += ']';
      }
      
      try {
        const parsed = JSON.parse(buffer);
        const isValid = await this.options.validateFn(parsed);
        
        if (isValid) {
          return {
            success: true,
            data: parsed,
            isComplete: true,
          };
        }
      } catch (error) {
        // Repair failed
      }
    }

    return { success: false, data: null, isComplete: false };
  }
}

/**
 * Utility function to create a streaming stabilizer
 */
export function createStreamingStabilizer(options?: StreamingStabilizerOptions): StreamingStabilizer {
  return new StreamingStabilizer(options);
}

/**
 * Utility function to process async iterator with stabilization
 */
export async function* processStreamWithStabilization<T>(
  stream: AsyncIterable<T>,
  getContent: (item: T) => string,
  options?: StreamingStabilizerOptions
): AsyncGenerator<JSONRepairResult & { original: T }> {
  const stabilizer = createStreamingStabilizer(options);

  for await (const item of stream) {
    const content = getContent(item);
    const result = await stabilizer.processChunk(content);
    
    yield {
      ...result,
      original: item,
    };

    // If we got a complete result, reset for next JSON
    if (result.success && result.isComplete) {
      stabilizer.reset();
    }
  }
}
