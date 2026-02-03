# Release Notes v0.1.19 — Ops + UX + Security

## Summary

Operational tooling, evidence UX и security hardening.

## Changes

- **Dead-letter cleanup**: `npm run cleanup:dead-letter`, rotation, retention, alerts
- **Evidence verify metrics**: Prometheus counters по результату
- **Download bundle UI**: кнопка "📦 Evidence" на странице техкарты
- **Verify evidence UI**: страница `/inspection/verify`
- **Rate limit**: verify endpoint 20 req/min
- **Docs**: ops/LEDGER_DEAD_LETTER.md обновлён
- **Tests**: 208 passed
