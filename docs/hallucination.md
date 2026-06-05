# Hallucination Detection

Sub-path import: `openguard` (root)

Detects hallucinated content in LLM responses across 8 issue categories using heuristic pattern analysis and optional LLM-assisted validation.

## Detection Categories

| Type | Description |
|------|-------------|
| `unsupported_claim` | Numerical facts or assertions without evidence |
| `fabricated_field` | References to non-existent papers, people, or data sources |
| `inconsistent_output` | Statistical anomalies or logical self-contradictions |
| `speculative_language` | Overconfident assertions or unsupported hedging |
| `contradictory_statement` | Claims that contradict each other |
| `unverifiable_statistic` | Exact statistics that cannot be verified |
| `fictional_content` | Invented events, quotes, or citations |
| `misleading_reference` | Real sources misrepresented or misquoted |

## Quick Start

```ts
import { quickHallucinationDetection } from 'openguard';

const response = {
  text: 'A 2023 MIT study found that GPT-4 predicts stock prices with 99% accuracy.',
  provider: 'openai',
  model: 'gpt-4',
  finishReason: 'stop',
};

const result = await quickHallucinationDetection(response);

console.log(`Score: ${result.result.hallucinationScore}`);   // 0–1; higher = more hallucination
console.log(`Risk:  ${result.summary.riskLevel}`);           // 'low' | 'medium' | 'high' | 'critical'
console.log(`Issues: ${result.result.issues.length}`);
```

## Custom Configuration

```ts
import { createHallucinationDetector } from 'openguard';

const detector = createHallucinationDetector({
  sensitivity: 'conservative',           // 'conservative' | 'balanced' | 'aggressive'
  enabledTypes: [
    'unsupported_claim',
    'speculative_language',
    'fabricated_field',
  ],
  thresholds: {
    maxHallucinationScore: 0.3,
    maxIssues: { low: 10, medium: 5, high: 2, critical: 0 },
    minConfidence: 0.7,
  },
  heuristic: {
    usePatternDetection:  true,
    useStatisticalAnalysis: true,
    useLanguageAnalysis:  true,
  },
  promptAssisted: {
    useLLMValidation: false,
  },
});

const result = await detector.detectHallucinations(response);
```

## Plain Text Detection

```ts
import { detectHallucinationsInText } from 'openguard';

const result = await detectHallucinationsInText('AI can predict the future with certainty.');
```

## Result Shape

```ts
interface HallucinationDetectionResponse {
  result: {
    hallucinationScore: number;         // 0–1
    issues: HallucinationIssue[];
    confidence: number;
  };
  summary: {
    riskLevel:      'low' | 'medium' | 'high' | 'critical';
    issueCount:     number;
    recommendation: string;
  };
}

interface HallucinationIssue {
  type:        string;
  severity:    'low' | 'medium' | 'high' | 'critical';
  description: string;
  position?:   { start: number; end: number };
  suggestion:  string;
}
```

## Sensitivity Modes

| Mode | Use Case |
|------|----------|
| `conservative` | Minimize false positives; only flag clear hallucinations |
| `balanced` | Default; good general-purpose setting |
| `aggressive` | Maximize recall; flag anything suspicious (more false positives) |

## Best Practices

- For production, start with `'balanced'` and tune thresholds based on your domain.
- Combine with [grounding validation](grounding.md) when source documents are available.
- Feed `hallucinationScore` into [confidence aggregation](confidence.md) for a unified reliability signal.
