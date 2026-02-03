# Release Notes v0.1.27 — Policy Hash Baseline & Drift Detection

## Summary

Repo-backed baseline для policy hash с детекцией дрейфа в CI.

## Changes

- **Baseline**: `docs/ops/POLICY_HASH_BASELINE.json`
- **Script**: `scripts/retention-check-baseline.mjs`
- **npm scripts**: `retention:baseline:check`, `retention:baseline:update`
- **Exit codes**: 0=OK, 1=error, 2=drift
- **Docs**: Updated ALERTS_COMPLIANCE.md with workflow
- **Tests**: 220 passed (+5 baseline tests)
