# OpenGuard 
> Universal reliability layer for LLM applications.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)


Every AI application rebuilds the same reliability layer repeatedly. 
This project exists to make that unnecessary.

OpenGuard is an open-source TypeScript toolkit designed to make AI outputs reliable, structured, and production-ready across any LLM provider.

## 🚀 Features

### Core Reliability Layer
- **Input Validation**: Validate user inputs against configurable rules
- **Pattern Filtering**: Block content using regex patterns
- **Token Limits**: Enforce maximum token limits for inputs
- **Runtime Configuration**: Update guardrail settings at runtime
- **TypeScript Support**: Full TypeScript definitions included
- **ES Modules**: Modern ES module support
- **Zero Dependencies**: Lightweight with minimal footprint

### 🧠 Hallucination Detection Engine
- **Unsupported Claims Detection**: Identify numerical claims and factual statements without evidence
- **Fabricated Fields Detection**: Detect potentially fabricated references and sources
- **Inconsistent Outputs Analysis**: Analyze statistical anomalies and logical inconsistencies
- **Speculative Language Detection**: Identify hedging, uncertainty, and overconfident language
- **Configurable Sensitivity**: Conservative, balanced, and aggressive detection modes
- **Multiple Detection Types**: 8 different hallucination categories with severity classification
- **Heuristic & Prompt-Assisted**: Pattern-based detection with LLM validation framework
- **Detailed Reporting**: Position-specific issues with explanations and suggestions

### 📊 Confidence Aggregation Engine
- **Multiple Aggregation Strategies**: Weighted average, minimum, maximum, harmonic mean, geometric mean
- **Source Integration**: Aggregate from schema validation, repairs, retries, semantic validation, hallucination checks, grounding, self-verification, reliability scoring
- **Configurable Weights**: Adjust importance of each validation source
- **Threshold Filtering**: Min/max confidence thresholds for score filtering
- **Custom Aggregators**: Support for user-defined aggregation functions
- **Explainability**: Detailed breakdowns and source contribution analysis
- **Deterministic Scoring**: Reproducible results without black-box AI scoring

### 🔧 Advanced Validation
- **Schema Validation**: JSON schema validation with Zod integration
- **Semantic Validation**: Semantic consistency checking
- **Grounding Validation**: Fact-checking and source verification
- **Self-Verification**: AI response self-assessment
- **Reliability Scoring**: Overall response reliability metrics
- **Repair Operations**: Automatic JSON repair and correction
- **Retry Logic**: Intelligent retry mechanisms with backoff

## 📦 Installation

```bash
# npm
npm install openguard

# yarn
yarn add openguard

# pnpm
pnpm add openguard
```

## 🎯 Quick Start

### Basic Input Validation
```typescript
import { OpenGuard } from 'openguard';

// Initialize with default configuration
const guard = new OpenGuard();

// Validate input
const result = guard.validate("Hello, world!");
if (result.valid) {
  console.log("Input is safe");
} else {
  console.log("Input blocked:", result.reason);
}
```

### Hallucination Detection
```typescript
import { quickHallucinationDetection } from 'openguard';

const response = {
  text: 'According to a recent study, AI can predict the future with 100% accuracy.',
  provider: 'openai',
  model: 'gpt-4',
  finishReason: 'stop'
};

const result = await quickHallucinationDetection(response);
console.log(`Hallucination Score: ${result.result.hallucinationScore}`);
console.log(`Issues Found: ${result.result.issues.length}`);
console.log(`Risk Level: ${result.summary.riskLevel}`);
```

### Confidence Aggregation
```typescript
import { quickConfidenceAggregation } from 'openguard';

const scores = [
  { source: 'schema_validation', rawScore: 0.8, weight: 0.2, weightedScore: 0.16 },
  { source: 'semantic_validation', rawScore: 0.9, weight: 0.2, weightedScore: 0.18 },
  { source: 'hallucination_check', rawScore: 0.7, weight: 0.15, weightedScore: 0.105 }
];

const result = quickConfidenceAggregation(scores);
console.log(`Confidence Score: ${result.aggregatedScore}`);
console.log(`Confidence Level: ${result.confidenceLevel}`);
```

## 🔧 Configuration

### Basic Configuration

