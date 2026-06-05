# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Plugin SDK (`openguard/plugins`) — third-party plugin system with 7 lifecycle hooks: `beforeRequest`, `afterResponse`, `beforeCompletion`, `beforeValidation`, `afterValidation`, `beforeRetry`, `afterRetry`. Full TypeScript typings, async hook support, error isolation.
- Observability query API (`openguard/query`) — framework-agnostic query layer over stored telemetry; queries for traces, metrics, validation failures, hallucination reports, and per-provider reliability summaries.
- Team monitoring system (`openguard/monitoring`) — application-level reliability profiles with environment metadata (`production`/`staging`/`development`), team/project identifiers, and cross-application weighted aggregation.
- Storage abstraction layer (`openguard/storage`) — pluggable `ITraceStore`, `IMetricStore`, `ISnapshotStore` interfaces with in-memory and file-based adapters; `attachStorageToEvents` integration bridge and one-shot flush helpers.
- Centralized documentation in `docs/` — one Markdown file per module.

### Fixed
- `queryTraces` now issues two parallel store queries so `total` is always accurate regardless of pagination offset.
- `_computeRetries.requestsWithRetries` was counting array indices (always unique) instead of distinct retry sequences; fixed to use `attempt === 1` events.
- `queryProviderReliability` was reporting `totalRequests = 1` instead of `0` for providers with no traces.
- `summariseProfiles` now uses request-count–weighted averages so high-traffic applications contribute proportionally.
- `computeAppMetrics` retry rate now counts distinct retry sequences (`attempt === 1`) rather than raw retry events.

## [1.0.2] - 2025-04-10

### Changed
- Adjusted event data to reflect 1-based retry attempts.
- Refined event filtering logic for better request ID correlation.

## [1.0.1] - 2025-04-08

### Changed
- Refactored event context handling to improve performance.
- Enhanced logging for hallucination detection, normalization, and orchestration.
- Added event emission for hallucination checks and normalization results.

## [1.0.0] - 2025-03-15

### Added
- Provider abstraction layer (OpenAI, Anthropic, Google Gemini, Mistral, Groq).
- Schema validation with Zod integration.
- JSON extraction and automatic repair.
- Configurable retry logic with backoff.
- Typed response normalization.
- Hallucination detection engine — 8 issue categories, 3 sensitivity modes.
- Confidence aggregation — 6 strategies, configurable source weights.
- Grounding validation.
- Semantic validation engine.
- Self-verification prompting.
- Reliability scoring.
- Request tracing with nested spans.
- Reliability metrics engine.
- Debug snapshots.
- Event system for internal observability.

[Unreleased]: https://github.com/p1kalys/openguard/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/p1kalys/openguard/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/p1kalys/openguard/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/p1kalys/openguard/releases/tag/v1.0.0
