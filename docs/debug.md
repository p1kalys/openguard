# Debug Snapshots

Sub-path import: `openguard/debug`

Captures the full request/response context at any point in the pipeline as an immutable snapshot. Snapshots can be persisted via the storage layer and queried later for post-mortem analysis.

## Usage

```ts
import { DebugCapture, createDebugSnapshot } from 'openguard/debug';

// Create a snapshot of the current request state
const snapshot = createDebugSnapshot({
  requestId:  'req-42',
  stage:      'after-validation',
  request:    rawRequest,
  response:   rawResponse,
  metadata:   { validationType: 'schema', passed: false, error: 'missing field' },
});

// Persist to storage
await storage.snapshots.saveSnapshot(snapshot);

// Retrieve later
const saved = await storage.snapshots.querySnapshots({
  requestId: 'req-42',
});
```

## Snapshot Shape

```ts
interface DebugSnapshot {
  snapshotId: string;
  requestId:  string;
  timestamp:  number;
  stage:      string;      // e.g. 'after-validation', 'before-retry'
  request?:   unknown;
  response?:  unknown;
  metadata?:  Record<string, unknown>;
}
```

## Integration with Event System

You can capture snapshots automatically on failure events:

```ts
import { eventEmitter } from 'openguard/events';
import { createDebugSnapshot } from 'openguard/debug';

eventEmitter.on('failure', async (event) => {
  const snapshot = createDebugSnapshot({
    requestId: event.requestId,
    stage:     'failure',
    metadata:  { error: event.data.error?.message },
  });
  await storage.snapshots.saveSnapshot(snapshot);
});
```

## Best Practices

- Only capture snapshots on failure or in debug builds — avoid capturing on every request in production to keep storage costs low.
- Omit large binary payloads from `request`/`response`; store IDs or truncated excerpts instead.
- Snapshots are not traces — use the [tracing module](tracing.md) for structured span trees, and snapshots for ad-hoc debugging payloads.