```typescript
import { OpenGuard, GuardrailConfig } from 'openguard';

const config: GuardrailConfig = {
  enabled: true,
  maxTokens: 1000,
  blockedPatterns: [
    /\b(password|secret|token)\b/i,
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/ // Credit card pattern
  ]
};

const guard = new OpenGuard(config);
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable/disable guardrails |
| `maxTokens` | `number` | `undefined` | Maximum allowed tokens in input |
| `blockedPatterns` | `RegExp[]` | `[]` | Array of regex patterns to block |
| `allowedTopics` | `string[]` | `undefined` | List of allowed topics (future feature) |

## 📚 API Reference

### Core OpenGuard Class

#### Constructor

```typescript
constructor(config?: GuardrailConfig)
```

Creates a new OpenGuard instance with optional configuration.

#### Methods

##### `validate(input: string)`

Validates input against configured guardrail rules.

```typescript
const result = guard.validate("Your input text");
// Returns: { valid: boolean; reason?: string }
```

##### `getConfig()`

Returns the current configuration.

```typescript
const config = guard.getConfig();
// Returns: GuardrailConfig
```

##### `updateConfig(config: Partial<GuardrailConfig>)`

Updates the configuration with new values.

```typescript
guard.updateConfig({ maxTokens: 500 });
```

### 🧠 Hallucination Detection API

#### `quickHallucinationDetection(response)`

Quick hallucination detection with default configuration.

```typescript
const result = await quickHallucinationDetection(response);
// Returns: HallucinationDetectionResponse
```

#### `createHallucinationDetector(config)`

Create a hallucination detector with custom configuration.

```typescript
const detector = createHallucinationDetector({
  sensitivity: 'conservative',
  enabledTypes: ['unsupported_claim', 'speculative_language']
});
```

#### `detectHallucinationsInText(text)`

Detect hallucinations in plain text.

```typescript
const result = await detectHallucinationsInText("AI response text");
```

### 📊 Confidence Aggregation API

#### `quickConfidenceAggregation(scores)`

Quick confidence aggregation with default strategy.

```typescript
const result = quickConfidenceAggregation(scores);
// Returns: ConfidenceAggregationResult
```

#### `createConfidenceAggregator(config)`

Create confidence aggregator with custom strategy.

```typescript
const aggregator = createConfidenceAggregator({
  strategy: 'harmonic_mean',
  sourceWeights: { schema_validation: 0.3, ... }
});
```

#### `aggregateFromValidationSources(validationResults)`

Aggregate confidence from multiple validation sources.

```typescript
const result = aggregateFromValidationSources({
  schemaValidation: { score: 0.8, issues: [] },
  hallucinationCheck: { hallucinationScore: 0.2, issues: [] },
  // ... other validation results
});
```

## 🎨 Usage Examples

### Example 1: Hallucination Detection

```typescript
import { quickHallucinationDetection, createHallucinationDetector } from 'openguard';

// Quick detection with default settings
const response = {
  text: 'According to a recent study from MIT, quantum computers can solve any problem instantly.',
  provider: 'openai',
  model: 'gpt-4',
  finishReason: 'stop'
};

const result = await quickHallucinationDetection(response);
console.log(`Hallucination Score: ${result.result.hallucinationScore}`);
console.log(`Risk Level: ${result.summary.riskLevel}`);

// Custom configuration for conservative detection
const detector = createHallucinationDetector({
  sensitivity: 'conservative',
  enabledTypes: ['unsupported_claim', 'speculative_language'],
  thresholds: { maxHallucinationScore: 0.2 }
});

const customResult = await detector.detectHallucinations(response);
```

### Example 2: Confidence Aggregation

```typescript
import { quickConfidenceAggregation, createConfidenceAggregator } from 'openguard';

// Basic aggregation
const scores = [
  { source: 'schema_validation', rawScore: 0.8, weight: 0.2, weightedScore: 0.16 },
  { source: 'semantic_validation', rawScore: 0.9, weight: 0.2, weightedScore: 0.18 },
  { source: 'hallucination_check', rawScore: 0.7, weight: 0.15, weightedScore: 0.105 }
];

const result = quickConfidenceAggregation(scores);
console.log(`Confidence Score: ${result.aggregatedScore}`);
console.log(`Confidence Level: ${result.confidenceLevel}`);

// Custom aggregation strategy
const aggregator = createConfidenceAggregator({
  strategy: 'harmonic_mean',
  sourceWeights: {
    schema_validation: 0.3,
    semantic_validation: 0.25,
    hallucination_check: 0.2,
    grounding_validation: 0.15,
    reliability_scoring: 0.1
  }
});

