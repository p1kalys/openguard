/**
 * Verification prompt templates for OpenGuard self-verification
 */

import { VerificationPrompt, VerificationType } from './types.js';

/**
 * Default verification prompts
 */
export const DEFAULT_VERIFICATION_PROMPTS: Record<VerificationType, VerificationPrompt> = {
  factual: {
    name: 'Factual Consistency Check',
    type: 'factual',
    template: `You are a fact-checking assistant. Your task is to verify the factual consistency of the following AI response.

Original Request: {{request}}
AI Response: {{response}}

Please analyze the response for:
1. Factual accuracy and consistency
2. Logical contradictions
3. Claims that contradict well-established facts
4. Inconsistencies within the response itself

Respond with a JSON object in this format:
{
  "score": 0.0-1.0,
  "passed": true/false,
  "issues": [
    {
      "type": "factual",
      "severity": "low|medium|high|critical",
      "description": "Description of the issue",
      "location": "Specific part of response",
      "suggestion": "How to fix it",
      "confidence": 0.0-1.0
    }
  ],
  "analysis": "Brief analysis of the overall factual consistency"
}

Be thorough but fair. Focus on clear factual errors rather than subjective differences.`,
    expectedFormat: 'json',
    isDefault: true,
  },

  schema: {
    name: 'Schema Correctness Check',
    type: 'schema',
    template: `You are a schema validation assistant. Your task to verify the structural correctness of the following AI response.

Original Request: {{request}}
AI Response: {{response}}
Expected Schema: {{schema}}

Please analyze the response for:
1. JSON format validity (if JSON is expected)
2. Schema compliance
3. Required field presence
4. Data type correctness
5. Structural integrity

Respond with a JSON object in this format:
{
  "score": 0.0-1.0,
  "passed": true/false,
  "issues": [
    {
      "type": "schema",
      "severity": "low|medium|high|critical",
      "description": "Description of the schema issue",
      "location": "Specific part of response",
      "suggestion": "How to fix it",
      "confidence": 0.0-1.0
    }
  ],
  "analysis": "Brief analysis of the schema compliance"
}

Focus on structural and format issues rather than content accuracy.`,
    expectedFormat: 'json',
    isDefault: true,
  },

  claims: {
    name: 'Unsupported Claims Check',
    type: 'claims',
    template: `You are an claims verification assistant. Your task is to identify unsupported or questionable claims in the following AI response.

Original Request: {{request}}
AI Response: {{response}}

Please analyze the response for:
1. Claims made without evidence or sources
2. Speculative statements presented as facts
3. Overconfident or absolute statements
4. Claims that would require citation but lack them
5. Unverifiable or pseudoscientific claims

Respond with a JSON object in this format:
{
  "score": 0.0-1.0,
  "passed": true/false,
  "issues": [
    {
      "type": "claims",
      "severity": "low|medium|high|critical",
      "description": "Description of the unsupported claim",
      "location": "Specific claim in the response",
      "suggestion": "How to make the claim more appropriate",
      "confidence": 0.0-1.0
    }
  ],
  "analysis": "Brief analysis of claims reliability"
}

Distinguish between reasonable inferences and truly unsupported claims. Consider the context of the original request.`,
    expectedFormat: 'json',
    isDefault: true,
  },

  comprehensive: {
    name: 'Comprehensive Verification',
    type: 'comprehensive',
    template: `You are a comprehensive verification assistant. Your task is to perform a thorough verification of the following AI response across multiple dimensions.

Original Request: {{request}}
AI Response: {{response}}
Expected Schema: {{schema}}

Please analyze the response for:
1. Factual accuracy and consistency
2. Schema compliance and format correctness
3. Unsupported or questionable claims
4. Logical coherence
5. Completeness relative to the request

Respond with a JSON object in this format:
{
  "score": 0.0-1.0,
  "passed": true/false,
  "issues": [
    {
      "type": "factual|schema|claims",
      "severity": "low|medium|high|critical",
      "description": "Description of the issue",
      "location": "Specific part of response",
      "suggestion": "How to fix it",
      "confidence": 0.0-1.0
    }
  ],
  "analysis": "Comprehensive analysis of the response quality"
}

Provide a holistic assessment while identifying specific issues across all verification types.`,
    expectedFormat: 'json',
    isDefault: true,
  },
};

/**
 * Prompt template variables
 */
export interface PromptVariables {
  /** Original request text */
  request: string;
  /** AI response text */
  response: string;
  /** Expected schema (optional) */
  schema?: string;
  /** Additional context (optional) */
  context?: string;
}

/**
 * Render prompt template with variables
 */
export function renderPrompt(
  prompt: VerificationPrompt,
  variables: PromptVariables
): string {
  let rendered = prompt.template;

  // Replace template variables
  rendered = rendered.replace(/\{\{request\}\}/g, variables.request || '');
  rendered = rendered.replace(/\{\{response\}\}/g, variables.response || '');
  rendered = rendered.replace(/\{\{schema\}\}/g, variables.schema || 'Not specified');
  rendered = rendered.replace(/\{\{context\}\}/g, variables.context || '');

  return rendered;
}

/**
 * Get prompt for verification type
 */
export function getPrompt(
  type: VerificationType,
  customPrompts?: Record<VerificationType, string>
): VerificationPrompt {
  // Use custom prompt if provided
  if (customPrompts?.[type]) {
    return {
      name: `Custom ${type} prompt`,
      type,
      template: customPrompts[type],
      expectedFormat: 'json',
      isDefault: false,
    };
  }

  // Use default prompt
  const defaultPrompt = DEFAULT_VERIFICATION_PROMPTS[type];
  if (!defaultPrompt) {
    throw new Error(`No default prompt found for verification type: ${type}`);
  }

  return defaultPrompt;
}

/**
 * Validate prompt template
 */
export function validatePromptTemplate(template: string): boolean {
  // Check for required variables
  const requiredVars = ['{{request}}', '{{response}}'];
  return requiredVars.every(varName => template.includes(varName));
}
