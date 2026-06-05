# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |
| < 1.0   | No        |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

To report a security issue, email **selvamanipriyadarshini@gmail.com** with the subject line:

```
[SECURITY] OpenGuard — <brief description>
```

Include:
- A description of the vulnerability and its potential impact.
- Steps to reproduce (proof-of-concept if available).
- Any suggested mitigations.

You will receive an acknowledgement within **48 hours** and a resolution timeline within **7 days**.

## Disclosure Policy

1. We assess the report and confirm the vulnerability.
2. We develop and test a fix.
3. We release the fix and publish a security advisory on GitHub.
4. We credit the reporter (unless they prefer to remain anonymous).

We ask that you give us reasonable time to address the issue before any public disclosure.

## Scope

This policy applies to the `openguard` npm package itself.

Out of scope:
- Vulnerabilities in LLM providers (OpenAI, Anthropic, Google, etc.) — report to them directly.
- Issues in third-party dependencies — report to the upstream project.
- Theoretical attacks without a practical exploit path.

## Security Design Notes

OpenGuard is a **client-side TypeScript library** — it runs inside the process that calls it. There is no network server, no authentication surface, and no persistent database included in the package itself. The storage adapters write to local files or in-process memory only.

The main security-relevant operations are:
- **Input validation / guardrails** — regex pattern matching on user-supplied strings.
- **Plugin execution** — plugins run synchronously inside the caller's process; malicious plugins have the same privileges as the host application.
- **File storage adapter** — writes to a caller-specified local directory; no path traversal protections beyond what the OS provides.
