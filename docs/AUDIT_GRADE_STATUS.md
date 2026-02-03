# Audit-grade status (official fixation)

**Дата фиксации:** 2026-02  
**Baseline:** v1.0.0 (audit-grade release)  
**Уровень:** SOC2 / банк / регулятор / due diligence — доверенный baseline.

---

## Закрыто на текущую дату

### Governance / Audit

| Номер | Описание | Статус |
|-------|----------|--------|
| **M2.8** | Strict + atomic-ish config save | ✔ Двухфазная запись (`_pending` → final), невозможность «тихих» изменений при `REQUIRE_CONFIG_LEDGER=1`, формулировка для аудитора в README_COMPLIANCE.md |
| **M2.9 / M2.9b / M2.10** | Pending GC | ✔ S3 + GCS, лимиты (max-delete / max-bytes), confirm-gate, JSON report, scheduled GC |
| **Unified rollup (M4)** | Единый Merkle root | ✔ ledger + doc-ledger + mail-ledger → один rollup, `_pending` исключён |
| **Mail governance (M3 + M5)** | Idempotency + bulk decisions | ✔ Типы (idempotency_key, auth_indicators), bulk actions, decision-ledger (POST /v1/mail/decision) |
| **Portal UX** | Bulk + прозрачность | ✔ Bulk Accept/Reject, прозрачные config-изменения |
| **Документация** | Compliance / Retention / Checklist | ✔ README_COMPLIANCE, AUDIT_PACK_RETENTION, REGULATORY_SUBMISSION_CHECKLIST |

**Критичных открытых пунктов нет.**

---

## Что делать дальше (по приоритету)

### Priority 1 — Release & freeze (обязательно)

1. Тег: `git tag -a v1.0.0 -m "Audit-grade release: strict config ledger, unified rollup"`
2. Push тега: `git push origin v1.0.0`
3. Скрипт релиза: `./scripts/create-release.sh owner/repo v1.0.0`
4. Regulatory bundle: `npm run bundle:regulatory` (или `./scripts/create-regulatory-bundle.sh v1.0.0`)
5. Заполнить `docs/REGULATORY_SUBMISSION_CHECKLIST.md`, сохранить bundle как immutable artefact

### Priority 2 — Observability (рекомендуется)

- Dashboard: config changes/day, pending GC count, mail decisions rate
- Alert: `_pending` старше X часов, GC упирается в лимиты
- Health endpoint: ledger writable, rollup fresh

### Priority 3 — Mail pipeline (если продукт)

- DKIM/SPF/DMARC → risk score, attachment scan, auto-draft proposals, SLA таймеры

### Priority 4 — Formal trust artifacts (по желанию)

- Threat Model (STRIDE-lite), Data Flow Diagram, «What cannot be changed»

---

## Важно

После выхода за грань «делаем фичи» в стадию «фиксируем доверие»:

- не ломать backward compatibility;
- каждое изменение — с audit-следом;
- ценность проекта = доверенный baseline + неизменяемый артефакт.
