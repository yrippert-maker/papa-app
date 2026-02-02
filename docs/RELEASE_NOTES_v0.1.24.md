# Release Notes v0.1.24 — Retention Enforcement

## Summary

Unified retention enforcement script для автоматизации политик хранения.

## Changes

- **Script**: `scripts/retention-enforce.mjs`
- **npm scripts**: `retention:check`, `retention:run`, `retention:json`
- **Targets**: dead-letter (rotate/delete), keys (report only)
- **Modes**: dry-run (default), execute
- **Output**: JSON for CI/monitoring
- **Exit codes**: 0=ok, 1=error, 2=violations found
- **Docs**: updated RETENTION_POLICY.md
