/**
 * SnapshotStore and SnapshotCollector
 *
 * SnapshotStore   – bounded in-memory store with retention management.
 * SnapshotCollector – fluent builder that accumulates pipeline phases for a
 *                    single request and commits the completed snapshot to a store.
 *
 * Follows the same Collector/Store split used by the tracing module
 * (TraceContext / Tracer), both living in the same file to avoid circular deps.
 */

import {
  redactSnapshot,
  resolveRedactionConfig,
  type ResolvedRedactionConfig,
} from './redactor.js';
import type {
  CapturedError,
  CapturedHallucinationCheck,
  CapturedNormalization,
  CapturedProviderResponse,
  CapturedRepair,
  CapturedRequest,
  CapturedRetry,
  CapturedValidation,
  DebugSnapshot,
  RedactionConfig,
  RetentionConfig,
  SerializableValue,
  SnapshotStatus,
  SnapshotStoreConfig,
} from './types.js';

// Re-export ResolvedRedactionConfig so index.ts can use it without importing redactor.ts directly
export type { ResolvedRedactionConfig };

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

/** Generate a unique snapshot ID. Format: `snap_<base36 time>_<random>`. */
export function generateSnapshotId(): string {
  return `snap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// SnapshotStore
// ---------------------------------------------------------------------------

/**
 * Bounded, in-memory store for `DebugSnapshot` objects.
 *
 * Key behaviours:
 * - Redaction runs at `add()` time; the caller's snapshot is never mutated.
 * - Retention policy is evaluated before storing (cheap pre-filter).
 * - Age-based eviction is checked lazily on every `add()` / `getAll()`.
 * - Capacity eviction removes the oldest snapshot (FIFO) when full.
 */
export class SnapshotStore {
  private readonly _map: Map<string, DebugSnapshot> = new Map();
  /** Insertion-order list of IDs — front = oldest, back = newest. */
  private readonly _order: string[] = [];

  private readonly _maxSnapshots: number;
  private readonly _maxAgeMs: number;
  private readonly _policy: NonNullable<RetentionConfig['policy']>;
  private readonly _sampleRate: number;
  private readonly _resolved: ResolvedRedactionConfig;

  constructor(config: SnapshotStoreConfig = {}) {
    const r = config.retention ?? {};
    this._maxSnapshots = r.maxSnapshots ?? 100;
    this._maxAgeMs = r.maxAgeMs ?? 0;
    this._policy = r.policy ?? 'all';
    this._sampleRate = r.sampleRate ?? 0.1;
    this._resolved = resolveRedactionConfig(config.redaction);
  }

  // ── Public write API ───────────────────────────────────────────────────────

  /**
   * Apply this store's configured redaction to a snapshot without storing it.
   * Used by `SnapshotCollector.complete()` to return a view consistent with
   * what the store holds.
   *
   * @internal
   */
  applyRedaction(snapshot: DebugSnapshot): DebugSnapshot {
    return redactSnapshot(snapshot, this._resolved);
  }

  /**
   * Store a snapshot, applying redaction and retention rules.
   *
   * Silently discards the snapshot if:
   * - the retention policy excludes it, **or**
   * - the store is full and eviction cannot free space (shouldn't happen).
   */
  add(snapshot: DebugSnapshot): void {
    if (!this._shouldKeep(snapshot)) return;

    const stored = redactSnapshot(snapshot, this._resolved);

    this._evictStale();
    this._evictIfFull();

    this._map.set(stored.id, stored);
    this._order.push(stored.id);
  }

  /**
   * Create a new `SnapshotCollector` bound to this store.
   *
   * @param requestId Correlation ID for the request being traced.
   *   Defaults to a generated ID when omitted.
   */
  collect(requestId?: string): SnapshotCollector {
    return new SnapshotCollector(requestId ?? generateSnapshotId(), this);
  }

  // ── Public read API ────────────────────────────────────────────────────────

  /** Retrieve a snapshot by its unique ID. Returns undefined if not found or expired. */
  get(id: string): DebugSnapshot | undefined {
    const snap = this._map.get(id);
    if (!snap) return undefined;
    if (this._isExpired(snap)) return undefined;
    return snap;
  }

  /** All stored snapshots in insertion order, excluding expired entries. */
  getAll(): DebugSnapshot[] {
    this._evictStale();
    return this._order
      .map((id) => this._map.get(id))
      .filter((s): s is DebugSnapshot => s !== undefined);
  }

  /** All snapshots whose `requestId` matches. */
  getByRequestId(requestId: string): DebugSnapshot[] {
    return this.getAll().filter((s) => s.requestId === requestId);
  }

  /** All snapshots where `status === 'failure'`. */
  getFailures(): DebugSnapshot[] {
    return this.getAll().filter((s) => s.status === 'failure');
  }

  /** Return snapshots that satisfy an arbitrary predicate. */
  filter(predicate: (s: DebugSnapshot) => boolean): DebugSnapshot[] {
    return this.getAll().filter(predicate);
  }

  /** Number of snapshots currently held (expired entries may still be counted until next sweep). */
  size(): number {
    return this._map.size;
  }

  /** Remove all snapshots. */
  clear(): void {
    this._map.clear();
    this._order.length = 0;
  }

  // ── Export helpers ─────────────────────────────────────────────────────────

  /** Serialize all snapshots to a pretty-printed JSON string. */
  export(): string {
    return JSON.stringify(this.getAll(), null, 2);
  }

  /** Serialize a single snapshot by ID, or return undefined if not found. */
  exportOne(id: string): string | undefined {
    const snap = this.get(id);
    return snap !== undefined ? JSON.stringify(snap, null, 2) : undefined;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _shouldKeep(snapshot: DebugSnapshot): boolean {
    switch (this._policy) {
      case 'failures-only': return snapshot.status === 'failure';
      case 'sampled':       return Math.random() < this._sampleRate;
      default:              return true;
    }
  }

  private _isExpired(snapshot: DebugSnapshot): boolean {
    if (!this._maxAgeMs) return false;
    return snapshot.capturedAt < Date.now() - this._maxAgeMs;
  }

  private _evictStale(): void {
    if (!this._maxAgeMs) return;
    const cutoff = Date.now() - this._maxAgeMs;
    while (this._order.length > 0) {
      const id = this._order[0];
      const snap = this._map.get(id);
      if (snap && snap.capturedAt < cutoff) {
        this._map.delete(id);
        this._order.shift();
      } else {
        break; // Oldest remaining is still fresh; stop scanning
      }
    }
  }

  private _evictIfFull(): void {
    while (this._map.size >= this._maxSnapshots) {
      const oldest = this._order.shift();
      if (oldest !== undefined) this._map.delete(oldest);
      else break;
    }
  }
}

// ---------------------------------------------------------------------------
// SnapshotCollector
// ---------------------------------------------------------------------------

/**
 * Fluent builder that accumulates pipeline phases for a single request.
 *
 * Usage:
 * ```ts
 * const col = store.collect('req-abc');
 *
 * col.setRequest({ prompt: 'Hello', capturedAt: Date.now() })
 *    .setProviderResponse({ id: 'r1', content: 'Hi', model: 'gpt-4o', capturedAt: Date.now() })
 *    .addValidation({ kind: 'schema', passed: true, issues: [], capturedAt: Date.now() });
 *
 * const snapshot = col.complete(); // commits to the store
 * ```
 *
 * Calling `complete()` is the only way to commit the snapshot to the store.
 * Call `peek()` at any point to inspect the current in-flight state without
 * committing.
 */
export class SnapshotCollector {
  private readonly _id: string;
  private readonly _requestId: string;
  private readonly _startTime: number;
  private readonly _store: SnapshotStore;

  private _status: SnapshotStatus = 'partial';
  private _statusExplicit = false;
  private _provider?: string;
  private _model?: string;
  private _request?: CapturedRequest;
  private _providerResponse?: CapturedProviderResponse;
  private _repair?: CapturedRepair;
  private _normalization?: CapturedNormalization;
  private _validations: CapturedValidation[] = [];
  private _hallucinationChecks: CapturedHallucinationCheck[] = [];
  private _retries: CapturedRetry[] = [];
  private _error?: CapturedError;
  private _tags: string[] = [];
  private _attributes: Record<string, SerializableValue> = {};

  /** @internal — use `store.collect()` instead of constructing directly. */
  constructor(requestId: string, store: SnapshotStore) {
    this._id = generateSnapshotId();
    this._requestId = requestId;
    this._startTime = Date.now();
    this._store = store;
  }

  /** The snapshot's unique ID (assigned at construction time). */
  get id(): string { return this._id; }

  /** The request correlation ID. */
  get requestId(): string { return this._requestId; }

  // ── Phase setters ──────────────────────────────────────────────────────────

  setRequest(req: CapturedRequest): this {
    this._request = req;
    return this;
  }

  setProviderResponse(res: CapturedProviderResponse): this {
    this._providerResponse = res;
    if (res.model) this._model ??= res.model;
    return this;
  }

  setRepair(repair: CapturedRepair): this {
    this._repair = repair;
    return this;
  }

  setNormalization(norm: CapturedNormalization): this {
    this._normalization = norm;
    if (norm.output.provider) this._provider ??= norm.output.provider;
    if (norm.output.model)    this._model    ??= norm.output.model;
    return this;
  }

  addValidation(v: CapturedValidation): this {
    this._validations.push(v);
    return this;
  }

  addHallucinationCheck(h: CapturedHallucinationCheck): this {
    this._hallucinationChecks.push(h);
    return this;
  }

  addRetry(r: CapturedRetry): this {
    this._retries.push(r);
    return this;
  }

  setError(e: CapturedError): this {
    this._error = e;
    return this;
  }

  // ── Metadata ───────────────────────────────────────────────────────────────

  /** Override the provider name (auto-detected from normalization if available). */
  setProvider(name: string): this {
    this._provider = name;
    return this;
  }

  /** Override the model name (auto-detected from provider response if available). */
  setModel(name: string): this {
    this._model = name;
    return this;
  }

  /**
   * Explicitly set the snapshot status, locking it against auto-derivation.
   * When this method is called, `complete()` will use exactly this status
   * regardless of whether errors or failing validations were also recorded.
   */
  setStatus(status: SnapshotStatus): this {
    this._status = status;
    this._statusExplicit = true;
    return this;
  }

  /** Add a string tag for filtering. Tags are deduplicated. */
  addTag(tag: string): this {
    if (!this._tags.includes(tag)) this._tags.push(tag);
    return this;
  }

  /** Set a custom key-value attribute on the snapshot. */
  setAttribute(key: string, value: SerializableValue): this {
    this._attributes[key] = value;
    return this;
  }

  /** Merge multiple attributes at once. */
  setAttributes(attrs: Record<string, SerializableValue>): this {
    Object.assign(this._attributes, attrs);
    return this;
  }

  // ── Terminal operations ────────────────────────────────────────────────────

  /**
   * Finalize the snapshot, commit it to the store, and return it.
   *
   * Status is auto-derived if not explicitly set via `setStatus()`:
   * - If `setError()` was called → `'failure'`
   * - If any validation has `passed === false` → `'failure'`
   * - If any hallucination check has `isHallucinated === true` → `'failure'`
   * - Otherwise → `'success'`
   *
   * Calling `complete()` more than once commits duplicates — avoid this.
   */
  complete(): DebugSnapshot {
    const snapshot = this._build();
    this._store.add(snapshot);
    // Return the redacted version so the caller sees exactly what was stored.
    return this._store.applyRedaction(snapshot);
  }

  /**
   * Return the current in-flight snapshot **without** committing it to the
   * store.  Useful for inspecting intermediate state or unit-testing
   * individual phases.
   */
  peek(): DebugSnapshot {
    return this._build();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _deriveStatus(): SnapshotStatus {
    if (this._statusExplicit) return this._status;
    if (this._error) return 'failure';
    if (this._validations.some((v) => !v.passed)) return 'failure';
    if (this._hallucinationChecks.some((h) => h.isHallucinated)) return 'failure';
    return 'success';
  }

  private _build(): DebugSnapshot {
    const status = this._deriveStatus();
    const now = Date.now();

    return {
      id: this._id,
      requestId: this._requestId,
      capturedAt: this._startTime,
      durationMs: now - this._startTime,
      status,
      ...(this._provider !== undefined && { provider: this._provider }),
      ...(this._model    !== undefined && { model:    this._model }),
      ...(this._request           && { request:           this._request }),
      ...(this._providerResponse  && { providerResponse:  this._providerResponse }),
      ...(this._repair            && { repair:            this._repair }),
      ...(this._normalization     && { normalization:     this._normalization }),
      validations:        [...this._validations],
      hallucinationChecks: [...this._hallucinationChecks],
      retries:            [...this._retries],
      ...(this._error && { error: this._error }),
      ...(this._tags.length       > 0 && { tags:       [...this._tags] }),
      ...(Object.keys(this._attributes).length > 0 && {
        attributes: { ...this._attributes },
      }),
    };
  }
}

// ---------------------------------------------------------------------------
// Global singleton store
// ---------------------------------------------------------------------------

/**
 * Global `SnapshotStore` with sensible defaults (100 snapshots, all retained).
 *
 * For isolated scopes (e.g. tests, multi-tenant apps) construct a fresh
 * `SnapshotStore` instead of using this singleton.
 */
export const snapshotStore = new SnapshotStore();
