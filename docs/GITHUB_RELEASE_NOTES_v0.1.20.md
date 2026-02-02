# Release v0.1.20 — Compliance operations complete

## Overview
v0.1.20 завершает operational readiness для compliance-слоя:
- Retention policies
- Полные метрики с PromQL алертами
- Runbooks для dead-letter и evidence verify
- Payload size cap для security hardening

---

## Key Changes

### PR-1: Operational Policies

#### Retention Policy
- `docs/ops/RETENTION_POLICY.md` — политики хранения:
  - Dead-letter: 90 дней
  - Archived keys: 3 года
  - Revoked keys: не удалять
  - Ledger events: бессрочно

#### Dead-Letter Metrics
- `lib/metrics/dead-letter.ts`
- `papa_ledger_dead_letter_events_total`
- `papa_ledger_dead_letter_replay_total{mode,result}`

#### Alerts
- `docs/ops/ALERTS_COMPLIANCE.md` — PromQL examples:
  - LedgerDeadLetterGrowth
  - LedgerDeadLetterReplayFailed
  - EvidenceVerifyErrors (by reason)
  - EvidenceVerifyTrafficAnomaly
  - RateLimitTriggered

#### Runbooks
- `docs/ops/RUNBOOK_LEDGER_DEAD_LETTER.md`:
  - Диагностика, replay, post-mortem
  - DO NOT секция
- `docs/ops/RUNBOOK_EVIDENCE_VERIFY.md`:
  - Разбор ошибок по типу
  - Атака vs ошибка клиента
  - Key rotation/revocation

### PR-3: Security Hardening

#### Payload Size Cap
- `POST /api/inspection/evidence/verify`: max 5 MB
- Double-check: content-length + parsed body

#### Rate Limits Documentation
- `docs/ops/RATE_LIMITS.md`:
  - Endpoints с лимитами
  - Response format
  - Мониторинг

---

## Tests
- Metrics unit tests (5 new)
- Total: **213 tests passed**
- Build: ✅
- E2E: all passed

---

## Release Artifacts
- `dist/regulatory-bundle-v0.1.20.zip`
- SHA-256: **<ADD_SHA256_HERE>**
