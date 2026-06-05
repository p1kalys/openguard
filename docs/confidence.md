# Confidence Aggregation

Sub-path import: `openguard` (root)

Aggregates confidence scores from multiple validation sources into a single normalized reliability signal. Six aggregation strategies, configurable source weights, and custom aggregator support.

## Aggregation Strategies

| Strategy | Description |
|----------|-------------|
| `weighted_average` | Default; each source is weighted by its configured importance |
| `minimum` | Conservative — final score equals the lowest source score |
| `maximum` | Optimistic — final score equals the highest source score |
| `harmonic_mean` | Penalizes low outliers more than arithmetic mean |
| `geometric_mean` | Multiplicative; any score near zero collapses the result |
| `custom` | Provide your own aggregation function |

## Quick Start

```ts
import { quickConfidenceAggregation } from 'openguard';

const scores = [
  { source: 'schema_validation',    rawScore: 0.85, weight: 0.25, weightedScore: 0.2125 },
  { source: 'hallucination_check',  rawScore: 0.72, weight: 0.20, weightedScore: 0.144  },
  { source: 'grounding_validation', rawScore: 0.90, weight: 0.20, weightedScore: 0.18   },
];

const result = quickConfidenceAggregation(scores);

console.log(`Score: ${result.aggregatedScore}`);     // 0–1
console.log(`Level: ${result.confidenceLevel}`);     // 'very_low' | 'low' | 'medium' | 'high' | 'very_high'
```

## Custom Configuration

```ts
import { createConfidenceAggregator } from 'openguard';

const aggregator = createConfidenceAggregator({
  strategy: 'harmonic_mean',
  sourceWeights: {
    schema_validation:    0.30,
    semantic_validation:  0.20,
    hallucination_check:  0.20,
    grounding_validation: 0.15,
    reliability_scoring:  0.10,
    repair_operation:     0.05,
  },
  minThreshold: 0.1,
  maxThreshold: 0.95,
  normalizeScores: true,
});

const result = aggregator.aggregateConfidence(scores);
```

## Aggregating from Validation Results

```ts
import { aggregateFromValidationSources } from 'openguard';

const result = aggregateFromValidationSources({
  schemaValidation:  { score: 0.85, issues: [] },
  semanticValidation:{ passed: true, issues: [] },
  hallucinationCheck:{ hallucinationScore: 0.15, issues: [] },
  groundingValidation:{ isGrounded: true, groundingScore: 0.9, issues: [] },
  reliabilityScoring:{ score: 0.80, issues: [] },
});
```

## Result Shape

```ts
interface ConfidenceAggregationResult {
  aggregatedScore:  number;           // 0–1
  confidenceLevel:  ConfidenceLevel;
  sourceBreakdown:  SourceContribution[];
  strategy:         string;
}

type ConfidenceLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
```

## Custom Aggregator Example

```ts
const aggregator = createConfidenceAggregator({
  strategy: 'custom',
  customAggregator: (scores) => {
    // Penalize outliers: drop scores > 0.2 below the mean
    const mean = scores.reduce((s, x) => s + x.weightedScore, 0) / scores.length;
    const filtered = scores.filter(x => mean - x.weightedScore <= 0.2);
    return filtered.reduce((s, x) => s + x.weightedScore, 0) / filtered.length;
  },
});
```

## Best Practices

- Use `weighted_average` as the default; only switch strategies when you have a clear reason.
- Tune `sourceWeights` based on which validators are most meaningful for your domain.
- Feed the `aggregatedScore` into a downstream gate: only return responses to users when `aggregatedScore > threshold`.
- Pair with [hallucination detection](hallucination.md) and [grounding validation](grounding.md) for the most complete confidence picture.
