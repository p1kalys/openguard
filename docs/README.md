# OpenGuard Documentation

This directory contains module-level documentation for every OpenGuard subsystem.

## Modules

| Module | Sub-path import | Description |
|--------|----------------|-------------|
| [Events](events.md) | `openguard/events` | Lifecycle event bus — emit and subscribe to request events |
| [Metrics](metrics.md) | `openguard/metrics` | Provider-agnostic reliability metrics engine |
| [Tracing](tracing.md) | `openguard/tracing` | Lightweight serializable request tracing with spans |
| [Storage](storage.md) | `openguard/storage` | Pluggable storage backends for traces, metrics, snapshots |
| [Query](query.md) | `openguard/query` | Observability query API over stored telemetry |
| [Monitoring](monitoring.md) | `openguard/monitoring` | Application-level team monitoring and reliability profiles |
| [Plugins](plugins.md) | `openguard/plugins` | Third-party plugin SDK with 7 lifecycle hooks |
| [Debug](debug.md) | `openguard/debug` | Debug snapshots — capture full request/response context |
| [Grounding](grounding.md) | `openguard/validation` | Grounding validation — fact-check against provided sources |
| [Hallucination](hallucination.md) | `openguard` | Hallucination detection across 8 issue categories |
| [Confidence](confidence.md) | `openguard` | Confidence aggregation from multiple validation sources |

## Quick Navigation

- **Getting started?** → [root README](../README.md)
- **Plugin authors** → [plugins.md](plugins.md)
- **Storage + persistence** → [storage.md](storage.md) then [query.md](query.md)
- **Team dashboards** → [monitoring.md](monitoring.md)
- **Testing & CI** → see `tests/` at the repository root
