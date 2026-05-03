# Contributing to OpenGuard

Thank you for your interest in contributing to OpenGuard! This guide will help you get started with contributing to this TypeScript library for AI guardrails.

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- pnpm (recommended) or npm/yarn
- Git

### Development Setup

1. **Fork the repository**
   ```bash
   # Fork the repository on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/openguard.git
   cd openguard
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up development environment**
   ```bash
   # Run tests to ensure everything is working
   pnpm test
   
   # Build the project
   pnpm build
   
   # Start development mode with watch
   pnpm dev
   ```

## 📁 Project Structure

```
openguard/
├── src/                    # Source code
│   ├── guardrails/        # Core guardrail logic
│   ├── providers/         # AI provider integrations
│   ├── repair/           # JSON repair utilities
│   ├── retry/            # Retry strategies
│   └── index.ts          # Main entry point
├── tests/                 # Test files
├── examples/             # Usage examples
├── docs/                 # Documentation (future)
└── README.md
```

## 🤝 How to Contribute

### Reporting Bugs

1. Check existing [issues](https://github.com/p1kalys/openguard/issues) to avoid duplicates
2. Use the bug report template and provide:
   - Clear description of the issue
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (Node.js version, OS, etc.)
   - Minimal reproduction example if possible

### Suggesting Features

1. Check existing issues and roadmap
2. Open a feature request with:
   - Clear use case and motivation
   - Proposed implementation approach
   - Potential breaking changes
   - Examples of how it would be used

### Submitting Changes

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes**
   - Follow existing code style and patterns
   - Add tests for new functionality
   - Update documentation if needed

3. **Run tests and linting**
   ```bash
   pnpm test
   pnpm lint
   pnpm type-check
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push and create a pull request**
   ```bash
   git push origin feature/your-feature-name
   ```

## 📝 Coding Standards

### Code Style

- Use TypeScript for all new code
- Follow existing naming conventions (camelCase for variables, PascalCase for classes)
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions small and focused

### Testing

- Write unit tests for all new functionality
- Use Vitest for testing (configured in `vitest.config.ts`)
- Test both success and error cases
- Maintain test coverage above 90%

- Test file naming: `*.test.ts`
- Place tests in the `tests/` directory mirroring the source structure

### Example Test Structure

```typescript
import { describe, it, expect } from 'vitest';
import { OpenGuard } from '../src/index';

describe('OpenGuard', () => {
  it('should validate safe input', () => {
    const guard = new OpenGuard();
    const result = guard.validate('Hello world');
    expect(result.valid).toBe(true);
  });

  it('should block sensitive patterns', () => {
    const guard = new OpenGuard({
      blockedPatterns: [/\b(password)\b/i]
    });
    const result = guard.validate('My password is secret');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('blocked pattern');
  });
});
```

## 🏗️ Development Guidelines

### Adding New Features

1. **Core Features** (src/guardrails/):
   - Extend `GuardrailConfig` interface for new options
   - Implement validation logic in `OpenGuard` class
   - Add comprehensive tests

2. **Provider Integrations** (src/providers/):
   - Implement `BaseProvider` interface
   - Add provider-specific configuration
   - Include error handling and retry logic

3. **Repair Strategies** (src/repair/):
   - Create repair functions following existing patterns
   - Test with various broken JSON formats
   - Ensure backward compatibility

### Documentation

- Update README.md for user-facing changes
- Add inline JSDoc comments for APIs
- Create examples in the `examples/` directory
- Update type definitions in TypeScript

### Version Management

- Follow semantic versioning (SemVer)
- Update CHANGELOG.md for significant changes
- Tag releases appropriately
- Update package.json version

## 🔄 Pull Request Process

### Before Submitting

1. **Code Review Checklist**
   - [ ] Code follows project style guidelines
   - [ ] Tests are added and passing
   - [ ] Documentation is updated
   - [ ] No breaking changes (or clearly documented)
   - [ ] TypeScript types are correct

2. **Testing Requirements**
   - All tests pass: `pnpm test`
   - Build succeeds: `pnpm build`
   - Linting passes: `pnpm lint`
   - Type checking passes: `pnpm type-check`

### Pull Request Template

```markdown
## Description
Brief description of changes and motivation.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Added tests for new functionality
- [ ] All existing tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] CHANGELOG.md updated (if applicable)
```

### Review Process

1. Automated checks must pass
2. At least one maintainer review required
3. Address all feedback promptly
4. Keep PR description updated with changes

## 🐛 Debugging Tips

### Common Issues

1. **TypeScript Errors**: Check types in `src/index.ts` and ensure proper exports
2. **Test Failures**: Run tests individually for better error messages
3. **Build Issues**: Check `tsconfig.json` and ensure all imports are correct

### Debug Commands

```bash
# Run specific test file
pnpm test tests/guardrails.test.ts

# Run tests with coverage
pnpm test --coverage

# Build in watch mode
pnpm build --watch

# Type checking only
pnpm type-check
```

## 📚 Resources

- [Vitest Documentation](https://vitest.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [pnpm Documentation](https://pnpm.io/)
- [Semantic Versioning](https://semver.org/)

## 💬 Getting Help

- Create an issue for bugs or questions
- Start a discussion for general topics
- Check existing documentation and examples
- Join our community discussions

## 🎯 Contributing Areas

Check our [Roadmap](README.md#roadmap) for the current status of features. We're especially looking for contributions in:

### 🔥 High Priority (Urgent Help Needed)
1. **Multiple AI Providers**: Anthropic, Gemini, Mistral, Groq, Ollama, OpenRouter
2. **Provider Fallback Chains**: Automatic switching between providers
3. **Hallucination Detection**: Identify unsupported claims and fabricated content
4. **Confidence Scoring**: Rate reliability of AI outputs

### 💪 Medium Priority (Contributions Welcome)
1. **Middleware System**: Plugin architecture for extensibility
2. **Streaming Stabilization**: Handle streaming responses reliably
3. **Semantic Validation**: Check for logical consistency
4. **Framework Integrations**: Next.js, Express, NestJS, LangChain, Vercel AI SDK
5. **Provider SDKs**: @openguard/openai, @openguard/anthropic packages

### 🌟 Beginner Friendly (Great First Contributions)
1. **Examples**: Real-world usage examples and tutorials
2. **Documentation**: API docs, guides, and best practices
3. **Community Tooling**: Templates, examples, starter kits
4. **Performance**: Optimization and benchmarking
5. **AI Debugging Tools**: Helper utilities for debugging

## 📄 License

By contributing to OpenGuard, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to OpenGuard! Your help makes AI interactions safer for everyone. 🚀
