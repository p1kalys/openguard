/**
 * Prompt-based validation system for grounding validation
 */

import { Claim, SourceDocument, ClaimValidationResult } from './types.js';

/**
 * Prompt templates for grounding validation
 */
export class GroundingPrompts {
  /**
   * Create claim validation prompt
   */
  static createClaimValidationPrompt(
    claim: Claim,
    sourceDocuments: SourceDocument[]
  ): string {
    const sourcesText = sourceDocuments.map((doc, index) => {
      const content = doc.content.length > 1000 
        ? doc.content.substring(0, 1000) + '...'
        : doc.content;
      
      return `[Source ${index + 1}]
ID: ${doc.id}
Type: ${doc.type}
Content: ${content}
Metadata: ${JSON.stringify(doc.metadata, null, 2)}
[/Source]`;
    }).join('\n\n');

    return `You are a fact-checking assistant. Your task is to validate the following claim against the provided source documents.

CLAIM TO VALIDATE:
"${claim.text}"

Claim Type: ${claim.type}
Claim Confidence: ${claim.confidence}

SOURCE DOCUMENTS:
${sourcesText}

ANALYSIS INSTRUCTIONS:
1. Carefully read through all source documents
2. Look for evidence that supports, contradicts, or is relevant to the claim
3. Consider the specificity and confidence of the claim
4. Evaluate the strength of evidence found

RESPONSE FORMAT (JSON):
{
  "isGrounded": true/false,
  "confidence": 0.0-1.0,
  "supportingEvidence": [
    {
      "sourceId": "source_id",
      "text": "exact evidence text",
      "relevanceScore": 0.0-1.0,
      "matchType": "exact|semantic|partial",
      "explanation": "why this evidence supports the claim"
    }
  ],
  "contradictingEvidence": [
    {
      "sourceId": "source_id", 
      "text": "exact evidence text",
      "relevanceScore": 0.0-1.0,
      "matchType": "exact|semantic|partial",
      "explanation": "why this evidence contradicts the claim"
    }
  ],
  "missingInformation": [
    "description of what information is missing to fully validate the claim"
  ],
  "reasoning": "detailed explanation of your analysis process and conclusion"
}

SCORING GUIDELINES:
- isGrounded: true if sufficient supporting evidence exists and no contradicting evidence
- confidence: higher when evidence is strong and directly relevant
- supportingEvidence: include all evidence that supports the claim
- contradictingEvidence: include any evidence that contradicts the claim
- missingInformation: note what would help validate the claim better

Please provide a thorough, evidence-based analysis.`;
  }

  /**
   * Create batch claim validation prompt
   */
  static createBatchValidationPrompt(
    claims: Claim[],
    sourceDocuments: SourceDocument[]
  ): string {
    const claimsText = claims.map((claim, index) => 
      `Claim ${index + 1}: "${claim.text}" (Type: ${claim.type})`
    ).join('\n');

    const sourcesText = sourceDocuments.map((doc, index) => {
      const content = doc.content.length > 800 
        ? doc.content.substring(0, 800) + '...'
        : doc.content;
      
      return `[Source ${index + 1}]
ID: ${doc.id}
Content: ${content}
[/Source]`;
    }).join('\n\n');

    return `You are a fact-checking assistant. Your task is to validate multiple claims against the provided source documents.

CLAIMS TO VALIDATE:
${claimsText}

SOURCE DOCUMENTS:
${sourcesText}

ANALYSIS INSTRUCTIONS:
1. Analyze each claim individually against all source documents
2. Look for supporting, contradicting, or relevant evidence
3. Consider the claim type and specificity
4. Provide evidence-based validation for each claim

RESPONSE FORMAT (JSON):
{
  "claimValidations": [
    {
      "claimId": "claim_id",
      "isGrounded": true/false,
      "confidence": 0.0-1.0,
      "supportingEvidence": [
        {
          "sourceId": "source_id",
          "text": "evidence text",
          "relevanceScore": 0.0-1.0,
          "matchType": "exact|semantic|partial"
        }
      ],
      "contradictingEvidence": [
        {
          "sourceId": "source_id",
          "text": "evidence text", 
          "relevanceScore": 0.0-1.0,
          "matchType": "exact|semantic|partial"
        }
      ],
      "reasoning": "explanation of validation for this specific claim"
    }
  ],
  "overallAssessment": {
    "totalClaims": ${claims.length},
    "groundedClaims": number,
    "overallConfidence": 0.0-1.0,
    "summary": "brief summary of validation results"
  }
}

Please provide a thorough, evidence-based analysis for all claims.`;
  }

  /**
   * Create evidence extraction prompt
   */
  static createEvidenceExtractionPrompt(
    claim: Claim,
    sourceDocument: SourceDocument
  ): string {
    return `You are an evidence extraction assistant. Your task is to extract evidence from a source document that is relevant to a specific claim.

CLAIM:
"${claim.text}"
Claim Type: ${claim.type}

SOURCE DOCUMENT:
ID: ${sourceDocument.id}
Type: ${sourceDocument.type}
Content: ${sourceDocument.content}
Metadata: ${JSON.stringify(sourceDocument.metadata, null, 2)}

EXTRACTION INSTRUCTIONS:
1. Read the source document carefully
2. Identify sentences or passages that are relevant to the claim
3. Extract both supporting and contradicting evidence
4. Assess the relevance and strength of each evidence piece

RESPONSE FORMAT (JSON):
{
  "evidence": [
    {
      "text": "exact text from source",
      "position": {
        "start": number,
        "end": number
      },
      "type": "supporting|contradicting|neutral",
      "relevanceScore": 0.0-1.0,
      "matchType": "exact|semantic|partial",
      "explanation": "why this evidence is relevant to the claim"
    }
  ],
  "summary": {
    "totalEvidence": number,
    "supportingCount": number,
    "contradictingCount": number,
    "overallRelevance": 0.0-1.0
  }
}

Focus on extracting factual evidence rather than opinions or general statements.`;
  }

