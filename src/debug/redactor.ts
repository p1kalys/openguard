/**
 * Sensitive-data redaction for OpenGuard debug snapshots
 *
 * Redaction runs at SnapshotStore.add() time so in-flight collectors are
 * never mutated. The snapshot is deep-cloned via JSON before any field is
 * touched, ensuring the caller's reference is always unaffected.
 */

import type { DebugSnapshot, RedactionConfig, SerializableValue } from './types.js';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/**
 * Field names that are considered sensitive by default.
 * Stored normalised: lower-case, hyphens/spaces converted to underscores.
 */
const DEFAULT_SENSITIVE_FIELDS: ReadonlySet<string> = new Set([
  'apikey', 'api_key',
  'apitoken', 'api_token',
  'authorization', 'auth',
  'password', 'passwd', 'pass',
  'token',
  'accesstoken', 'access_token',
  'refreshtoken', 'refresh_token',
  'secret', 'clientsecret', 'client_secret',
  'credential', 'credentials',
  'bearer',
  'key', 'privatekey', 'private_key',
  'x_api_key', 'x_auth_token',
]);

/**
 * Value-level patterns. Each regex is applied globally against string values.
 * Patterns are intentionally conservative to avoid false positives in content.
 */
const DEFAULT_VALUE_PATTERNS: ReadonlyArray<RegExp> = [
  /\bsk-[A-Za-z0-9_-]{20,}/g,              // OpenAI-style keys  (sk-…)
  /\bBearer\s+[A-Za-z0-9._/+=-]{10,}/g,    // Authorization: Bearer <token>
  /\bghp_[A-Za-z0-9]{36,}/g,               // GitHub personal access tokens
  /\bAIza[A-Za-z0-9_-]{35,}/g,             // Google Cloud / GCP API keys
  /\bxoxb-[A-Za-z0-9-]{20,}/g,             // Slack bot tokens
];

// ---------------------------------------------------------------------------
// Resolved (fully-hydrated) configuration
// ---------------------------------------------------------------------------

export interface ResolvedRedactionConfig {
  readonly enabled: boolean;
  readonly sensitiveFields: ReadonlySet<string>;
  readonly patterns: ReadonlyArray<RegExp>;
  readonly replacement: string;
  readonly redactPrompts: boolean;
  readonly redactRawResponses: boolean;
  readonly customRedactor: (key: string, value: SerializableValue) => SerializableValue;
}

/** Merge user config with built-in defaults. */
export function resolveRedactionConfig(cfg?: RedactionConfig): ResolvedRedactionConfig {
  const userFields = new Set(DEFAULT_SENSITIVE_FIELDS);
  for (const f of cfg?.fields ?? []) {
    userFields.add(normaliseFieldName(f));
  }

  return {
    enabled: cfg?.enabled ?? true,
    sensitiveFields: userFields,
    patterns: cfg?.patterns ?? DEFAULT_VALUE_PATTERNS,
    replacement: cfg?.replacement ?? '[REDACTED]',
    redactPrompts: cfg?.redactPrompts ?? false,
    redactRawResponses: cfg?.redactRawResponses ?? false,
    customRedactor: cfg?.customRedactor ?? ((_k, v) => v),
  };
}

function normaliseFieldName(name: string): string {
  return name.toLowerCase().replace(/[-\s]/g, '_');
}

// ---------------------------------------------------------------------------
// Deep redaction walker
// ---------------------------------------------------------------------------

/**
 * Recursively walk a serializable value tree, redacting sensitive data.
 *
 * Rules applied in order for each node:
 *  1. If the **key** matches a sensitive field name  → replace with `replacement`
 *  2. If the **value** is a string that matches a regex pattern → replace matches
 *  3. Run `customRedactor(key, value)` for any remaining string scalar
 */
function walk(
  key: string,
  value: SerializableValue,
  cfg: ResolvedRedactionConfig,
): SerializableValue {
  // Null is always safe
  if (value === null) return null;

  // Sensitive key: replace the whole value regardless of type
  if (cfg.sensitiveFields.has(normaliseFieldName(key))) {
    return cfg.replacement;
  }

  if (Array.isArray(value)) {
    return value.map((item, i) => walk(String(i), item as SerializableValue, cfg));
  }

  if (typeof value === 'object') {
    const out: Record<string, SerializableValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, SerializableValue>)) {
      out[k] = walk(k, v, cfg);
    }
    return out;
  }

  if (typeof value === 'string') {
    // Pattern-based redaction
    let s = value;
    for (const pattern of cfg.patterns) {
      // Clone the regex to reset lastIndex for each call (safe for global flags)
      const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
      s = s.replace(re, cfg.replacement);
    }
    // Custom hook (runs after built-in patterns so the hook sees already-patched text)
    return cfg.customRedactor(key, s);
  }

  // number | boolean: custom hook only
  return cfg.customRedactor(key, value);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Return a deep-cloned, redacted copy of `snapshot`.
 *
 * The original snapshot is **never** mutated.  If redaction is disabled via
 * `cfg.enabled === false` the original reference is returned as-is.
 */
export function redactSnapshot(
  snapshot: DebugSnapshot,
  cfg: RedactionConfig | ResolvedRedactionConfig,
): DebugSnapshot {
  // Accept either raw user config or an already-resolved config
  const resolved: ResolvedRedactionConfig =
    'sensitiveFields' in cfg
      ? (cfg as ResolvedRedactionConfig)
      : resolveRedactionConfig(cfg as RedactionConfig);

  if (!resolved.enabled) return snapshot;

  // Deep-clone via JSON — safe because DebugSnapshot is fully serializable
  const clone = JSON.parse(JSON.stringify(snapshot)) as DebugSnapshot;

  // ── Request ──────────────────────────────────────────────────────────────
  if (clone.request) {
    if (resolved.redactPrompts) {
      if (typeof clone.request.prompt === 'string') {
        clone.request.prompt = resolved.replacement;
      } else {
        clone.request.prompt = clone.request.prompt.map((m) => ({
          role: m.role,
          content: resolved.replacement,
        }));
      }
    }
    if (clone.request.options) {
      clone.request.options = walk(
        'options',
        clone.request.options as SerializableValue,
        resolved,
      ) as Record<string, SerializableValue>;
    }
  }

  // ── Provider response ─────────────────────────────────────────────────────
  if (clone.providerResponse) {
    if (resolved.redactRawResponses) {
      delete clone.providerResponse.raw;
    } else if (clone.providerResponse.raw !== undefined) {
      clone.providerResponse.raw = walk('raw', clone.providerResponse.raw, resolved);
    }
  }

  // ── Custom attributes ─────────────────────────────────────────────────────
  if (clone.attributes) {
    clone.attributes = walk(
      'attributes',
      clone.attributes as SerializableValue,
      resolved,
    ) as Record<string, SerializableValue>;
  }

  return clone;
}
