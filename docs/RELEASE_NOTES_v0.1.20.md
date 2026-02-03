# Release Notes v0.1.20 — Compliance ops complete

## Summary

Завершение operational readiness: retention, alerts, runbooks, security.

## Changes

- **Retention policy**: dead-letter 90d, keys 3y, ledger permanent
- **Dead-letter metrics**: events_total, replay_total
- **Alerts**: PromQL examples for all compliance metrics
- **Runbooks**: dead-letter, evidence verify
- **Payload cap**: verify endpoint 5 MB max
- **Rate limits doc**: endpoints, limits, monitoring
- **Tests**: 213 passed (5 new for metrics)