  /**
   * Create claim comparison prompt
   */
  static createClaimComparisonPrompt(
    originalClaim: Claim,
    extractedEvidence: any[]
  ): string {
    const evidenceText = extractedEvidence.map((evidence, index) => 
      `Evidence ${index + 1}: "${evidence.text}" (${evidence.type}, relevance: ${evidence.relevanceScore})`
    ).join('\n');

    return `You are a claim validation assistant. Your task is to validate a claim against extracted evidence.

ORIGINAL CLAIM:
"${originalClaim.text}"
Claim Type: ${originalClaim.type}

EXTRACTED EVIDENCE:
${evidenceText}

VALIDATION INSTRUCTIONS:
1. Compare the claim against each piece of evidence
2. Determine if evidence supports, contradicts, or is neutral to the claim
3. Assess the overall strength of evidence support
4. Consider the claim's confidence and specificity

RESPONSE FORMAT (JSON):
{
  "isGrounded": true/false,
  "confidence": 0.0-1.0,
  "supportingEvidence": [
    {
      "text": "evidence text",
      "relevanceScore": 0.0-1.0,
      "strength": "strong|moderate|weak",
      "explanation": "how this evidence supports the claim"
    }
  ],
  "contradictingEvidence": [
    {
      "text": "evidence text", 
      "relevanceScore": 0.0-1.0,
      "strength": "strong|moderate|weak",
      "explanation": "how this evidence contradicts the claim"
    }
  ],
  "missingInformation": [
    "description of what additional information would help"
  ],
  "reasoning": "detailed explanation of your validation process"
}

Provide a thorough, evidence-based assessment.`;
  }

  /**
   * Create source relevance assessment prompt
   */
  static createSourceRelevancePrompt(
    claim: Claim,
    sourceDocuments: SourceDocument[]
  ): string {
    const sourcesText = sourceDocuments.map((doc, index) => 
      `[Source ${index + 1}]
ID: ${doc.id}
Title: ${doc.metadata.title || 'N/A'}
Content: ${doc.content.length > 500 ? doc.content.substring(0, 500) + '...' : doc.content}
[/Source]`
    ).join('\n\n');

    return `You are a relevance assessment assistant. Your task is to evaluate which source documents are most relevant to validating a claim.

CLAIM:
"${claim.text}"
Claim Type: ${claim.type}

SOURCE DOCUMENTS:
${sourcesText}

ASSESSMENT INSTRUCTIONS:
1. Analyze each source document for relevance to the claim
2. Consider content overlap, topic similarity, and evidence potential
3. Rank documents by relevance
4. Identify key information gaps

RESPONSE FORMAT (JSON):
{
  "sourceRelevance": [
    {
      "sourceId": "source_id",
      "relevanceScore": 0.0-1.0,
      "relevantSections": [
        {
          "text": "relevant section text",
          "relevanceReason": "why this section is relevant"
        }
      ],
      "informationGaps": [
        "description of missing information in this source"
      ]
    }
  ],
  "overallAssessment": {
    "mostRelevantSources": ["source_id1", "source_id2"],
    "leastRelevantSources": ["source_id3", "source_id4"],
    "criticalInformationGaps": [
      "most important missing information types"
    ],
    "recommendation": "what additional sources would be most helpful"
  }
}

Focus on identifying sources with the highest evidence potential for claim validation.`;
  }

  /**
   * Create confidence calibration prompt
   */
  static createConfidenceCalibrationPrompt(
    validationResults: ClaimValidationResult[]
  ): string {
    const resultsText = validationResults.map((result, index) => 
      `Claim ${index + 1}: "${result.claim.text}"
Grounded: ${result.isGrounded}
Confidence: ${result.confidence}
Supporting Evidence: ${result.supportingEvidence.length} items
Contradicting Evidence: ${result.contradictingEvidence.length} items`
    ).join('\n\n');

    return `You are a confidence calibration assistant. Your task to analyze and potentially adjust confidence scores for claim validation results.

VALIDATION RESULTS:
${resultsText}

CALIBRATION INSTRUCTIONS:
1. Review each validation result for consistency
2. Check if confidence scores align with evidence strength
3. Identify any overconfident or underconfident assessments
4. Suggest calibrated confidence scores

RESPONSE FORMAT (JSON):
{
  "calibratedResults": [
    {
      "claimId": "claim_id",
      "originalConfidence": 0.0-1.0,
      "calibratedConfidence": 0.0-1.0,
      "adjustmentReason": "why confidence was adjusted",
      "confidenceLevel": "low|medium|high|very_high"
    }
  ],
  "overallCalibration": {
    "averageAdjustment": number,
    "mostAdjustedClaims": ["claim_id1", "claim_id2"],
    "calibrationQuality": "excellent|good|fair|poor"
  },
  "recommendations": [
    "suggestions for improving validation confidence scoring"
  ]
}

Ensure calibrated scores better reflect the actual evidence quality and validation certainty.`;
  }
}
