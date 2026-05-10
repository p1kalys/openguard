/**
 * Main verification module exports for OpenGuard
 */

// Re-export types and interfaces
export {
  VerificationType,
  VerificationSeverity,
  VerificationIssue,
  VerificationResult,
  VerificationResponse,
  VerificationPrompt,
  VerificationConfig,
  VerificationProvider,
  VerificationRequest,
  VerificationProviderResponse,
  DEFAULT_VERIFICATION_CONFIG,
} from './types.js';

// Re-export prompt utilities
export {
  DEFAULT_VERIFICATION_PROMPTS,
  renderPrompt,
  getPrompt,
  validatePromptTemplate,
} from './prompts.js';
export type { PromptVariables } from './prompts.js';

// Re-export orchestrator
export { VerificationOrchestrator } from './orchestrator.js';

// Re-export loop protection
export { LoopProtectionManager } from './loop-protection.js';

// Re-export providers
export {
  BaseVerificationProvider,
  OpenAIVerificationProvider,
} from './providers/index.js';

// Convenience functions for quick verification
import { VerificationOrchestrator } from './orchestrator.js';
import { OpenAIVerificationProvider } from './providers/openai.js';
import { VerificationConfig, VerificationResponse } from './types.js';
import { NormalizedResponse, NormalizedRequest } from '../types/normalized.js';

/**
 * Quick verification with default OpenAI provider
 */
export async function quickVerify(
  response: NormalizedResponse,
  request?: NormalizedRequest,
  openaiApiKey?: string,
  config?: Partial<VerificationConfig>
): Promise<VerificationResponse> {
  const orchestrator = new VerificationOrchestrator(config);
  
  if (openaiApiKey) {
    const provider = new OpenAIVerificationProvider(openaiApiKey);
    orchestrator.registerProvider(provider);
  }
  
  return orchestrator.verifyResponse(response, request);
}

/**
 * Create verification orchestrator with OpenAI provider
 */
export function createVerificationOrchestrator(
  openaiApiKey: string,
  config?: Partial<VerificationConfig>
): VerificationOrchestrator {
  const orchestrator = new VerificationOrchestrator(config);
  const provider = new OpenAIVerificationProvider(openaiApiKey);
  orchestrator.registerProvider(provider);
  return orchestrator;
}
