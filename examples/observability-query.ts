/**
 * Observability Query API — usage examples
 *
 * Demonstrates all five query methods with every supported filter dimension:
 *   provider · model · timeRange · requestType
 *
 * No HTTP framework or external telemetry required — all results are plain
 * serialisable objects.
 */

import { ObservabilityQueryEngine } from '../src/query/index.js';
import { createMemoryStorage }      from '../src/storage/index.js';
import type { SpanStatus }          from '../src/tracing/types.js';

// ---------------------------------------------------------------------------
// Bootstrap: isolated in-memory storage + query engine
// ---------------------------------------------------------------------------

const storage = createMemoryStorage();
const query   = new ObservabilityQueryEngine(storage);

// ---------------------------------------------------------------------------
// Seed helper data
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  const now = Date.now();

  // -- Traces ----------------------------------------------------------------
  await storage.traces.saveTrace({
    traceId: 'tr-1', requestId: 'req-1',
    startTime: now - 5_000, duration: 820,
    status: 'ok' as SpanStatus, rootSpanId: 'sp-1', spans: [],
    provider: { name: 'openai', model: 'gpt-4o', attempts: 1,
                tokens: { prompt: 80, completion: 120, total: 200 } },
    attributes: {},
  });
  await storage.traces.saveTrace({
    traceId: 'tr-2', requestId: 'req-2',
    startTime: now - 3_000, duration: 1_450,
    status: 'error' as SpanStatus, rootSpanId: 'sp-2',
    spans: [{ spanId: 'sp-2', traceId: 'tr-2', name: 'call', stage: 'provider',
              startTime: now - 3_000, status: 'error',
              error: { message: 'rate limit exceeded', name: 'RateLimitError' },
              attributes: {}, events: [] }],
    provider: { name: 'openai', model: 'gpt-4o', attempts: 3 },
    attributes: {},
  });
  await storage.traces.saveTrace({
    traceId: 'tr-3', requestId: 'req-3',
    startTime: now - 1_000, duration: 310,
    status: 'ok' as SpanStatus, rootSpanId: 'sp-3', spans: [],
    provider: { name: 'anthropic', model: 'claude-3-5-sonnet', attempts: 1,
                tokens: { prompt: 60, completion: 90, total: 150 } },
    attributes: {},
  });

  // -- Metrics ---------------------------------------------------------------
  const dims = (p: string, m: string) =>
    ({ provider: p, model: m });

  await storage.metrics.saveMetrics([
    { metricType: 'latency', timestamp: now - 5_000,
      dimensions: dims('openai', 'gpt-4o'),
      data: { duration: 820, stage: 'total' } },
    { metricType: 'latency', timestamp: now - 3_000,
      dimensions: dims('openai', 'gpt-4o'),
      data: { duration: 1_450, stage: 'total' } },
    { metricType: 'latency', timestamp: now - 1_000,
      dimensions: dims('anthropic', 'claude-3-5-sonnet'),
      data: { duration: 310, stage: 'total' } },

    { metricType: 'token.usage', timestamp: now - 5_000,
      dimensions: dims('openai', 'gpt-4o'),
      data: { promptTokens: 80, completionTokens: 120, totalTokens: 200 } },
    { metricType: 'token.usage', timestamp: now - 1_000,
      dimensions: dims('anthropic', 'claude-3-5-sonnet'),
      data: { promptTokens: 60, completionTokens: 90, totalTokens: 150 } },

    { metricType: 'retry', timestamp: now - 3_000,
      dimensions: dims('openai', 'gpt-4o'),
      data: { attempt: 2, maxAttempts: 3, reason: 'rate_limit', delayMs: 1_000 } },

    { metricType: 'validation.failure', timestamp: now - 4_000,
      dimensions: dims('openai', 'gpt-4o'),
      data: { validationType: 'schema', message: 'Missing required field', critical: true } },

    { metricType: 'hallucination', timestamp: now - 2_000,
      dimensions: dims('openai', 'gpt-4o'),
      data: { score: 0.21, detected: false, confidence: 0.91 } },
    { metricType: 'hallucination', timestamp: now - 800,
      dimensions: dims('anthropic', 'claude-3-5-sonnet'),
      data: { score: 0.07, detected: false, confidence: 0.97 } },

    { metricType: 'provider.failure', timestamp: now - 3_500,
      dimensions: dims('openai', 'gpt-4o'),
      data: { stage: 'provider', attempts: 3, errorType: 'RateLimitError' } },
  ]);

  // -- Snapshots (validation failures + hallucination checks) ----------------
  await storage.snapshots.saveSnapshot({
    id: 'snap-1', requestId: 'req-1', capturedAt: now - 5_000,
    status: 'failure', provider: 'openai', model: 'gpt-4o',
    validations: [
      { kind: 'schema', passed: false,
        issues: [{ type: 'MISSING_FIELD', message: 'field "name" required',
                   severity: 'critical', path: '$.name' }] },
    ],
    hallucinationChecks: [],
    retries: [],
  });
  await storage.snapshots.saveSnapshot({
    id: 'snap-2', requestId: 'req-2', capturedAt: now - 3_000,
    status: 'failure', provider: 'openai', model: 'gpt-4o',
    validations: [
      { kind: 'semantic', passed: false,
        issues: [{ type: 'INCONSISTENT_DATA', message: 'contradictory values',
                   severity: 'warning', path: '$.items' }] },
    ],
    hallucinationChecks: [
      { hallucinationScore: 0.63, isHallucinated: true, riskLevel: 'medium',
        issues: [{ type: 'FACTUAL_INCONSISTENCY', message: 'contradicts source',
                   confidence: 0.78 }] },
    ],
    retries: [],
  });
  await storage.snapshots.saveSnapshot({
    id: 'snap-3', requestId: 'req-3', capturedAt: now - 1_000,
    status: 'success', provider: 'anthropic', model: 'claude-3-5-sonnet',
    validations: [{ kind: 'schema', passed: true, issues: [] }],
    hallucinationChecks: [
      { hallucinationScore: 0.04, isHallucinated: false, riskLevel: 'low', issues: [] },
    ],
    retries: [],
  });
}

