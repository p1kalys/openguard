/**
 * Team monitoring metadata system — tests
 *
 * Covers AppRegistry and MonitoringAggregator in isolation using fresh
 * instances for each test (no global singletons).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AppRegistry }          from '../src/monitoring/registry.js';
import { MonitoringAggregator } from '../src/monitoring/aggregator.js';
import type { AppContext }       from '../src/monitoring/types.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let seq = 0;
const nextId = () => `app_${++seq}`;

function ctx(overrides: Partial<AppContext> = {}): AppContext {
  const id = nextId();
  return {
    appId:       id,
    appName:     `App ${id}`,
    team:        'platform',
    project:     'llm-gateway',
    environment: 'production',
    ...overrides,
  };
}

let registry: AppRegistry;
let agg:      MonitoringAggregator;

beforeEach(() => {
  seq      = 0;
  registry = new AppRegistry();
  agg      = new MonitoringAggregator(registry);
});

// ---------------------------------------------------------------------------
// AppRegistry
// ---------------------------------------------------------------------------

describe('AppRegistry — registration', () => {
  it('registers an app and makes it retrievable', () => {
    const c = ctx();
    registry.register(c);
    expect(registry.getApp(c.appId)).toMatchObject({ appId: c.appId, team: c.team });
  });

  it('returns undefined for unknown appId', () => {
    expect(registry.getApp('ghost')).toBeUndefined();
  });

  it('re-registering updates context and preserves collector', () => {
    const c = ctx();
    registry.register(c);
    const col = registry.getCollector(c.appId);
    col.recordLatency({ provider: 'openai' }, 100, 'total');

    registry.register({ ...c, version: '2.0.0' });
    expect(registry.getApp(c.appId)!.version).toBe('2.0.0');
    // collector should still have the metric
    expect(registry.getCollector(c.appId).count()).toBe(1);
  });

  it('unregister removes context and collector', () => {
    const c = ctx();
    registry.register(c);
    expect(registry.unregister(c.appId)).toBe(true);
    expect(registry.getApp(c.appId)).toBeUndefined();
    expect(() => registry.getCollector(c.appId)).toThrow();
  });

  it('unregister returns false for unknown appId', () => {
    expect(registry.unregister('no-such')).toBe(false);
  });

  it('size reflects the number of registered apps', () => {
    expect(registry.size).toBe(0);
    registry.register(ctx());
    registry.register(ctx());
    expect(registry.size).toBe(2);
  });

  it('getCollector throws for unregistered app', () => {
    expect(() => registry.getCollector('missing')).toThrow(/not registered/);
  });

  it('getCollector returns the same instance across calls', () => {
    const c = ctx();
    registry.register(c);
    expect(registry.getCollector(c.appId)).toBe(registry.getCollector(c.appId));
  });

  it('clear removes all apps and collectors', () => {
    registry.register(ctx());
    registry.register(ctx());
    registry.clear();
    expect(registry.size).toBe(0);
  });
});

describe('AppRegistry — getApps filtering', () => {
  beforeEach(() => {
    registry.register(ctx({ team: 'platform', project: 'gw', environment: 'production' }));
    registry.register(ctx({ team: 'platform', project: 'gw', environment: 'staging'    }));
    registry.register(ctx({ team: 'devex',    project: 'tools', environment: 'production' }));
  });

  it('returns all apps when no filter supplied', () => {
    expect(registry.getApps()).toHaveLength(3);
  });

  it('filters by team', () => {
    expect(registry.getApps({ team: 'platform' })).toHaveLength(2);
  });

  it('filters by project', () => {
    expect(registry.getApps({ project: 'tools' })).toHaveLength(1);
  });

  it('filters by environment', () => {
    expect(registry.getApps({ environment: 'staging' })).toHaveLength(1);
  });

  it('filters by appId', () => {
    const [first] = registry.getApps();
    expect(registry.getApps({ appId: first.appId })).toHaveLength(1);
  });

  it('ANDs multiple filter fields', () => {
    expect(registry.getApps({ team: 'platform', environment: 'production' })).toHaveLength(1);
  });
});

describe('AppRegistry — metrics lifecycle', () => {
  it('clearMetrics resets collector without unregistering', () => {
    const c = ctx();
    registry.register(c);
    registry.getCollector(c.appId).recordLatency({ provider: 'openai' }, 100, 'total');
    expect(registry.getCollector(c.appId).count()).toBe(1);
    registry.clearMetrics(c.appId);
    expect(registry.getCollector(c.appId).count()).toBe(0);
    expect(registry.getApp(c.appId)).toBeDefined();
  });

  it('clearMetrics returns false for unknown app', () => {
    expect(registry.clearMetrics('ghost')).toBe(false);
  });

  it('getCollectors returns only apps matching the filter', () => {
    registry.register(ctx({ team: 'a' }));
    registry.register(ctx({ team: 'b' }));
    const cols = registry.getCollectors({ team: 'a' });
    expect(cols.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// MonitoringAggregator — single-app profile
// ---------------------------------------------------------------------------

describe('MonitoringAggregator — getAppProfile', () => {
  it('throws for unregistered app', () => {
    expect(() => agg.getAppProfile('missing')).toThrow(/not registered/);
  });

  it('returns zero metrics when no events recorded', () => {
    const c = ctx();
    registry.register(c);
    const p = agg.getAppProfile(c.appId);
    expect(p.metrics.requestCount).toBe(0);
    expect(p.metrics.reliabilityScore).toBe(0);
  });

  it('echoes context correctly', () => {
    const c = ctx({ team: 'eng', environment: 'staging', version: '1.2.3' });
    registry.register(c);
    const p = agg.getAppProfile(c.appId);
    expect(p.context.team).toBe('eng');
    expect(p.context.environment).toBe('staging');
    expect(p.context.version).toBe('1.2.3');
  });

  it('counts requestCount from latency-total events', () => {
    const c = ctx();
    registry.register(c);
    const col = registry.getCollector(c.appId);
    col.recordLatency({ provider: 'openai' }, 200, 'total');
    col.recordLatency({ provider: 'openai' }, 300, 'total');
    col.recordLatency({ provider: 'openai' }, 100, 'provider'); // different stage — not counted
    const p = agg.getAppProfile(c.appId);
    expect(p.metrics.requestCount).toBe(2);
  });

  it('computes avgLatencyMs and p95LatencyMs', () => {
    const c = ctx();
    registry.register(c);
    const col = registry.getCollector(c.appId);
    [100, 200, 300, 400, 500].forEach((d) =>
      col.recordLatency({ provider: 'openai' }, d, 'total'),
    );
    const p = agg.getAppProfile(c.appId);
    expect(p.metrics.avgLatencyMs).toBe(300);
    expect(p.metrics.p95LatencyMs).toBeGreaterThanOrEqual(400);
  });

  it('computes successCount and errorCount', () => {
    const c = ctx();
    registry.register(c);
    const col = registry.getCollector(c.appId);
    // 5 requests
    for (let i = 0; i < 5; i++) col.recordLatency({ provider: 'openai' }, 100, 'total');
    // 2 errors
    col.recordProviderFailure({ provider: 'openai' }, 'provider', 'err', 1);
    col.recordProviderFailure({ provider: 'openai' }, 'provider', 'err', 1);
    const p = agg.getAppProfile(c.appId);
    expect(p.metrics.errorCount).toBe(2);
    expect(p.metrics.successCount).toBe(3);
    expect(p.metrics.successRate).toBeCloseTo(3 / 5, 5);
  });

  it('computes retryRate capped at 1', () => {
    const c = ctx();
    registry.register(c);
    const col = registry.getCollector(c.appId);
    col.recordLatency({ provider: 'openai' }, 100, 'total'); // 1 request
    // 10 retries (much more than requests)
    for (let i = 0; i < 10; i++) col.recordRetry({ provider: 'openai' }, 2, 3, 'rate_limit', 500);
    const p = agg.getAppProfile(c.appId);
    expect(p.metrics.retryRate).toBe(1);
  });

  it('computes validationFailureRate', () => {
    const c = ctx();
    registry.register(c);
    const col = registry.getCollector(c.appId);
    for (let i = 0; i < 4; i++) col.recordLatency({ provider: 'openai' }, 100, 'total');
    col.recordValidationFailure({ provider: 'openai' }, 'schema', 'bad field', true);
    col.recordValidationFailure({ provider: 'openai' }, 'schema', 'bad field', false);
    const p = agg.getAppProfile(c.appId);
    expect(p.metrics.validationFailureRate).toBe(0.5);
  });

  it('computes hallucinationDetectionRate', () => {
    const c = ctx();
    registry.register(c);
    const col = registry.getCollector(c.appId);
    col.recordHallucination({ provider: 'openai' }, 0.8, true,  0.9);
    col.recordHallucination({ provider: 'openai' }, 0.1, false, 0.95);
    col.recordHallucination({ provider: 'openai' }, 0.1, false, 0.95);
    const p = agg.getAppProfile(c.appId);
    expect(p.metrics.hallucinationDetectionRate).toBeCloseTo(1 / 3, 5);
  });

  it('computes totalTokens and avgTokensPerRequest', () => {
    const c = ctx();
    registry.register(c);
    const col = registry.getCollector(c.appId);
    col.recordLatency({ provider: 'openai' }, 100, 'total');
    col.recordLatency({ provider: 'openai' }, 100, 'total');
    col.recordTokenUsage({ provider: 'openai' }, 100, 200, 300);
    col.recordTokenUsage({ provider: 'openai' }, 50,  50,  100);
    const p = agg.getAppProfile(c.appId);
    expect(p.metrics.totalTokens).toBe(400);
    expect(p.metrics.avgTokensPerRequest).toBe(200); // 400 / 2 requests
  });

  it('reliabilityScore is 80 for perfect app (no errors/retries/failures)', () => {
    const c = ctx();
    registry.register(c);
    const col = registry.getCollector(c.appId);
    col.recordLatency({ provider: 'openai' }, 100, 'total');
    col.recordHallucination({ provider: 'openai' }, 0.1, false, 0.95);
    const p = agg.getAppProfile(c.appId);
    // successRate=1 (no provider failure recorded) → 40
    // retryRate=0 → 20
    // valFailRate=0 → 20
    // hallucinationDetectionRate=0 → 20  → total = 100... wait
    // Actually: successCount = max(0, requestCount - errorCount) = max(0, 1 - 0) = 1
    // successRate = 1/1 = 1 → 40
    // retryRate = 0 → 20
    // valFailRate = 0 → 20
    // hallucDetRate = 0/1 = 0 → 20
    // Total = 100
    expect(p.metrics.reliabilityScore).toBe(100);
  });

  it('reliabilityScore is between 0 and 100', () => {
    const c = ctx();
    registry.register(c);
    const col = registry.getCollector(c.appId);
    for (let i = 0; i < 5; i++) {
      col.recordLatency({ provider: 'openai' }, 100, 'total');
      col.recordProviderFailure({ provider: 'openai' }, 'provider', 'err', 3);
      col.recordRetry({ provider: 'openai' }, 2, 3, 'timeout', 500);
      col.recordValidationFailure({ provider: 'openai' }, 'schema', 'bad', true);
      col.recordHallucination({ provider: 'openai' }, 0.9, true, 0.8);
    }
    const p = agg.getAppProfile(c.appId);
    expect(p.metrics.reliabilityScore).toBeGreaterThanOrEqual(0);
    expect(p.metrics.reliabilityScore).toBeLessThanOrEqual(100);
  });

  it('applies timeRange filter to metrics', () => {
    const c = ctx();
    registry.register(c);
    const col = registry.getCollector(c.appId);

    // Record a metric "in the past"
    const past = Date.now() - 60_000;
    col.record({ metricType: 'latency', timestamp: past, dimensions: { provider: 'openai' }, data: { duration: 999, stage: 'total' } } as any);

    // Record a recent metric
    col.recordLatency({ provider: 'openai' }, 100, 'total');

    const recent = agg.getAppProfile(c.appId, {
      timeRange: { start: Date.now() - 1_000, end: Date.now() + 1_000 },
    });
    expect(recent.metrics.requestCount).toBe(1);
    expect(recent.metrics.avgLatencyMs).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// MonitoringAggregator — team reports
// ---------------------------------------------------------------------------

describe('MonitoringAggregator — getTeamReport', () => {
  it('returns empty report for unknown team', () => {
    const r = agg.getTeamReport('ghost');
    expect(r.apps).toHaveLength(0);
    expect(r.summary.requestCount).toBe(0);
    expect(r.bestApp).toBeUndefined();
  });

  it('includes all production apps for the team', () => {
    registry.register(ctx({ team: 'platform', environment: 'production' }));
    registry.register(ctx({ team: 'platform', environment: 'production' }));
    registry.register(ctx({ team: 'devex',    environment: 'production' }));
    const r = agg.getTeamReport('platform');
    expect(r.apps).toHaveLength(2);
    expect(r.team).toBe('platform');
  });

  it('environment filter narrows apps', () => {
    registry.register(ctx({ team: 'platform', environment: 'production' }));
    registry.register(ctx({ team: 'platform', environment: 'staging'    }));
    const r = agg.getTeamReport('platform', { environment: 'staging' });
    expect(r.apps).toHaveLength(1);
    expect(r.environment).toBe('staging');
  });

  it('bestApp has highest reliabilityScore', () => {
    const goodApp = ctx({ team: 't' });
    const badApp  = ctx({ team: 't' });
    registry.register(goodApp);
    registry.register(badApp);

    // good: 5 requests, no errors
    for (let i = 0; i < 5; i++)
      registry.getCollector(goodApp.appId).recordLatency({ provider: 'openai' }, 100, 'total');

    // bad: 5 requests, 4 errors
    for (let i = 0; i < 5; i++) {
      registry.getCollector(badApp.appId).recordLatency({ provider: 'openai' }, 100, 'total');
      registry.getCollector(badApp.appId).recordProviderFailure({ provider: 'openai' }, 'provider', 'err', 1);
    }

    const r = agg.getTeamReport('t');
    expect(r.bestApp).toBe(goodApp.appId);
    expect(r.worstApp).toBe(badApp.appId);
  });

  it('worstApp is undefined when only one app', () => {
    registry.register(ctx({ team: 't' }));
    const r = agg.getTeamReport('t');
    expect(r.worstApp).toBeUndefined();
  });

  it('fastestApp has lowest avgLatencyMs', () => {
    const fast = ctx({ team: 't' });
    const slow = ctx({ team: 't' });
    registry.register(fast);
    registry.register(slow);
    registry.getCollector(fast.appId).recordLatency({ provider: 'openai' }, 50,  'total');
    registry.getCollector(slow.appId).recordLatency({ provider: 'openai' }, 800, 'total');
    const r = agg.getTeamReport('t');
    expect(r.fastestApp).toBe(fast.appId);
  });

  it('summary sums requestCount and totalTokens across apps', () => {
    const a = ctx({ team: 't' });
    const b = ctx({ team: 't' });
    registry.register(a);
    registry.register(b);
    registry.getCollector(a.appId).recordLatency({}, 100, 'total');
    registry.getCollector(a.appId).recordTokenUsage({}, 50, 50, 100);
    registry.getCollector(b.appId).recordLatency({}, 200, 'total');
    registry.getCollector(b.appId).recordTokenUsage({}, 100, 100, 200);
    const r = agg.getTeamReport('t');
    expect(r.summary.requestCount).toBe(2);
    expect(r.summary.totalTokens).toBe(300);
  });

  it('summary averages rates across apps', () => {
    const a = ctx({ team: 't' });
    const b = ctx({ team: 't' });
    registry.register(a);
    registry.register(b);

    // app a: 1 retry / 1 request → retryRate = 1
    registry.getCollector(a.appId).recordLatency({}, 100, 'total');
    registry.getCollector(a.appId).recordRetry({}, 2, 3, 'limit', 500);

    // app b: 0 retries / 1 request → retryRate = 0
    registry.getCollector(b.appId).recordLatency({}, 100, 'total');

    const r = agg.getTeamReport('t');
    // average of 1 and 0 = 0.5
    expect(r.summary.retryRate).toBeCloseTo(0.5, 5);
  });

  it('apps sorted by reliabilityScore descending', () => {
    const a = ctx({ team: 't' });
    const b = ctx({ team: 't' });
    registry.register(a);
    registry.register(b);
    // a: perfect
    registry.getCollector(a.appId).recordLatency({}, 100, 'total');
    // b: all failures
    registry.getCollector(b.appId).recordLatency({}, 100, 'total');
    registry.getCollector(b.appId).recordProviderFailure({}, 'provider', 'err', 1);
    const r = agg.getTeamReport('t');
    expect(r.apps[0].context.appId).toBe(a.appId);
  });
});

// ---------------------------------------------------------------------------
// MonitoringAggregator — project reports
// ---------------------------------------------------------------------------

describe('MonitoringAggregator — getProjectReport', () => {
  it('returns empty report for unknown project', () => {
    const r = agg.getProjectReport('no-such-project');
    expect(r.apps).toHaveLength(0);
    expect(r.project).toBe('no-such-project');
  });

  it('includes only apps with matching project', () => {
    registry.register(ctx({ project: 'alpha' }));
    registry.register(ctx({ project: 'alpha' }));
    registry.register(ctx({ project: 'beta'  }));
    expect(agg.getProjectReport('alpha').apps).toHaveLength(2);
    expect(agg.getProjectReport('beta').apps).toHaveLength(1);
  });

  it('environment filter applies within project', () => {
    registry.register(ctx({ project: 'alpha', environment: 'production' }));
    registry.register(ctx({ project: 'alpha', environment: 'staging'    }));
    const r = agg.getProjectReport('alpha', { environment: 'production' });
    expect(r.apps).toHaveLength(1);
    expect(r.environment).toBe('production');
  });
});

// ---------------------------------------------------------------------------
// MonitoringAggregator — getAllProfiles
// ---------------------------------------------------------------------------

describe('MonitoringAggregator — getAllProfiles', () => {
  it('returns all profiles when no filter', () => {
    registry.register(ctx());
    registry.register(ctx());
    registry.register(ctx());
    expect(agg.getAllProfiles()).toHaveLength(3);
  });

  it('filters by environment', () => {
    registry.register(ctx({ environment: 'production'  }));
    registry.register(ctx({ environment: 'staging'     }));
    registry.register(ctx({ environment: 'development' }));
    expect(agg.getAllProfiles({ environment: 'production' })).toHaveLength(1);
  });

  it('filters by team', () => {
    registry.register(ctx({ team: 'a' }));
    registry.register(ctx({ team: 'b' }));
    expect(agg.getAllProfiles({ team: 'a' })).toHaveLength(1);
  });

  it('result is sorted by reliabilityScore descending', () => {
    const a = ctx();
    const b = ctx();
    registry.register(a);
    registry.register(b);
    // a: perfect
    registry.getCollector(a.appId).recordLatency({}, 100, 'total');
    // b: all errors
    registry.getCollector(b.appId).recordLatency({}, 100, 'total');
    registry.getCollector(b.appId).recordProviderFailure({}, 'provider', 'err', 1);
    const all = agg.getAllProfiles();
    expect(all[0].metrics.reliabilityScore).toBeGreaterThanOrEqual(all[1].metrics.reliabilityScore);
  });
});

// ---------------------------------------------------------------------------
// Global singleton smoke test
// ---------------------------------------------------------------------------

describe('global singletons', () => {
  it('appRegistry is an AppRegistry instance', async () => {
    const { appRegistry } = await import('../src/monitoring/registry.js');
    expect(appRegistry).toBeInstanceOf(AppRegistry);
  });

  it('monitoringAggregator is a MonitoringAggregator instance', async () => {
    const { monitoringAggregator } = await import('../src/monitoring/aggregator.js');
    expect(monitoringAggregator).toBeInstanceOf(MonitoringAggregator);
  });
});
