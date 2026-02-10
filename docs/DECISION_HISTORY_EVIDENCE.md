# Decision History — Evidence

**Статус:** implemented  
**Цель:** зафиксировать, что история решений верификации доступна в UI, связана с ledger и проверяема.

---

## 1. Область охвата

- **UI:** `/compliance/decisions` — список решений
- **UI:** `/compliance/decisions/[id]` — детали одного решения
- **API:** `GET /api/compliance/decisions`, `GET /api/compliance/decisions/:id`
- **Permission:** COMPLIANCE.VIEW

---

## 2. Источник данных

| Источник | Описание |
|----------|----------|
| Workspace audit packs | `00_SYSTEM/audit-packs/audit-pack-*/decision-record.json` |
| Fixtures (demo) | `__fixtures__/auditor-pack-minimal`, `__fixtures__/auditor-pack-bad-receipt` |

**Data contract:** [compliance/DECISION_RECORD_SPEC.md](compliance/DECISION_RECORD_SPEC.md)

---

## 3. Связь с Evidence

| Элемент UI | Evidence |
|------------|----------|
| Decision ID | decision-record.json → decision_id |
| Ledger Entry ID | decision-record.json → ledger_entry_id |
| Outcome (pass/fail) | decision-record.json → outcome.overall |
| Checks | decision-record.json → checks[] |
| Immutability chain | decision_id → ledger_entry_id → anchor |

**Правило:** UI ссылается на existing evidence, не создаёт новый. Authoritative — decision-record.json в pack.

---

## 4. Smoke-проверка

1. Открыть `/compliance/decisions` — виден список (fixtures: 2 решения)
2. Клик «Подробнее» → `/compliance/decisions/[id]` — детали, checks, ledger_entry_id
3. «← К списку» — возврат

---

## 5. Связанные артефакты

- [DECISION_RECORD_SPEC.md](compliance/DECISION_RECORD_SPEC.md)
- [UI_ROUTING_SANITY_EVIDENCE.md](UI_ROUTING_SANITY_EVIDENCE.md)
- [plans/EVIDENCE_KIT_FEATURE_ROADMAP.md](plans/EVIDENCE_KIT_FEATURE_ROADMAP.md)
