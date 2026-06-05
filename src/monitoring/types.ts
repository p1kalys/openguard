/**
 * Team monitoring metadata — types
 *
 * Lightweight application/team context layer that sits atop the existing
 * metrics system.  No external dependencies; all plain serialisable objects.
 */

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/** Deployment environment for an application. */
export type Environment = 'production' | 'staging' | 'development';

/**
 * Metadata that identifies an application within a team/project.
 * Attach one `AppContext` per logical service or worker that makes LLM calls.
 */
export interface AppContext {
  /** Unique identifier for this application (slug-style, e.g. `"chat-api"`). */
  appId: string;
  /** Human-readable display name. */
  appName: string;
  /** Team that owns this application (e.g. `"platform"`, `"search"`). */
  team: string;
  /** Project / product grouping (e.g. `"llm-gateway"`). */
  project: string;
  /** Deployment environment. */
  environment: Environment;
  /** Optional semver / build tag. */
  version?: string;
  /** Arbitrary key-value tags for custom filtering. */
  tags?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Per-application reliability snapshot
// ---------------------------------------------------------------------------

/**
 * Derived reliability metrics for a single application.
 * All rates are fractions in [0, 1]; `reliabilityScore` is [0, 100].
 */
export interface AppMetrics {
  /** Total LLM requests recorded (proxy: latency-stage="total" events). */
  requestCount: number;
  /** Requests that did not produce a `provider.failure` metric. */
  successCount: number;
  /** Requests that produced at least one `provider.failure` metric. */
  errorCount: number;
  /** `successCount / requestCount` (0 when requestCount = 0). */
  successRate: number;
  /** Mean end-to-end latency in ms across all `stage="total"` events. */
  avgLatencyMs: number;
  /** 95th-percentile latency in ms. */
  p95LatencyMs: number;
  /** Sum of all `totalTokens` recorded. */
  totalTokens: number;
  /** `totalTokens / requestCount`. */
  avgTokensPerRequest: number;
  /**
   * `retry events / requestCount`.
   * Capped at 1 so a flood of retries doesn't exceed 100 %.
   */
  retryRate: number;
  /** `validation.failure events / requestCount`. */
  validationFailureRate: number;
  /** `detected hallucinations / total hallucination checks`. */
  hallucinationDetectionRate: number;
  /**
   * Composite score (0 – 100, higher = more reliable).
   *
   * `successRate × 40 + (1 − retryRate) × 20
   *  + (1 − validationFailureRate) × 20
   *  + (1 − hallucinationDetectionRate) × 20`
   */
  reliabilityScore: number;
}

/** Full reliability profile for one registered application. */
export interface AppProfile {
  context: AppContext;
  metrics: AppMetrics;
  /** Unix-ms timestamp when this profile was computed. */
  computedAt: number;
}

// ---------------------------------------------------------------------------
// Cross-application reports
// ---------------------------------------------------------------------------

/**
 * Aggregated report for every application belonging to a team.
 * `summary` averages/sums the per-app metrics.
 */
export interface TeamReport {
  team: string;
  environment?: Environment;
  apps: AppProfile[];
  /** Cross-app aggregated summary (averages rates; sums counts/tokens). */
  summary: AppMetrics;
  /** `appId` with the highest `reliabilityScore`. */
  bestApp?: string;
  /** `appId` with the lowest `reliabilityScore` (only set when ≥ 2 apps). */
  worstApp?: string;
  /** `appId` with the lowest `avgLatencyMs` (among apps with > 0 requests). */
  fastestApp?: string;
  /** Unix-ms timestamp when this report was computed. */
  computedAt: number;
}

/**
 * Aggregated report for every application belonging to a project.
 * Structure mirrors `TeamReport`.
 */
export interface ProjectReport {
  project: string;
  environment?: Environment;
  apps: AppProfile[];
  summary: AppMetrics;
  bestApp?: string;
  worstApp?: string;
  fastestApp?: string;
  computedAt: number;
}

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

/**
 * Filter for registry and report queries.
 * All fields are optional and ANDed together.
 */
export interface MonitoringFilter {
  /** Restrict to a specific team. */
  team?: string;
  /** Restrict to a specific project. */
  project?: string;
  /** Restrict to a specific deployment environment. */
  environment?: Environment;
  /** Restrict to a specific application. */
  appId?: string;
  /** Only include metric events within this unix-ms range. */
  timeRange?: { start: number; end: number };
}