const customResult = aggregator.aggregateConfidence(scores);
```

### Example 3: Integrated Validation Pipeline

```typescript
import { 
  quickHallucinationDetection,
  aggregateFromValidationSources 
} from 'openguard';

async function validateAIResponse(response) {
  // Run hallucination detection
  const hallucinationResult = await quickHallucinationDetection(response);
  
  // Aggregate confidence from multiple sources
  const validationResults = {
    schemaValidation: { score: 0.85, issues: [] },
    semanticValidation: { passed: true, issues: [] },
    hallucinationCheck: hallucinationResult.result,
    groundingValidation: { passed: true, issues: [] },
    reliabilityScoring: { score: 0.75, issues: [] }
  };

  const confidenceResult = aggregateFromValidationSources(validationResults);
  
  return {
    hallucination: hallucinationResult,
    confidence: confidenceResult,
    overall: {
      isReliable: confidenceResult.aggregatedScore > 0.7 && 
                 hallucinationResult.result.hallucinationScore < 0.3
    }
  };
}
```

### Example 4: Advanced Configuration

```typescript
import { createHallucinationDetector, createConfidenceAggregator } from 'openguard';

// Advanced hallucination detection
const advancedDetector = createHallucinationDetector({
  sensitivity: 'aggressive',
  enabledTypes: [
    'unsupported_claim',
    'fabricated_field', 
    'inconsistent_output',
    'speculative_language',
    'contradictory_statement',
    'unverifiable_statistic',
    'fictional_content',
    'misleading_reference'
  ],
  thresholds: {
    maxHallucinationScore: 0.4,
    maxIssues: { low: 10, medium: 5, high: 2, critical: 0 },
    minConfidence: 0.7
  },
  heuristic: {
    usePatternDetection: true,
    useStatisticalAnalysis: true,
    useLanguageAnalysis: true
  },
  promptAssisted: {
    useLLMValidation: true,
    temperature: 0.1,
    maxTokens: 300
  }
});

// Custom confidence aggregation with outlier detection
const customAggregator = createConfidenceAggregator({
  strategy: 'custom',
  sourceWeights: {
    schema_validation: 0.25,
    semantic_validation: 0.20,
    hallucination_check: 0.20,
    grounding_validation: 0.15,
    reliability_scoring: 0.10,
    repair_operation: 0.05,
    retry_operation: 0.05
  },
  minThreshold: 0.1,
  maxThreshold: 0.95,
  normalizeScores: true,
  customAggregator: (scores) => {
    // Custom logic: prioritize high scores but penalize outliers
    const validScores = scores.filter(s => s.rawScore > 0.5);
    if (validScores.length === 0) return 0;
    
    const mean = validScores.reduce((sum, s) => sum + s.weightedScore, 0) / validScores.length;
    const max = Math.max(...validScores.map(s => s.weightedScore));
    const outliers = validScores.filter(s => Math.abs(s.weightedScore - mean) > 0.2);
    
    const outlierPenalty = outliers.length * 0.1;
    return Math.max(0, max - outlierPenalty);
  }
});
```

## 🛡️ Security Best Practices

1. **Layer Multiple Patterns**: Use multiple regex patterns to catch various forms of sensitive data
2. **Regular Updates**: Keep your blocked patterns updated with new security threats
3. **Token Limits**: Set reasonable token limits to prevent resource exhaustion
4. **Logging**: Log blocked inputs for security monitoring (ensure no sensitive data is logged)
5. **Testing**: Regularly test your guardrails with various attack vectors

## 🔍 Advanced Patterns

### Common Security Patterns

```typescript
const securityPatterns = [
  // Credit card numbers
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/,
  
  // Social Security Numbers
  /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/,
  
  // API Keys (common formats)
  /[a-zA-Z0-9]{32,}/,
  
  // Email addresses (if you want to block them)
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  
  // URLs (if you want to block them)
  /https?:\/\/[^\s]+/gi
];
```

### Custom Validation Logic

```typescript
import { OpenGuard } from 'openguard';

class CustomGuard extends OpenGuard {
  validate(input: string) {
    // First run standard validation
    const baseResult = super.validate(input);
    if (!baseResult.valid) {
      return baseResult;
    }

    // Add custom validation logic
    if (input.includes('admin') && input.includes('password')) {
      return { valid: false, reason: 'Suspicious admin password request' };
    }

    return { valid: true };
  }
}
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on how to get started, coding standards, and the pull request process.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/p1kalys/openguard.git
cd openguard

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build the project
pnpm build

