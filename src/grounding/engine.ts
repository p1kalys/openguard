/**
 * Core grounding validation engine for OpenGuard
 */

import {
  GroundingValidationResponse,
  GroundingValidationConfig,
  Claim,
  ClaimValidationResult,
  UnsupportedClaimIssue,
  Evidence,
  SourceDocument,
  DEFAULT_GROUNDING_CONFIG
} from './types.js';
import { NormalizedResponse } from '../types/normalized.js';

/**
 * Grounding validation engine
 */
export class GroundingValidationEngine {
  private config: GroundingValidationConfig;
  private cache: Map<string, ClaimValidationResult> = new Map();

  constructor(config: Partial<GroundingValidationConfig> = {}) {
    this.config = { ...DEFAULT_GROUNDING_CONFIG, ...config };
  }

  /**
   * Validate response against source documents
   */
  async validateResponse(
    response: NormalizedResponse,
    sourceDocuments: SourceDocument[],
    config?: Partial<GroundingValidationConfig>
  ): Promise<GroundingValidationResponse> {
    const startTime = Date.now();
    const finalConfig = { ...this.config, ...config };

    // Extract claims from response
    const claims = this.extractClaims(response.text, finalConfig);

    // Validate each claim
    const claimResults: ClaimValidationResult[] = [];
    for (const claim of claims) {
      const result = await this.validateClaim(claim, sourceDocuments, finalConfig);
      claimResults.push(result);
    }

    // Identify unsupported claims
    const unsupportedClaims = this.identifyUnsupportedClaims(claimResults, finalConfig);

    // Calculate metrics
    const metrics = this.calculateMetrics(claimResults, unsupportedClaims);

    // Create response
    const validationResponse: GroundingValidationResponse = {
      originalResponse: response,
      sourceDocuments,
      claims,
      claimResults,
      unsupportedClaims,
      metrics,
      metadata: {
        timestamp: Date.now(),
        processingTime: Date.now() - startTime,
        config: finalConfig,
      },
    };

    return validationResponse;
  }

