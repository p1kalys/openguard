/**
 * Example usage of OpenGuard hallucination detection system
 */

import { 
  quickHallucinationDetection,
  createHallucinationDetector,
  detectHallucinationsInText,
  HallucinationDetectionConfig 
} from '../src/hallucination/index.js';

async function demonstrateHallucinationDetection() {
  console.log('=== OpenGuard Hallucination Detection Examples ===\n');

  // Example 1: Basic hallucination detection
  console.log('1. Basic Hallucination Detection:');
  console.log('=' .repeat(50));

  const response1 = {
    text: 'According to a recent study from MIT, quantum computers can solve any problem instantly. This breakthrough will definitely revolutionize computing by 2025. The research involved 10,000 participants and was published in Nature.',
    provider: 'openai',
    model: 'gpt-4',
    finishReason: 'stop',
  };

  try {
    const result1 = await quickHallucinationDetection(response1);
    
    console.log(`✅ Detection completed`);
    console.log(`Hallucination Score: ${result1.result.hallucinationScore.toFixed(3)}`);
    console.log(`Is Hallucinated: ${result1.result.isHallucinated}`);
    console.log(`Issues Found: ${result1.result.issues.length}`);
    
    if (result1.result.issues.length > 0) {
      console.log('\n🚨 Detected Issues:');
      result1.result.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.type}`);
        console.log(`     Description: ${issue.description}`);
        console.log(`     Text: "${issue.problematicText}"`);
        console.log(`     Reason: ${issue.reason}`);
        console.log(`     Suggestion: ${issue.suggestion}`);
        console.log(`     Confidence: ${(issue.confidence * 100).toFixed(1)}%`);
      });
    }
  } catch (error) {
    console.log(`❌ Detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('\n' + '=' .repeat(50) + '\n');

  // Example 2: Custom configuration
  console.log('2. Custom Configuration - Conservative Sensitivity:');
  console.log('=' .repeat(50));

  const customConfig: Partial<HallucinationDetectionConfig> = {
    sensitivity: 'conservative',
    enabledTypes: ['unsupported_claim', 'fabricated_field', 'speculative_language'],
    thresholds: {
      maxHallucinationScore: 0.2,
      maxIssues: {
        low: 5,
        medium: 2,
        high: 1,
        critical: 0,
      },
      minConfidence: 0.8,
    },
    heuristic: {
      usePatternDetection: true,
      useStatisticalAnalysis: true,
      useLanguageAnalysis: true,
    },
    promptAssisted: {
      useLLMValidation: false,
      temperature: 0.1,
      maxTokens: 300,
    },
    filtering: {
      ignoreConversationalFillers: true,
      ignoreHedgingLanguage: false,
      ignoreUncertaintyExpressions: false,
    },
  };

  const response2 = {
    text: 'I think the company might have increased revenue by approximately 25%. Maybe this happened because of their new product launch, but I\'m not completely sure.',
    provider: 'openai',
    model: 'gpt-4',
    finishReason: 'stop',
  };

  try {
    const detector = createHallucinationDetector(customConfig);
    const result2 = await detector.detectHallucinations(response2);
    
    console.log(`Hallucination Score: ${result2.result.hallucinationScore.toFixed(3)}`);
    console.log(`Risk Level: ${result2.summary.riskLevel}`);
    console.log(`Sensitivity: ${result2.metadata.sensitivityLevel}`);
    
    if (result2.result.issues.length > 0) {
      console.log('\n🚨 Conservative Mode Issues:');
      result2.result.issues.forEach(issue => {
        console.log(`  - [${issue.severity}] ${issue.description}`);
      });
    }
  } catch (error) {
    console.log(`❌ Custom detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('\n' + '=' .repeat(50) + '\n');

  // Example 3: Text-only detection
  console.log('3. Text-Only Detection:');
  console.log('=' .repeat(50));

  const text3 = 'The new AI model achieves 99.9% accuracy and processes 1 billion tokens per second. This is absolutely the best performance ever achieved. Researchers from Stanford confirmed these results.';
  
  try {
    const result3 = await detectHallucinationsInText(text3);
    
    console.log(`Hallucination Score: ${result3.result.hallucinationScore.toFixed(3)}`);
    console.log(`Total Issues: ${result3.result.issues.length}`);
    
    // Show issues by type
    const issuesByType = result3.summary.issuesByType;
    console.log('\n📊 Issues by Type:');
    Object.entries(issuesByType).forEach(([type, count]) => {
      if (count > 0) {
        console.log(`  ${type}: ${count}`);
      }
    });
  } catch (error) {
    console.log(`❌ Text detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('\n' + '=' .repeat(50) + '\n');

  // Example 4: Aggressive sensitivity
  console.log('4. Aggressive Sensitivity Detection:');
  console.log('=' .repeat(50));

  const aggressiveConfig: Partial<HallucinationDetectionConfig> = {
    sensitivity: 'aggressive',
    thresholds: {
      maxHallucinationScore: 0.5,
      maxIssues: {
        low: 15,
        medium: 8,
        high: 4,
        critical: 1,
      },
      minConfidence: 0.4,
    },
    filtering: {
      ignoreConversationalFillers: false,
      ignoreHedgingLanguage: true,
      ignoreUncertaintyExpressions: true,
    },
  };

  const response4 = {
    text: 'The study probably shows that revenue could be around 25% higher. It seems like the new marketing campaign worked well. I believe this trend might continue.',
    provider: 'openai',
    model: 'gpt-4',
    finishReason: 'stop',
  };

  try {
    const result4 = await quickHallucinationDetection(response4, aggressiveConfig);
    
    console.log(`Hallucination Score: ${result4.result.hallucinationScore.toFixed(3)}`);
    console.log(`Risk Level: ${result4.summary.riskLevel}`);
    
    if (result4.result.issues.length > 0) {
      console.log('\n🚨 Aggressive Mode Issues:');
      result4.result.issues.forEach(issue => {
        console.log(`  - [${issue.severity}] ${issue.type}: ${issue.description}`);
      });
    }
  } catch (error) {
    console.log(`❌ Aggressive detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('\n' + '=' .repeat(50) + '\n');

  // Example 5: Batch processing
  console.log('5. Batch Hallucination Detection:');
  console.log('=' .repeat(50));

  const responses = [response1, response2, response3, response4];
  console.log(`Processing ${responses.length} responses...`);
  
  const batchResults = await Promise.all(
    responses.map(response => quickHallucinationDetection(response))
  );

  console.log('\n📋 Batch Results:');
  batchResults.forEach((result, index) => {
    console.log(`  Response ${index + 1}: Score ${result.result.hallucinationScore.toFixed(3)} (${result.result.isHallucinated ? 'HALLUCINATED' : 'CLEAN'})`);
    console.log(`    Issues: ${result.result.issues.length} | Risk: ${result.summary.riskLevel}`);
  });

  const avgScore = batchResults.reduce((sum, r) => sum + r.result.hallucinationScore, 0) / batchResults.length;
  const totalIssues = batchResults.reduce((sum, r) => sum + r.result.issues.length, 0);
  
  console.log('\n📊 Batch Summary:');
  console.log(`  Average Hallucination Score: ${avgScore.toFixed(3)}`);
  console.log(`  Total Issues: ${totalIssues}`);
  console.log(`  Highest Risk: ${Math.max(...batchResults.map(r => r.summary.riskLevel === 'severe' ? 4 : r.summary.riskLevel === 'high' ? 3 : r.summary.riskLevel === 'moderate' ? 2 : r.summary.riskLevel === 'low' ? 1 : 0))}`);

  console.log('\n' + '=' .repeat(50));
  console.log('🎯 Hallucination Detection Examples Complete!');
  console.log('\nKey features demonstrated:');
  console.log('✅ Unsupported claim detection');
  console.log('✅ Fabricated field detection');
  console.log('✅ Inconsistent output detection');
  console.log('✅ Speculative language detection');
  console.log('✅ Configurable sensitivity levels');
  console.log('✅ Heuristic and prompt-assisted validation');
  console.log('✅ Detailed hallucination reports');
  console.log('✅ Provider-agnostic implementation');
  console.log('✅ Modular design');
}

// Run demonstration
demonstrateHallucinationDetection().catch(console.error);

export { demonstrateHallucinationDetection };
