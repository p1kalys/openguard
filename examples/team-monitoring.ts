/**
 * Team monitoring metadata system — usage examples
 *
 * Demonstrates:
 *   - Registering applications across teams, projects, and environments
 *   - Per-app metric recording with the attached MetricsCollector
 *   - Single-app profiles
 *   - Team-level and project-level reliability reports
 *   - Time-range and environment filters
 *   - Fleet-wide overview
 */

import { AppRegistry, MonitoringAggregator } from '../src/monitoring/index.js';

// ---------------------------------------------------------------------------
// Bootstrap — isolated registry (not the global singleton)
// ---------------------------------------------------------------------------

const registry = new AppRegistry();
const agg      = new MonitoringAggregator(registry);

// ---------------------------------------------------------------------------
// 1. Register applications
// ---------------------------------------------------------------------------

console.log('=== 1. Register Applications ===');

registry.register({
  appId:       'chat-api',
  appName:     'Chat API',
  team:        'platform',
  project:     'llm-gateway',
  environment: 'production',
  version:     '2.4.1',
  tags:        { tier: 'critical', region: 'us-east-1' },
});

registry.register({
  appId:       'search-api',
  appName:     'Semantic Search',
  team:        'platform',
  project:     'llm-gateway',
  environment: 'production',
  version:     '1.8.0',
});

registry.register({
  appId:       'docs-bot',
  appName:     'Docs Assistant',
  team:        'devex',
  project:     'internal-tools',
  environment: 'production',
  version:     '0.9.2',
});

registry.register({
  appId:       'chat-api-staging',
  appName:     'Chat API (staging)',
  team:        'platform',
  project:     'llm-gateway',
  environment: 'staging',
  version:     '2.5.0-rc1',
});

registry.register({
  appId:       'experiment-bot',
  appName:     'Experiment Bot',
  team:        'devex',
  project:     'internal-tools',
  environment: 'development',
});

console.log(`Registered apps: ${registry.size}`);

// ---------------------------------------------------------------------------
// 2. Record per-app metrics
// ---------------------------------------------------------------------------

console.log('\n=== 2. Record Metrics ===');

// Helper: seed metrics for an app
function seed(
  appId: string,
  requests: number,
  avgLatency: number,
  errorRate: number,
  retryRate: number,
  valFailRate: number,
  hallucinationRate: number,
  tokensPerRequest: number,
) {
  const col = registry.getCollector(appId);
  const provider = 'openai';
  const model    = 'gpt-4o';

  for (let i = 0; i < requests; i++) {
    // Latency (total stage)
    col.recordLatency({ provider, model }, avgLatency + (Math.random() - 0.5) * 200, 'total');

    // Errors
    if (Math.random() < errorRate) {
      col.recordProviderFailure({ provider, model }, 'provider', 'upstream error', 3);
    }

    // Retries
    if (Math.random() < retryRate) {
      col.recordRetry({ provider, model }, 2, 3, 'rate_limit', 500);
    }

    // Validation failures
    if (Math.random() < valFailRate) {
      col.recordValidationFailure({ provider, model }, 'schema', 'missing field', false);
    }

    // Hallucination checks
    const detected = Math.random() < hallucinationRate;
    col.recordHallucination({ provider, model }, detected ? 0.75 : 0.1, detected, 0.9);

    // Token usage
    col.recordTokenUsage({ provider, model },
      Math.round(tokensPerRequest * 0.4),
      Math.round(tokensPerRequest * 0.6),
      tokensPerRequest,
    );
  }
}

seed('chat-api',         200, 380,  0.02, 0.05, 0.03, 0.02, 450);
seed('search-api',       150, 520,  0.04, 0.08, 0.06, 0.04, 320);
seed('docs-bot',          80, 640,  0.10, 0.12, 0.15, 0.08, 600);
seed('chat-api-staging',  30, 410,  0.06, 0.10, 0.05, 0.03, 460);
seed('experiment-bot',    10, 920,  0.20, 0.25, 0.30, 0.15, 800);

console.log('Metrics seeded for all apps');

// ---------------------------------------------------------------------------
// 3. Single-app profile
// ---------------------------------------------------------------------------

console.log('\n=== 3. Single-App Profile: chat-api ===');
const chatProfile = agg.getAppProfile('chat-api');
const cm = chatProfile.metrics;
console.log(`App           : ${chatProfile.context.appName} [${chatProfile.context.environment}]`);
console.log(`Team/Project  : ${chatProfile.context.team} / ${chatProfile.context.project}`);
console.log(`Requests      : ${cm.requestCount}`);
console.log(`Success rate  : ${(cm.successRate * 100).toFixed(1)}%`);
console.log(`Avg latency   : ${cm.avgLatencyMs.toFixed(0)} ms`);
console.log(`P95 latency   : ${cm.p95LatencyMs.toFixed(0)} ms`);
console.log(`Retry rate    : ${(cm.retryRate * 100).toFixed(1)}%`);
console.log(`Val fail rate : ${(cm.validationFailureRate * 100).toFixed(1)}%`);
console.log(`Halluc rate   : ${(cm.hallucinationDetectionRate * 100).toFixed(1)}%`);
console.log(`Total tokens  : ${cm.totalTokens}`);
console.log(`Reliability   : ${cm.reliabilityScore}/100`);

