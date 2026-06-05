# Plugin SDK

Sub-path import: `openguard/plugins`

Third-party plugin system for OpenGuard. Plugins are plain objects — no classes, no DI, no lifecycle magic. Every hook is optional and can be async.

## Hook Categories

### Transform hooks — can modify the data they receive

| Hook | Fires | Return to modify |
|------|-------|-----------------|
| `beforeRequest` | Before sending to provider | `GenerateRequest` |
| `afterResponse` | After raw provider response | `GenerateResponse` |
| `beforeCompletion` | Before returning final result | `GenerateResponse` |

### Observer hooks — fire-and-forget, return value is ignored

| Hook | Fires |
|------|-------|
| `beforeValidation` | Before each validation pass |
| `afterValidation` | After each validation pass |
| `beforeRetry` | When a retry is triggered (before the delay) |
| `afterRetry` | After a retry attempt resolves |

## Writing a Plugin

```ts
import type { OpenGuardPlugin } from 'openguard/plugins';

export const rateLimitPlugin: OpenGuardPlugin = {
  name:        'rate-limit-guard',
  version:     '1.0.0',
  author:      'platform-team',
  description: 'Enforces per-minute token budgets',

  async beforeRequest(ctx) {
    await rateLimiter.check(ctx.provider);
    // return nothing to leave the request unchanged
  },

  afterResponse(ctx) {
    rateLimiter.consume(ctx.response.usage?.totalTokens ?? 0);
  },
};
```

### Transform example

```ts
export const deterministicPlugin: OpenGuardPlugin = {
  name:    'force-temperature',
  version: '0.1.0',
  beforeRequest(ctx) {
    return { ...ctx.request, temperature: 0 };
  },
};
```

### Async observer example

```ts
export const auditPlugin: OpenGuardPlugin = {
  name:    'audit-logger',
  version: '1.0.0',
  async afterValidation(ctx) {
    if (!ctx.passed) {
      await auditLog.write({
        requestId:      ctx.requestId,
        validationType: ctx.validationType,
        error:          ctx.error,
      });
    }
  },
};
```

## Registry

```ts
import { pluginRegistry } from 'openguard/plugins';

pluginRegistry.register(rateLimitPlugin);
pluginRegistry.register(deterministicPlugin);

// Inspect
pluginRegistry.list();           // OpenGuardPlugin[]
pluginRegistry.get('rate-limit-guard');
pluginRegistry.size;             // number

// Remove
pluginRegistry.unregister('rate-limit-guard');
pluginRegistry.clear();
```

### Using hooks in your pipeline

```ts
// Modify request before sending
const request = await pluginRegistry.runBeforeRequest(rawRequest, {
  requestId, provider: 'openai', attempt: 0,
});

const response = await provider.generate(request);

// Modify response after receiving
const modified = await pluginRegistry.runAfterResponse(response, {
  requestId, request, provider: 'openai', attempt: 0, durationMs: 120,
});

// Observer hooks
await pluginRegistry.runBeforeValidation({ requestId, response, validationType: 'schema', provider: 'openai' });
await pluginRegistry.runAfterValidation({ requestId, response, validationType: 'schema', passed: true, provider: 'openai' });

await pluginRegistry.runBeforeRetry({ requestId, attempt: 1, maxRetries: 3, reason: 'validation failed', delayMs: 500, error, provider: 'openai' });
await pluginRegistry.runAfterRetry({ requestId, attempt: 1, maxRetries: 3, provider: 'openai', succeeded: true, response });

// Final transform before returning to caller
const final = await pluginRegistry.runBeforeCompletion(modified, {
  requestId, provider: 'openai', totalAttempts: 1, durationMs: 235,
});
```

## Error Isolation

A plugin hook that throws never crashes the pipeline. Errors are forwarded to `registry.onError`:

```ts
// Route to your logger instead of console.error
pluginRegistry.onError = (plugin, hook, err) =>
  logger.warn({ plugin: plugin.name, hook }, err);
```

## Isolated Registry (per-tenant / per-test)

```ts
import { PluginRegistry } from 'openguard/plugins';

const tenantRegistry = new PluginRegistry();
tenantRegistry.register(tenantPlugin);
```

## Plugin Metadata

```ts
interface PluginMeta {
  name:         string;   // unique registry key
  version:      string;   // semver
  author?:      string;
  description?: string;
}
```