  /**
   * Validate a single claim
   */
  async validateClaim(
    claim: Claim,
    sourceDocuments: SourceDocument[],
    config: GroundingValidationConfig
  ): Promise<ClaimValidationResult> {
    const cacheKey = `${claim.id}_${sourceDocuments.map(d => d.id).join(',')}`;

    if (config.options.cacheResults && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const startTime = Date.now();
    let result: ClaimValidationResult;

    try {
      if (config.options.useHeuristicValidation && config.options.usePromptValidation) {
        // Use hybrid approach
        const heuristicResult = await this.validateClaimHeuristic(claim, sourceDocuments, config);
        const promptResult = await this.validateClaimPrompt(claim, sourceDocuments, config);
        result = this.combineValidationResults(heuristicResult, promptResult);
      } else if (config.options.usePromptValidation) {
        // Use prompt-based validation only
        result = await this.validateClaimPrompt(claim, sourceDocuments, config);
      } else {
        // Use heuristic validation only
        result = await this.validateClaimHeuristic(claim, sourceDocuments, config);
      }
    } catch (error) {
      // Fallback result for errors
      result = {
        claim,
        isGrounded: false,
        confidence: 0.0,
        supportingEvidence: [],
        contradictingEvidence: [],
        missingInformation: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        metadata: {
          method: 'heuristic',
          processingTime: Date.now() - startTime,
          sourcesConsulted: sourceDocuments.map(d => d.id),
        },
      };
    }

    // Cache result
    if (config.options.cacheResults) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Extract claims from response text
   */
  private extractClaims(text: string, config: GroundingValidationConfig): Claim[] {
    const claims: Claim[] = [];
    const sentences = this.splitIntoSentences(text);

    let claimId = 0;
    let currentPosition = 0;

    for (const sentence of sentences) {
      if (sentence.length < config.claimExtraction.minClaimLength ||
        sentence.length > config.claimExtraction.maxClaimLength) {
        currentPosition += sentence.length + 1;
        continue;
      }

      const claim = this.createClaim(sentence, claimId++, currentPosition, config);
      if (claim) {
        claims.push(claim);
      }

      currentPosition += sentence.length + 1;
    }

    return claims;
  }

  /**
   * Create claim from sentence
   */
  private createClaim(
    text: string,
    id: number,
    position: number,
    config: GroundingValidationConfig
  ): Claim | null {
    const cleanText = text.trim();
    if (!cleanText) return null;

    // Determine claim type
    const claimType = this.determineClaimType(cleanText);

    // Skip if claim type not enabled
    if (!config.claimExtraction.claimTypes.includes(claimType)) {
      return null;
    }

    // Extract entities
    const entities = this.extractEntities(cleanText);

    // Determine specificity
    const specificity = this.determineSpecificity(cleanText);

    return {
      id: `claim_${id}`,
      text: cleanText,
      type: claimType,
      confidence: this.calculateClaimConfidence(cleanText),
      position: {
        start: position,
        end: position + cleanText.length,
      },
      metadata: {
        entities,
        specificity,
      },
    };
  }

  /**
   * Determine claim type
   */
  private determineClaimType(text: string): Claim['type'] {
    const lowerText = text.toLowerCase();

    // Numerical claims
    if (/\b\d+\.?\d*\b/.test(text) &&
      (lowerText.includes('percent') || lowerText.includes('increase') ||
        lowerText.includes('decrease') || lowerText.includes('total'))) {
      return 'numerical';
    }

    // Temporal claims
    if (/\b(20\d{2}|19\d{2}|january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(lowerText)) {
      return 'temporal';
    }

    // Causal claims
    if (/\b(because|since|due to|caused|led to|resulted in)\b/.test(lowerText)) {
      return 'causal';
    }

    // Comparative claims
    if (/\b(more|less|higher|lower|greater|smaller|better|worse|faster|slower)\b.*\b(than|compared to)\b/.test(lowerText)) {
      return 'comparative';
    }

    // Default to factual
    return 'factual';
  }

  /**
   * Extract entities from text
   */
  private extractEntities(text: string): string[] {
    const entities: string[] = [];

    // Simple entity extraction patterns
    const patterns = [
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g, // Proper nouns
      /\b\d+(?:,\d{3})*(?:\.\d+)?\b/g, // Numbers
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, // Dates
      /\$\d+(?:,\d{3})*(?:\.\d{2})?\b/g, // Money
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        entities.push(...matches);
      }
    }

    return [...new Set(entities)]; // Remove duplicates
  }

  /**
   * Determine claim specificity
   */
  private determineSpecificity(text: string): 'general' | 'specific' | 'detailed' {
    const words = text.split(/\s+/).length;

    if (words <= 5) return 'general';
    if (words <= 12) return 'specific';
    return 'detailed';
  }

  /**
   * Calculate claim confidence
   */
  private calculateClaimConfidence(text: string): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence for longer, more specific claims
    const words = text.split(/\s+/).length;
    confidence += Math.min(words * 0.02, 0.2);

    // Higher confidence for claims with numbers
    if (/\b\d+\.?\d*\b/.test(text)) {
      confidence += 0.1;
    }

    // Higher confidence for claims with entities
    if (/[A-Z]/.test(text)) {
      confidence += 0.1;
    }

    // Lower confidence for uncertain language
    if (/\b(maybe|perhaps|possibly|might|could|approximately|about|roughly)\b/.test(text.toLowerCase())) {
      confidence -= 0.2;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Validate claim using heuristic methods
   */
  private async validateClaimHeuristic(
    claim: Claim,
    sourceDocuments: SourceDocument[],
    config: GroundingValidationConfig
  ): Promise<ClaimValidationResult> {
    const startTime = Date.now();

    // Find supporting evidence
    const supportingEvidence = await this.findSupportingEvidence(claim, sourceDocuments, config);

    // Find contradicting evidence
    const contradictingEvidence = await this.findContradictingEvidence(claim, sourceDocuments, config);

    // Determine if claim is grounded
    const isGrounded = this.isClaimGrounded(supportingEvidence, contradictingEvidence, config);

    // Calculate confidence
    const confidence = this.calculateGroundingConfidence(supportingEvidence, contradictingEvidence, config);

    return {
      claim,
      isGrounded,
      confidence,
      supportingEvidence,
      contradictingEvidence,
      missingInformation: this.identifyMissingInformation(claim, supportingEvidence),
      metadata: {
        method: 'heuristic',
        processingTime: Date.now() - startTime,
        sourcesConsulted: sourceDocuments.map(d => d.id),
      },
    };
  }

  /**
   * Validate claim using prompt-based methods
   */
  private async validateClaimPrompt(
    claim: Claim,
    sourceDocuments: SourceDocument[],
    config: GroundingValidationConfig
  ): Promise<ClaimValidationResult> {
    const startTime = Date.now();

    // Create prompt for validation
    const prompt = this.createValidationPrompt(claim, sourceDocuments);

    // This would integrate with a language model provider
    // For now, return a mock result
    const mockResult: ClaimValidationResult = {
      claim,
      isGrounded: false,
      confidence: 0.5,
      supportingEvidence: [],
      contradictingEvidence: [],
      missingInformation: ['Prompt-based validation not implemented'],
      metadata: {
        method: 'prompt_based',
        processingTime: Date.now() - startTime,
        sourcesConsulted: sourceDocuments.map(d => d.id),
      },
    };

    return mockResult;
  }

  /**
   * Combine validation results from different methods
   */
  private combineValidationResults(
    heuristicResult: ClaimValidationResult,
    promptResult: ClaimValidationResult
  ): ClaimValidationResult {
    // Weighted combination of results
    const heuristicWeight = 0.6;
    const promptWeight = 0.4;

    const combinedConfidence = (heuristicResult.confidence * heuristicWeight) +
      (promptResult.confidence * promptWeight);

    const combinedIsGrounded = (heuristicResult.isGrounded && promptResult.isGrounded) ||
      (heuristicResult.confidence > 0.8 && heuristicResult.isGrounded) ||
      (promptResult.confidence > 0.8 && promptResult.isGrounded);

    return {
      claim: heuristicResult.claim,
      isGrounded: combinedIsGrounded,
      confidence: combinedConfidence,
      supportingEvidence: [...heuristicResult.supportingEvidence, ...promptResult.supportingEvidence],
      contradictingEvidence: [...heuristicResult.contradictingEvidence, ...promptResult.contradictingEvidence],
      missingInformation: [...heuristicResult.missingInformation, ...promptResult.missingInformation],
      metadata: {
        method: 'hybrid',
        processingTime: heuristicResult.metadata.processingTime + promptResult.metadata.processingTime,
        sourcesConsulted: [...new Set([...heuristicResult.metadata.sourcesConsulted, ...promptResult.metadata.sourcesConsulted])],
      },
    };
  }

  /**
   * Find supporting evidence for claim
   */
  private async findSupportingEvidence(
    claim: Claim,
    sourceDocuments: SourceDocument[],
    config: GroundingValidationConfig
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    for (const document of sourceDocuments) {
      const docEvidence = await this.searchDocumentForEvidence(claim, document, 'supporting', config);
      evidence.push(...docEvidence);
    }

    return evidence.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Find contradicting evidence for claim
   */
  private async findContradictingEvidence(
    claim: Claim,
    sourceDocuments: SourceDocument[],
    config: GroundingValidationConfig
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    for (const document of sourceDocuments) {
      const docEvidence = await this.searchDocumentForEvidence(claim, document, 'contradicting', config);
      evidence.push(...docEvidence);
    }

    return evidence.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Search document for evidence
   */
  private async searchDocumentForEvidence(
    claim: Claim,
    document: SourceDocument,
    evidenceType: 'supporting' | 'contradicting',
    config: GroundingValidationConfig
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    // Simple text-based evidence search
    const claimWords = claim.text.toLowerCase().split(/\s+/);
    const documentText = document.content.toLowerCase();

    // Look for exact matches
    for (let i = 0; i < documentText.length; i++) {
      const remainingText = documentText.substring(i);

      // Check for claim words in document
      let matchCount = 0;
      for (const word of claimWords) {
        if (remainingText.includes(word)) {
          matchCount++;
        }
      }

      // If enough words match, create evidence
      if (matchCount >= Math.ceil(claimWords.length * 0.6)) {
        const evidenceText = documentText.substring(i, Math.min(i + 200, documentText.length));
        const similarity = this.calculateSimilarity(claim.text, evidenceText);

        if (similarity >= config.evidenceMatching.minSimilarity) {
          evidence.push({
            id: `evidence_${document.id}_${i}`,
            sourceId: document.id,
            text: evidenceText,
            type: evidenceType === 'supporting' ? 'direct_match' : 'contradiction',
            relevanceScore: similarity,
            position: {
              start: i,
              end: Math.min(i + 200, documentText.length),
            },
            metadata: {
              matchType: 'semantic',
              matchConfidence: similarity,
            },
          });
        }
      }
    }

    return evidence;
  }

  /**
   * Calculate text similarity
   */
  private calculateSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity for demonstration
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Determine if claim is grounded
   */
  private isClaimGrounded(
    supportingEvidence: Evidence[],
    contradictingEvidence: Evidence[],
    config: GroundingValidationConfig
  ): boolean {
    const supportingScore = supportingEvidence.reduce((sum, e) => sum + e.relevanceScore, 0);
    const contradictingScore = contradictingEvidence.reduce((sum, e) => sum + e.relevanceScore, 0);

    return supportingScore >= config.thresholds.minEvidenceSupport &&
      supportingScore > contradictingScore;
  }

  /**
   * Calculate grounding confidence
   */
  private calculateGroundingConfidence(
    supportingEvidence: Evidence[],
    contradictingEvidence: Evidence[],
    config: GroundingValidationConfig
  ): number {
    if (supportingEvidence.length === 0) return 0.0;

    const avgSupportingScore = supportingEvidence.reduce((sum, e) => sum + e.relevanceScore, 0) / supportingEvidence.length;
    const maxContradictingScore = contradictingEvidence.length > 0 ?
      Math.max(...contradictingEvidence.map(e => e.relevanceScore)) : 0;

    return Math.max(0, avgSupportingScore - maxContradictingScore);
  }

  /**
   * Identify missing information
   */
  private identifyMissingInformation(claim: Claim, supportingEvidence: Evidence[]): string[] {
    const missing: string[] = [];

    if (supportingEvidence.length === 0) {
      missing.push('No supporting evidence found');
    }

    if (claim.type === 'numerical' && !/\d/.test(supportingEvidence.map(e => e.text).join(' '))) {
      missing.push('No numerical evidence found');
    }

    if (claim.type === 'temporal' && !/\b(20\d{2}|19\d{2}|january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(supportingEvidence.map(e => e.text).join(' ').toLowerCase())) {
      missing.push('No temporal evidence found');
    }

    return missing;
  }

  /**
   * Identify unsupported claims
   */
  private identifyUnsupportedClaims(
    claimResults: ClaimValidationResult[],
    config: GroundingValidationConfig
  ): UnsupportedClaimIssue[] {
    const unsupportedClaims: UnsupportedClaimIssue[] = [];

    for (const result of claimResults) {
      if (!result.isGrounded || result.confidence < config.thresholds.minGroundingScore) {
        const severity = this.determineUnsupportedSeverity(result, config);

        unsupportedClaims.push({
          id: `unsupported_${result.claim.id}`,
          claim: result.claim,
          severity,
          description: `Claim "${result.claim.text}" is not sufficiently grounded in source documents`,
          reason: this.getUnsupportedReason(result),
          suggestion: this.getUnsupportedSuggestion(result),
          confidence: 1.0 - result.confidence,
        });
      }
    }

    return unsupportedClaims;
  }

  /**
   * Determine unsupported claim severity
   */
  private determineUnsupportedSeverity(
    result: ClaimValidationResult,
    config: GroundingValidationConfig
  ): UnsupportedClaimIssue['severity'] {
    if (result.contradictingEvidence.length > 0) {
      return 'critical';
    }

    if (result.supportingEvidence.length === 0) {
      return 'high';
    }

    if (result.confidence < config.thresholds.minGroundingScore * 0.5) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Get reason for unsupported claim
   */
  private getUnsupportedReason(result: ClaimValidationResult): string {
    if (result.contradictingEvidence.length > 0) {
      return 'Contradicted by source documents';
    }

    if (result.supportingEvidence.length === 0) {
      return 'No supporting evidence found';
    }

    if (result.missingInformation.length > 0) {
      return `Missing information: ${result.missingInformation.join(', ')}`;
    }

    return 'Insufficient evidence support';
  }

  /**
   * Get suggestion for unsupported claim
   */
  private getUnsupportedSuggestion(result: ClaimValidationResult): string {
    if (result.contradictingEvidence.length > 0) {
      return 'Revise claim to align with source documents';
    }

    if (result.supportingEvidence.length === 0) {
      return 'Provide supporting evidence or remove claim';
    }

    return 'Strengthen claim with additional evidence';
  }

  /**
   * Calculate grounding metrics
   */
  private calculateMetrics(
    claimResults: ClaimValidationResult[],
    unsupportedClaims: UnsupportedClaimIssue[]
  ): GroundingValidationResponse['metrics'] {
    const totalClaims = claimResults.length;
    const groundedClaimsCount = claimResults.filter(r => r.isGrounded).length;
    const unsupportedClaimsCount = unsupportedClaims.length;

    const groundingScore = totalClaims > 0 ? groundedClaimsCount / totalClaims : 1.0;

    return {
      groundingScore,
      groundedClaimsPercentage: groundingScore * 100,
      totalClaims,
      groundedClaimsCount,
      unsupportedClaimsCount,
    };
  }

  /**
   * Create validation prompt
   */
  private createValidationPrompt(claim: Claim, sourceDocuments: SourceDocument[]): string {
    const sourcesText = sourceDocuments.map(doc =>
      `Document ${doc.id}: ${doc.content.substring(0, 500)}...`
    ).join('\n\n');

    return `Please validate the following claim against the provided source documents:

Claim: "${claim.text}"

Source Documents:
${sourcesText}

Analyze whether the claim is supported, contradicted, or not mentioned in the source documents.
Provide specific evidence and confidence level.`;
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}
