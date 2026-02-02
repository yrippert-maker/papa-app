# Release Notes v0.1.11 — Verify integration for Inspection subsystem

## Summary

Расширение `/api/system/verify` блоком `inspection_verification` с permission-gating и метриками.

## Changes

- **inspection_verification**: блок в ответе verify (skipped / ok / error)
- **Permission**: INSPECTION.VIEW или INSPECTION.MANAGE
- **Error normalization**: "inspection schema missing" вместо raw SQL; raw — в логах
- **Metrics**: source_errors_total{source="inspection"}
- **Docs**: verify-aggregator.md, RUNBOOK

## Runtime fingerprint

- Node.js: см. `package.json` engines
- npm: `npm ci` для воспроизводимой сборки