// ---------------------------------------------------------------------------
// Examples
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  await seed();

  // ── 1. queryMetrics ──────────────────────────────────────────────────────

  console.log('=== 1. queryMetrics (all providers) ===');
  const allMetrics = await query.queryMetrics();
  console.log(`Total events  : ${allMetrics.totalEvents}`);
  console.log(`Avg latency   : ${allMetrics.latency.overall.avg.toFixed(0)} ms`);
  console.log(`P95 latency   : ${allMetrics.latency.overall.p95.toFixed(0)} ms`);
  console.log(`Total tokens  : ${allMetrics.tokens.totalTokens}`);
  console.log(`Retry events  : ${allMetrics.retries.totalRetryEvents}`);
  console.log(`Val failures  : ${allMetrics.validationFailures.total}`);
  console.log(`Halluc checks : ${allMetrics.hallucinations.totalChecks}`);

  console.log('\n=== 1b. queryMetrics — filtered by provider ===');
  const openaiMetrics = await query.queryMetrics({ provider: 'openai' });
  console.log(`OpenAI events : ${openaiMetrics.totalEvents}`);
  console.log(`Avg latency   : ${openaiMetrics.latency.overall.avg.toFixed(0)} ms`);

  console.log('\n=== 1c. queryMetrics — filtered by model ===');
  const sonnetMetrics = await query.queryMetrics({ model: 'claude-3-5-sonnet' });
  console.log(`Sonnet events : ${sonnetMetrics.totalEvents}`);

  // ── 2. queryTraces ───────────────────────────────────────────────────────

  console.log('\n=== 2. queryTraces (all) ===');
  const traces = await query.queryTraces();
  console.log(`Total traces  : ${traces.total}`);
  console.log(`Success rate  : ${(traces.successRate * 100).toFixed(0)}%`);
  console.log(`Avg duration  : ${traces.avgDurationMs.toFixed(0)} ms`);
  console.log(`P95 duration  : ${traces.p95DurationMs.toFixed(0)} ms`);
  console.log('Providers:', Object.keys(traces.byProvider).join(', '));

  console.log('\n=== 2b. queryTraces — openai only, page 1/2 ===');
  const tracesPage = await query.queryTraces({ provider: 'openai', limit: 1, offset: 0 });
  console.log(`Items (pg 1)  : ${tracesPage.items.length}`);
  console.log(`Has more      : ${tracesPage.hasMore}`);

  console.log('\n=== 2c. queryTraces — time range filter ===');
  const rangeTraces = await query.queryTraces({
    timeRange: { start: Date.now() - 4_500, end: Date.now() },
  });
  console.log(`In range      : ${rangeTraces.total}`);

  // ── 3. queryValidationFailures ───────────────────────────────────────────

  console.log('\n=== 3. queryValidationFailures ===');
  const valFails = await query.queryValidationFailures();
  console.log(`Total failing : ${valFails.total}`);
  console.log(`Critical      : ${valFails.criticalCount} (${(valFails.criticalRate * 100).toFixed(0)}%)`);
  console.log('By kind:', valFails.byKind);
  console.log('By provider:', valFails.byProvider);
  console.log('Top issue:', valFails.topIssues[0]?.issueType ?? 'none');

  console.log('\n=== 3b. queryValidationFailures — openai + critical only ===');
  const criticalFails = await query.queryValidationFailures({ provider: 'openai' });
  console.log(`OpenAI failures: ${criticalFails.total}`);

  // ── 4. queryHallucinationReports ─────────────────────────────────────────

  console.log('\n=== 4. queryHallucinationReports ===');
  const halluc = await query.queryHallucinationReports();
  console.log(`Total checks  : ${halluc.totalChecks}`);
  console.log(`Detected      : ${halluc.detectionCount}`);
  console.log(`Detection rate: ${(halluc.detectionRate * 100).toFixed(0)}%`);
  console.log(`Avg score     : ${halluc.avgScore.toFixed(3)}`);
  console.log('Score dist    :', halluc.scoreDistribution);
  console.log('Providers:', Object.keys(halluc.byProvider));

  console.log('\n=== 4b. queryHallucinationReports — anthropic only ===');
  const anthropicHalluc = await query.queryHallucinationReports({ provider: 'anthropic' });
  console.log(`Anthropic checks: ${anthropicHalluc.totalChecks}`);
  console.log(`Detection rate  : ${(anthropicHalluc.detectionRate * 100).toFixed(0)}%`);

  // ── 5. queryProviderReliability ──────────────────────────────────────────

  console.log('\n=== 5. queryProviderReliability ===');
  const reliability = await query.queryProviderReliability();
  console.log(`Best provider   : ${reliability.bestProvider}`);
  console.log(`Fastest provider: ${reliability.fastestProvider}`);
  console.log(`Most used       : ${reliability.mostUsedProvider}`);
  for (const p of reliability.providers) {
    console.log(`\n  [${p.provider}]`);
    console.log(`    Models          : ${p.models.join(', ')}`);
    console.log(`    Requests        : ${p.totalRequests}`);
    console.log(`    Success rate    : ${(p.successRate * 100).toFixed(0)}%`);
    console.log(`    Avg latency     : ${p.avgLatencyMs.toFixed(0)} ms`);
    console.log(`    P95 latency     : ${p.p95LatencyMs.toFixed(0)} ms`);
    console.log(`    Retry rate      : ${(p.retryRate * 100).toFixed(0)}%`);
    console.log(`    Val failure rate: ${(p.validationFailureRate * 100).toFixed(0)}%`);
    console.log(`    Halluc det rate : ${(p.hallucinationDetectionRate * 100).toFixed(0)}%`);
    console.log(`    Reliability     : ${p.reliabilityScore}/100`);
  }

  console.log('\n=== 5b. queryProviderReliability — model filter ===');
  const modelRel = await query.queryProviderReliability({ model: 'gpt-4o' });
  console.log(`Providers for gpt-4o: ${modelRel.providers.map((p) => p.provider).join(', ')}`);

  // ── Combined: time range across all five ─────────────────────────────────

  console.log('\n=== Combined: last 2 s — all five queries ===');
  const recentFilter = { timeRange: { start: Date.now() - 2_000, end: Date.now() } };
  const [m, t, v, h, r] = await Promise.all([
    query.queryMetrics(recentFilter),
    query.queryTraces(recentFilter),
    query.queryValidationFailures(recentFilter),
    query.queryHallucinationReports(recentFilter),
    query.queryProviderReliability(recentFilter),
  ]);
  console.log(`Metrics events  : ${m.totalEvents}`);
  console.log(`Traces total    : ${t.total}`);
  console.log(`Val failures    : ${v.total}`);
  console.log(`Halluc checks   : ${h.totalChecks}`);
  console.log(`Providers found : ${r.providers.length}`);

  console.log('\n=== Observability Query examples complete ===');
}

run().catch(console.error);