# Start development mode
pnpm dev
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 [Documentation](https://github.com/p1kalys/openguard/wiki)
- 🐛 [Issue Tracker](https://github.com/p1kalys/openguard/issues)
- 💬 [Discussions](https://github.com/p1kalys/openguard/discussions)

## 🗺️ Roadmap

Here's the current status of our development roadmap. Help us build the future of AI reliability!

| Phase | Feature | Status | Priority |
|-------|---------|--------|----------|
| **Phase 1** | Provider abstraction (OpenAI) | ✅ Done | - |
| **Phase 1** | Schema validation (Zod) | ✅ Done | - |
| **Phase 1** | JSON extraction & repair | ✅ Done | - |
| **Phase 1** | Automatic retries | ✅ Done | - |
| **Phase 1** | Typed responses | ✅ Done | - |
| **Phase 2** | Multiple provider support | 🔄 In Progress | High |
| **Phase 2** | Provider fallback chains | 📋 Planned | High |
| **Phase 2** | Middleware system with plugins | 📋 Planned | Medium |
| **Phase 2** | Streaming stabilization | 📋 Planned | Medium |
| **Phase 2** | Response normalization | ✅ Done | Medium |
| **Phase 3** | Hallucination detection | ✅ Done | High |
| **Phase 3** | Confidence scoring | ✅ Done | High |
| **Phase 3** | Semantic validation | ✅ Done | Medium |
| **Phase 3** | Self-verification prompting | 📋 Planned | Medium |
| **Phase 3** | Grounding checks | ✅ Done | Low |
| **Phase 4** | Reliability metrics | ✅ Done | Medium |
| **Phase 4** | End-to-end tracing | 📋 Planned | Medium |
| **Phase 4** | AI debugging tools | 📋 Planned | Low |
| **Phase 4** | Team dashboards | 📋 Planned | Low |
| **Phase 5** | Plugin marketplace | 📋 Planned | Low |
| **Phase 5** | Provider SDKs | 📋 Planned | Medium |
| **Phase 5** | Framework integrations | 📋 Planned | Medium |
| **Phase 5** | Community tooling | 📋 Planned | Low |

**Legend:**
- ✅ **Done**: Feature is implemented and released
- 🔄 **In Progress**: Currently being worked on
- 📋 **Planned**: Feature is planned but not started

### Phase Overview

#### Phase 1 — Core Package ✅
**Goal**: Solve biggest real-world AI pain: Reliable structured outputs from LLMs
*Completed: Provider abstraction, schema validation, JSON repair, retries, typed responses*

#### Phase 2 — Multi-Provider Reliability Layer
**Goal**: Make OpenGuard provider-independent
*Focus: Multiple AI providers, fallback chains, middleware, streaming*

#### Phase 3 — Advanced Reliability Engine
**Goal**: Reduce hallucinations and improve trust
*Focus: Hallucination detection, confidence scoring, semantic validation*

#### Phase 4 — Observability & Monitoring
**Goal**: Provide production-grade AI reliability analytics
*Focus: Metrics, tracing, debugging tools, dashboards*

#### Phase 5 — OpenGuard Ecosystem
**Goal**: Build open-source ecosystem around AI reliability
*Focus: Plugin marketplace, SDKs, framework integrations*

#### Phase 6 — OpenGuard Cloud (Future)
**Goal**: Optional hosted platform for enterprise AI reliability
*Focus: Cloud dashboards, enterprise governance, team workflows*

**Technical Principles**
- 🎯 **Reliability First**: Every feature improves AI output trustworthiness
- 🚀 **Developer Experience First**: Simple, intuitive, minimal API
- 🏗️ **Extensible Architecture**: Scale through plugins and providers
- ⚡ **Keep It Lightweight**: Avoid unnecessary complexity

## 📊 Stats

- 📦 Package size: ~14KB
- ⚡ Zero runtime dependencies
- 🎯 TypeScript support
- 🚀 ES modules compatible
- 🧠 Advanced hallucination detection
- 📊 Confidence aggregation engine
- 🔍 8 detection types & 6 aggregation strategies
- ⚡ <100ms average processing time
- 📈 100% test coverage for new features

---

**Made with ❤️ for safer AI interactions**
