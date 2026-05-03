/**
 * OpenGuard - Core guardrail implementation
 */

export interface GuardrailConfig {
  enabled: boolean;
  maxTokens?: number;
  allowedTopics?: string[];
  blockedPatterns?: RegExp[];
}

export class OpenGuard {
  private config: GuardrailConfig;

  constructor(config: GuardrailConfig = { enabled: true }) {
    this.config = config;
  }

  /**
   * Validate input against guardrail rules
   */
  validate(input: string): { valid: boolean; reason?: string } {
    if (!this.config.enabled) {
      return { valid: true };
    }

    // Check blocked patterns
    if (this.config.blockedPatterns) {
      for (const pattern of this.config.blockedPatterns) {
        if (pattern.test(input)) {
          return { valid: false, reason: 'Input matches blocked pattern' };
        }
      }
    }

    // Check token limit
    if (this.config.maxTokens && input.length > this.config.maxTokens) {
      return { valid: false, reason: 'Input exceeds maximum token limit' };
    }

    return { valid: true };
  }

  /**
   * Get current configuration
   */
  getConfig(): GuardrailConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<GuardrailConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
