/**
 * Example usage of OpenGuard grounding validation system
 */

import { 
  quickGroundingValidation,
  validateAgainstTextSources,
  validateAgainstJSONSources,
  validateAgainstRetrievalChunks,
  createSourceDocuments,
  createGroundingValidator,
  GroundingValidationConfig 
} from '../src/grounding/index.js';
import { NormalizedResponse } from '../src/types/normalized.js';

async function demonstrateGroundingValidation() {
  console.log('=== OpenGuard Grounding Validation Examples ===\n');

  // Example 1: Basic validation with text sources
  console.log('1. Basic Grounding Validation with Text Sources:');
  console.log('=' .repeat(50));

  const response1: NormalizedResponse = {
    text: 'According to the 2024 report, company revenue increased by 25% to $10 million. The CEO announced this achievement in the quarterly earnings call.',
    provider: 'openai',
    model: 'gpt-4',
    finishReason: 'stop',
  };

  const textSources = [
    '2024 Annual Report: Company revenue was $8 million in 2023, representing a 15% increase from 2022.',
    'Q4 2023 Earnings Call Transcript: CEO discussed growth targets but did not announce specific revenue figures.',
    'Financial Press Release March 2024: Company projected 10-15% growth for 2024.',
  ];

  try {
    const result1 = await quickGroundingValidation(response1, textSources);
    
    console.log(`✅ Validation completed`);
    console.log(`Overall Grounding Score: ${result1.metrics.groundingScore.toFixed(3)}`);
    console.log(`Grounded Claims: ${result1.metrics.groundedClaimsCount}/${result1.metrics.totalClaims}`);
    console.log(`Unsupported Claims: ${result1.metrics.unsupportedClaimsCount}`);
    
    if (result1.unsupportedClaims.length > 0) {
      console.log('\n🚨 Unsupported Claims:');
      result1.unsupportedClaims.forEach((claim, index) => {
        console.log(`  ${index + 1}. [${claim.severity.toUpperCase()}] "${claim.claim.text}"`);
        console.log(`     Reason: ${claim.reason}`);
        console.log(`     Suggestion: ${claim.suggestion}`);
        console.log(`     Confidence: ${(claim.confidence * 100).toFixed(1)}%`);
      });
    }
  } catch (error) {
    console.log(`❌ Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('\n' + '=' .repeat(50) + '\n');

  // Example 2: Validation with JSON sources
  console.log('2. Grounding Validation with JSON Sources:');
  console.log('=' .repeat(50));

  const response2: NormalizedResponse = {
    text: 'The product launch in Q2 2024 exceeded expectations with 50,000 units sold. Customer satisfaction is at 92%.',
    provider: 'openai',
    model: 'gpt-4',
    finishReason: 'stop',
  };

  const jsonSources = [
    {
      title: 'Q2 2024 Sales Report',
      content: 'Product sales reached 35,000 units in Q2 2024.',
      source: 'internal_sales_db',
      createdAt: '2024-07-15T10:00:00Z',
    },
    {
      title: 'Customer Satisfaction Survey',
      content: 'Customer satisfaction score: 88% based on 1,200 responses.',
      source: 'survey_platform',
      createdAt: '2024-07-20T14:30:00Z',
    },
  ];

  try {
    const result2 = await validateAgainstJSONSources(response2, jsonSources);
    
    console.log(`Overall Grounding Score: ${result2.metrics.groundingScore.toFixed(3)}`);
    console.log(`Grounding Percentage: ${result2.metrics.groundedClaimsPercentage.toFixed(1)}%`);
    
    // Show claim details
    if (result2.claims.length > 0) {
      console.log('\n📋 Claim Analysis:');
      result2.claims.forEach((claim, index) => {
        const validationResult = result2.claimResults.find(r => r.claim.id === claim.id);
        console.log(`  Claim ${index + 1}: "${claim.text}"`);
        console.log(`    Type: ${claim.type}`);
        console.log(`    Confidence: ${claim.confidence.toFixed(2)}`);
        console.log(`    Grounded: ${validationResult?.isGrounded ? 'YES' : 'NO'}`);
        console.log(`    Evidence: ${validationResult?.supportingEvidence.length || 0} items`);
      });
    }
  } catch (error) {
    console.log(`❌ JSON validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('\n' + '=' .repeat(50) + '\n');

  // Example 3: Validation with retrieval chunks
  console.log('3. Grounding Validation with Retrieval Chunks:');
  console.log('=' .repeat(50));

  const response3: NormalizedResponse = {
    text: 'The new AI model achieves 95% accuracy on benchmark tests and processes 1M tokens per second.',
    provider: 'openai',
    model: 'gpt-4',
    finishReason: 'stop',
  };

  const retrievalChunks = [
    {
      text: 'The AI model shows 92% accuracy on standard benchmark tests.',
      metadata: { relevanceScore: 0.9, source: 'tech_report_001' },
    },
    {
      text: 'Performance measurements show the model can process 750K tokens per second under optimal conditions.',
      metadata: { relevanceScore: 0.8, source: 'performance_test_002' },
    },
    {
      text: 'The model was evaluated on a comprehensive benchmark suite covering multiple tasks.',
      metadata: { relevanceScore: 0.7, source: 'benchmark_suite_003' },
    },
  ];

  try {
    const result3 = await validateAgainstRetrievalChunks(response3, retrievalChunks);
    
    console.log(`Overall Grounding Score: ${result3.metrics.groundingScore.toFixed(3)}`);
    
    if (result3.unsupportedClaims.length > 0) {
      console.log('\n🚨 Unsupported Claims from Retrieval:');
      result3.unsupportedClaims.forEach((claim, index) => {
        console.log(`  ${index + 1}. [${claim.severity.toUpperCase()}] "${claim.claim.text}"`);
        console.log(`     Missing Information: ${claim.claim.metadata.missingInformation?.join(', ') || 'None'}`);
        console.log(`     Supporting Evidence: ${result3.claimResults.find(r => r.claim.id === claim.id)?.supportingEvidence.length || 0}`);
      });
    }
  } catch (error) {
    console.log(`❌ Retrieval validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('\n' + '=' .repeat(50) + '\n');

  // Example 4: Advanced validation with custom configuration
  console.log('4. Advanced Grounding Validation with Custom Configuration:');
  console.log('=' .repeat(50));

  const customConfig: Partial<GroundingValidationConfig> = {
    claimExtraction: {
      minClaimLength: 15,
      maxClaimLength: 200,
      claimTypes: ['factual', 'numerical', 'temporal'],
      extractNumerical: true,
      extractTemporal: true,
    },
    evidenceMatching: {
      minSimilarity: 0.8,
      maxEvidenceDistance: 500,
      useSemanticMatching: true,
      useFuzzyMatching: false,
    },
    thresholds: {
      minGroundingScore: 0.8,
      maxUnsupportedClaims: 2,
      minEvidenceSupport: 0.6,
    },
    options: {
      usePromptValidation: false,
      useHeuristicValidation: true,
      maxProcessingTimePerClaim: 3000,
      cacheResults: true,
    },
  };

  const response4: NormalizedResponse = {
    text: 'The study was published in Nature journal in March 2024. The research team included 12 scientists from 5 countries. The findings show a 40% improvement over previous methods.',
    provider: 'openai',
    model: 'gpt-4',
    finishReason: 'stop',
  };

  const mixedSources = [
    'Nature Journal March 2024: Study published by research team of 8 scientists from 3 countries.',
    'Research Abstract: Findings show 35% improvement over previous methods.',
    'Press Release: Research collaboration involved 10 scientists from 4 countries over 2 years.',
  ];

  try {
    const validator = createGroundingValidator(customConfig);
    const result4 = await validator.validateResponse(response4, createSourceDocuments(mixedSources));
    
    console.log(`Overall Grounding Score: ${result4.metrics.groundingScore.toFixed(3)} (${result4.metrics.groundingScore >= customConfig.thresholds?.minGroundingScore ? 'PASS' : 'FAIL'})`);
    console.log(`Processing Time: ${result4.metadata.processingTime}ms`);
    console.log(`Configuration: ${result4.metadata.config.options.usePromptValidation ? 'Prompt+Heuristic' : 'Heuristic Only'}`);
    
    // Show evidence analysis
    const totalEvidence = result4.claimResults.reduce((sum, r) => sum + r.supportingEvidence.length, 0);
    const totalContradictions = result4.claimResults.reduce((sum, r) => sum + r.contradictingEvidence.length, 0);
    
    console.log(`\n📊 Evidence Analysis:`);
    console.log(`  Total Supporting Evidence: ${totalEvidence}`);
    console.log(`  Total Contradicting Evidence: ${totalContradictions}`);
    console.log(`  Average Evidence per Claim: ${(totalEvidence / result4.metrics.totalClaims).toFixed(1)}`);
  } catch (error) {
    console.log(`❌ Advanced validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('\n' + '=' .repeat(50) + '\n');

  // Example 5: Batch validation of multiple responses
  console.log('5. Batch Grounding Validation:');
  console.log('=' .repeat(50));

  const responses = [response1, response2, response3];
  const allSources = [...textSources, ...jsonSources.map(s => s.content), ...retrievalChunks.map(c => c.text)];
  
  console.log(`Processing ${responses.length} responses against ${allSources.length} source documents...`);
  
  const batchResults = await Promise.all(
    responses.map(response => quickGroundingValidation(response, allSources))
  );

  console.log('\n📋 Batch Results:');
  batchResults.forEach((result, index) => {
    console.log(`  Response ${index + 1}: Score ${result.metrics.groundingScore.toFixed(3)} (${result.metrics.groundedClaimsPercentage.toFixed(1)}% grounded)`);
  });

  const avgScore = batchResults.reduce((sum, r) => sum + r.metrics.groundingScore, 0) / batchResults.length;
  const totalUnsupported = batchResults.reduce((sum, r) => sum + r.metrics.unsupportedClaimsCount, 0);
  
  console.log(`\n📊 Batch Summary:`);
  console.log(`  Average Grounding Score: ${avgScore.toFixed(3)}`);
  console.log(`  Total Unsupported Claims: ${totalUnsupported}`);
  console.log(`  Best Performing Response: ${Math.max(...batchResults.map(r => r.metrics.groundingScore)).toFixed(3)}`);

  console.log('\n' + '=' .repeat(50));
  console.log('🎯 Grounding Validation Examples Complete!');
  console.log('\nKey features demonstrated:');
  console.log('✅ Text source validation');
  console.log('✅ JSON source validation');
  console.log('✅ Retrieval chunk validation');
  console.log('✅ Custom configuration support');
  console.log('✅ Heuristic-based validation');
  console.log('✅ Claim extraction and analysis');
  console.log('✅ Evidence matching and scoring');
  console.log('✅ Unsupported claim detection');
  console.log('✅ Batch processing capabilities');
  console.log('✅ Provider-agnostic implementation');
}

// Run demonstration
demonstrateGroundingValidation().catch(console.error);

export { demonstrateGroundingValidation };
