# Team Monitoring

Sub-path import: `openguard/monitoring`

Application-level reliability profiles with environment metadata (`production` / `staging` / `development`), team/project identifiers, and cross-application aggregation. Designed for organizations running multiple AI-powered applications.

## Concepts

- **AppProfile** — per-application configuration: `appId`, `environment`, `team`, `project`, optional tags.
- **AppMetrics** — computed reliability snapshot for one application: `requestCount`, `avgLatencyMs`, `p95LatencyMs`, `successRate`, `retryRate`, `validationFailureRate`, `hallucinationDetectionRate`, `reliabilityScore` (0–100).
- **TeamMonitor** — collects `AppProfile` registrations and computes metrics from a `StorageRegistry`.

## Usage

```ts
import { TeamMonitor } from 'openguard/monitoring';
import { createFileStorage } from 'openguard/storage';

const storage = createFileStorage('./data/openguard');
const monitor = new TeamMonitor(storage);

monitor.registerApp({
  appId:       'chat-service',
  environment: 'production',
  team:        'platform',
  project:     'assistant-v2',
});

// Compute metrics for a specific app
const metrics = await monitor.getAppMetrics('chat-service', {
  timeRange: { start: Date.now() - 86_400_000, end: Date.now() },
});

console.log(`Reliability score: ${metrics.reliabilityScore}/100`);
console.log(`Retry rate: ${(metrics.retryRate * 100).toFixed(1)}%`);
```

### Cross-App Aggregation

```ts
// All apps in production
const summary = await monitor.summariseEnvironment('production', {
  timeRange: { start: ..., end: ... },
});

// All apps owned by a team
const teamSummary = await monitor.summariseTeam('platform');

// All registered apps
const allProfiles  = monitor.listApps();
const allSummaries = await monitor.summariseAll();
```

## `AppMetrics` Shape

```ts
interface AppMetrics {
  appId:                     string;
  environment:               'production' | 'staging' | 'development';
  requestCount:              number;
  avgLatencyMs:              number;
  p95LatencyMs:              number;
  successRate:               number;   // 0–1
  retryRate:                 number;   // 0–1
  validationFailureRate:     number;   // 0–1
  hallucinationDetectionRate:number;   // 0–1
  reliabilityScore:          number;   // 0–100
  computedAt:                number;   // Unix ms
}
```

## Aggregation Notes

- Cross-app summaries use **request-count–weighted averages** so a high-traffic application contributes proportionally more than a low-traffic one.
- `retryRate` counts distinct *retry sequences* (`attempt === 1` events), not raw retry events, to avoid overcounting from apps with many retries per request.
- `reliabilityScore` is a composite heuristic: high success rate, low retry rate, low validation failures, and low hallucination detections each contribute positively.
