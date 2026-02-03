# Release v1.0.0 — Audit-grade baseline

**Audit-grade release: strict config ledger, unified rollup, mail governance.**

---

## Highlights

- **Strict + atomic-ish config save (M2.8)** — двухфазная запись allowlist: `_pending` → docs-store → final ledger. Невозможность «тихих» изменений при `REQUIRE_CONFIG_LEDGER=1`.
- **Pending GC (M2.9–M2.10)** — S3 + GCS, лимиты (max-delete / max-bytes), confirm-gate, JSON report, scheduled workflow.
- **Unified daily rollup (M4)** — один Merkle root по `ledger` + `doc-ledger` + `mail-ledger`; `_pending` исключён.
- **Mail governance (M3 + M5)** — типы idempotency_key / auth_indicators, bulk Accept/Reject в Portal, decision-ledger (POST /v1/mail/decision).
- **Documentation** — Compliance, Retention, Regulatory checklist, Audit-grade status.

Уровень: **SOC2 / банк / регулятор / due diligence**. Доверенный baseline для фиксации и ссылок.

---

## Release & bundle

- Tag: `v1.0.0`
- Regulatory bundle: `npm run bundle:regulatory` → `dist/regulatory-bundle-v1.0.0.zip`
- Чеклист передачи: [REGULATORY_SUBMISSION_CHECKLIST.md](REGULATORY_SUBMISSION_CHECKLIST.md)
- Статус фиксации: [AUDIT_GRADE_STATUS.md](AUDIT_GRADE_STATUS.md)
