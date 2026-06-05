# Grounding Validation

Sub-path import: `openguard/validation` or `openguard` (root)

Validates that an LLM response is grounded in the provided source material. Detects unsupported claims — statements in the response that cannot be substantiated by the supplied context documents.

## Quick Start

```ts
import { quickGroundingCheck } from 'openguard';

const result = await quickGroundingCheck({
  response: {
    text: 'The capital of France is Paris. The population is 2.2 million.',
    provider: 'openai',
    model: 'gpt-4',
    finishReason: 'stop',
  },
  sources: [
    { content: 'Paris is the capital and largest city of France.' },
  ],
});

console.log(`Grounded: ${result.isGrounded}`);
console.log(`Score: ${result.groundingScore}`);
console.log(`Unsupported claims: ${result.issues.length}`);
```

## Configuration

```ts
import { createGroundingValidator } from 'openguard';

const validator = createGroundingValidator({
  strictness: 'balanced',     // 'strict' | 'balanced' | 'lenient'
  minGroundingScore: 0.7,
  checkNumericalClaims: true,
  checkEntityReferences: true,
});

const result = await validator.validate(response, sources);
```

## Result Shape

```ts
interface GroundingResult {
  isGrounded:     boolean;
  groundingScore: number;         // 0–1
  issues: GroundingIssue[];
  sourceCoverage: number;         // 0–1: fraction of response covered by sources
}

interface GroundingIssue {
  claim:      string;
  severity:   'low' | 'medium' | 'high' | 'critical';
  suggestion: string;
}
```

## Best Practices

- Always provide relevant source documents — grounding validation is only as good as the sources you supply.
- Use `'strict'` mode for regulated domains (medical, legal, financial) and `'lenient'` for creative tasks.
- Combine with [hallucination detection](hallucination.md) and [confidence aggregation](confidence.md) for a full reliability picture.
