# OpenGuard

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A minimal TypeScript library for implementing guardrails around AI interactions to ensure safe and responsible usage.

## 🚀 Features

- **Input Validation**: Validate user inputs against configurable rules
- **Pattern Filtering**: Block content using regex patterns
- **Token Limits**: Enforce maximum token limits for inputs
- **Runtime Configuration**: Update guardrail settings at runtime
- **TypeScript Support**: Full TypeScript definitions included
- **ES Modules**: Modern ES module support
- **Zero Dependencies**: Lightweight with minimal footprint

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

### OpenGuard Class

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

## 🎨 Usage Examples

### Example 1: Basic Content Filtering

```typescript
import { OpenGuard } from 'openguard';

const guard = new OpenGuard({
  enabled: true,
  blockedPatterns: [
    /\b(password|secret|api[_-]?key)\b/i,
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/ // Phone numbers
  ]
});

const inputs = [
  "What is the weather today?",
  "My password is secret123",
  "Call me at 555-123-4567"
];

inputs.forEach(input => {
  const result = guard.validate(input);
  console.log(`"${input}" -> ${result.valid ? '✅' : '❌'} ${result.reason || ''}`);
});
```

### Example 2: Token Limit Enforcement

```typescript
import { OpenGuard } from 'openguard';

const guard = new OpenGuard({
  maxTokens: 100 // Approximate character limit
});

const shortText = "Hello world";
const longText = "A".repeat(200);

console.log(guard.validate(shortText));  // { valid: true }
console.log(guard.validate(longText));   // { valid: false, reason: "Input exceeds maximum token limit" }
```

### Example 3: Dynamic Configuration Updates

```typescript
import { OpenGuard } from 'openguard';

const guard = new OpenGuard();

// Start with basic protection
console.log(guard.validate("My secret is hidden")); // ✅ Valid

// Add sensitive pattern protection
guard.updateConfig({
  blockedPatterns: [/\b(secret|hidden|private)\b/i]
});

// Now the same input is blocked
console.log(guard.validate("My secret is hidden")); // ❌ Blocked
```

### Example 4: Integration with AI APIs

```typescript
import { OpenGuard } from 'openguard';

class SafeAIChat {
  private guard: OpenGuard;

  constructor() {
    this.guard = new OpenGuard({
      enabled: true,
      maxTokens: 1000,
      blockedPatterns: [
        /\b(password|token|api[_-]?key)\b/i,
        /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/
      ]
    });
  }

  async sendMessage(userInput: string) {
    // Validate input first
    const validation = this.guard.validate(userInput);
    if (!validation.valid) {
      throw new Error(`Input blocked: ${validation.reason}`);
    }

    // Proceed with AI API call
    // const response = await aiAPI.chat(userInput);
    // return response;
    
    return `Processed: ${userInput}`;
  }
}

const chat = new SafeAIChat();
chat.sendMessage("What is the weather?") // ✅ Works
chat.sendMessage("My password is secret123") // ❌ Throws error
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

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/openguard.git
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

- 📖 [Documentation](https://github.com/yourusername/openguard/wiki)
- 🐛 [Issue Tracker](https://github.com/yourusername/openguard/issues)
- 💬 [Discussions](https://github.com/yourusername/openguard/discussions)

## 🗺️ Roadmap

- [ ] Topic-based filtering
- [ ] Machine learning-based content detection
- [ ] Real-time monitoring dashboard
- [ ] Integration with popular AI frameworks
- [ ] Performance optimizations

## 📊 Stats

- 📦 Package size: ~14KB
- ⚡ Zero runtime dependencies
- 🎯 TypeScript support
- 🚀 ES modules compatible

---

**Made with ❤️ for safer AI interactions**
