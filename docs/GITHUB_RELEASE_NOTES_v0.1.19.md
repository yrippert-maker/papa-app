# Release v0.1.19 — Operational policies + Evidence UX + Security hardening

## Overview
v0.1.19 добавляет operational tooling, улучшения UX для evidence exports и security hardening:
- Dead-letter retention/cleanup script с алертами
- Метрики для evidence verification endpoint
- UI кнопка "Скачать evidence bundle"
- UI страница "Проверить evidence"
- Rate limit для POST /api/inspection/evidence/verify

---

## Key Changes

### Operational Policies

#### Dead-letter cleanup script
- `scripts/cleanup-dead-letter.mjs` — ротация и retention
- `npm run cleanup:dead-letter [--dry-run] [--retention-days=N]`
- Архивирует текущий файл → `dead-letter-archive/{timestamp}.jsonl`
- Удаляет архивы старше N дней (default: 30)
- JSON output для alerting: `alert_high_volume`, `alert_growing`

#### Evidence verify metrics
- `lib/metrics/evidence-verify.ts` — counters по результату
- Добавлены в `/api/metrics` (Prometheus format)
- Метрики: `ok`, `content_invalid`, `key_revoked`, `key_not_found`, `signature_invalid`, `rate_limited`, `unauthorized`

### Evidence UX

#### Download bundle button
- Кнопка "📦 Evidence" на странице техкарты `/inspection/[id]`
- Скачивает подписанный ZIP bundle

#### Verify evidence page
- Новая страница `/inspection/verify`
- Загрузка export.json (файл или paste)
- Показывает результат: content hash, signature, key status, errors
- Ссылка с главной страницы инспекций

### Security Hardening

#### Rate limit for verify endpoint
- `POST /api/inspection/evidence/verify`: 20 req/min per IP
- Стандартный `429 RATE_LIMITED` response с `Retry-After`

### Documentation
- `docs/ops/LEDGER_DEAD_LETTER.md` — retention, cleanup, alerts

---

## Tests
- Total: **208 tests passed**
- Build: ✅
- E2E: all passed

---

## Release Artifacts
- `dist/regulatory-bundle-v0.1.19.zip`
- SHA-256: **3a3c63f1c68ca8b536b15a4c2447a64ba8b326cc2983b2ce1622766430185077**