// ---------------------------------------------------------------------------
// 4. Team report — platform (production only)
// ---------------------------------------------------------------------------

console.log('\n=== 4. Team Report: platform (production) ===');
const platformReport = agg.getTeamReport('platform', { environment: 'production' });
console.log(`Apps in scope : ${platformReport.apps.length}`);
console.log(`Best app      : ${platformReport.bestApp}`);
console.log(`Worst app     : ${platformReport.worstApp}`);
console.log(`Fastest app   : ${platformReport.fastestApp}`);
console.log('\nPer-app scores:');
for (const p of platformReport.apps) {
  const m = p.metrics;
  console.log(`  [${p.context.appId}]  reliability=${m.reliabilityScore}/100  avg=${m.avgLatencyMs.toFixed(0)}ms  reqs=${m.requestCount}`);
}
const ps = platformReport.summary;
console.log('\nTeam summary:');
console.log(`  Total requests : ${ps.requestCount}`);
console.log(`  Avg success    : ${(ps.successRate * 100).toFixed(1)}%`);
console.log(`  Avg latency    : ${ps.avgLatencyMs.toFixed(0)} ms`);
console.log(`  Reliability    : ${ps.reliabilityScore}/100`);

// ---------------------------------------------------------------------------
// 5. Team report — platform (all environments, including staging)
// ---------------------------------------------------------------------------

console.log('\n=== 5. Team Report: platform (all environments) ===');
const platformAll = agg.getTeamReport('platform');
console.log(`Apps in scope : ${platformAll.apps.length}`);
for (const p of platformAll.apps) {
  console.log(`  [${p.context.appId}] env=${p.context.environment}  reliability=${p.metrics.reliabilityScore}/100`);
}

// ---------------------------------------------------------------------------
// 6. Team report — devex
// ---------------------------------------------------------------------------

console.log('\n=== 6. Team Report: devex ===');
const devexReport = agg.getTeamReport('devex');
console.log(`Apps in scope : ${devexReport.apps.length}`);
console.log(`Best app      : ${devexReport.bestApp}`);
for (const p of devexReport.apps) {
  console.log(`  [${p.context.appId}] env=${p.context.environment}  reliability=${p.metrics.reliabilityScore}/100`);
}
console.log(`Team avg reliability: ${devexReport.summary.reliabilityScore}/100`);

// ---------------------------------------------------------------------------
// 7. Project report — llm-gateway
// ---------------------------------------------------------------------------

console.log('\n=== 7. Project Report: llm-gateway ===');
const gwReport = agg.getProjectReport('llm-gateway');
console.log(`Apps in scope : ${gwReport.apps.length}`);
console.log(`Best app      : ${gwReport.bestApp}`);
console.log(`Total tokens  : ${gwReport.summary.totalTokens}`);

// ---------------------------------------------------------------------------
// 8. Time-range filter
// ---------------------------------------------------------------------------

console.log('\n=== 8. Profile with time-range filter ===');
// Record a fresh metric with a known timestamp
const freshTs = Date.now();
registry.getCollector('chat-api').recordLatency({ provider: 'openai', model: 'gpt-4o' }, 99, 'total');

const recentProfile = agg.getAppProfile('chat-api', {
  timeRange: { start: freshTs, end: Date.now() + 1 },
});
console.log(`Requests (last 1 ms window): ${recentProfile.metrics.requestCount}`);

// ---------------------------------------------------------------------------
// 9. Fleet overview
// ---------------------------------------------------------------------------

console.log('\n=== 9. Fleet Overview (all environments) ===');
const allProfiles = agg.getAllProfiles();
console.log('Rank  App                     Env          Score  Latency(avg)');
console.log('────  ───────────────────────  ───────────  ─────  ────────────');
for (const [i, p] of allProfiles.entries()) {
  const m = p.metrics;
  const name = p.context.appName.padEnd(23);
  const env  = p.context.environment.padEnd(11);
  console.log(`  ${String(i + 1).padStart(2)}  ${name}  ${env}  ${String(m.reliabilityScore).padStart(4)}/100  ${m.avgLatencyMs.toFixed(0).padStart(7)} ms`);
}

// ---------------------------------------------------------------------------
// 10. Environment-scoped fleet overview
// ---------------------------------------------------------------------------

console.log('\n=== 10. Production-only Fleet ===');
const prodProfiles = agg.getAllProfiles({ environment: 'production' });
console.log(`Production apps: ${prodProfiles.length}`);
for (const p of prodProfiles) {
  console.log(`  ${p.context.appId}  [team: ${p.context.team}]  score: ${p.metrics.reliabilityScore}/100`);
}

console.log('\n=== Team Monitoring examples complete ===');
