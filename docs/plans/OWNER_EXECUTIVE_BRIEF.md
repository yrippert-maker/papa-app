# Executive Brief: Комплексная проверка ПО «ПАПА / Mura Menasa»

**Для собственника** | Версия 1.0 | Февраль 2026

---

## Резюме

Продукт **готов к пилоту** при выполнении ряда условий. Рекомендация: **GO с HOLD** — запускать пилот, параллельно закрывая must-fix (зависимости, секреты, документация по лицензиям).

---

## Решение: GO / HOLD / NO-GO

| Решение | Обоснование |
|---------|-------------|
| **GO** | Комплаенс-контур закрыт: approve gate, EvidenceMap, sha256, RBAC, audit trail. |
| **HOLD** | npm audit выявляет уязвимости (moderate/high); требуется SBOM и проверка лицензий ICAO/EASA/ARMAK. |
| **NO-GO** | Нет. |

**Итог:** **GO с HOLD** — пилот допустим; must-fix до внешнего контура (клиент/регулятор).

---

## Топ-3 сильные стороны

1. **Доказуемая трассировка** — EvidenceMap, sha256, audit_meta (workflow_schema_version, agent_version). Любое утверждение в документе связано с источником.
2. **Approve gate** — draft → confirmed → final; export только после Confirm; requireApproval нельзя отключить в пилоте.
3. **Audit trail** — ledger_events (block_hash, prev_hash), admin audit, compliance key lifecycle, inspection checks. Цепочка хэшей, подписание, anchoring.

---

## Топ-3 риска

| Риск | Уровень | Действие |
|------|---------|----------|
| **Уязвимости в зависимостях** | Средний | `npm audit` — moderate/high (lodash, fast-xml-parser, esbuild). План: обновление/override до релиза. |
| **Лицензии внешнего контента** | Средний | ICAO/EASA/FAA/ARMAK — требуется реестр: fulltext vs metadata-only, условия хранения. |
| **Секреты в production** | Высокий | Default admin (admin@local/admin) → 500 в production при fail-fast. Проверить: NEXTAUTH_SECRET, AUTH_* заменены. |

---

## Ориентировочная рыночная стоимость

| Метод | Диапазон |
|-------|----------|
| Cost-to-recreate | 2–10 млн руб (3–8 инженеро-месяцев × 300–800 тыс.) |
| Как актив/инструмент (пилот-готов) | **3–15 млн руб** |
| Как продукт для рынка (1–2 пилота, документирование) | **10–40 млн руб** |

**Допущения:** оценка без стабильных продаж; стоимость растёт при доказанной комплаенс-готовности и метриках пилота.

---

## План 30/60/90 дней

### 30 дней (must-fix)
- [ ] SBOM + проверка лицензий зависимостей
- [ ] Реестр внешних источников (ICAO/EASA/ARMAK): fulltext vs metadata
- [ ] Устранение critical/high из npm audit
- [ ] PILOT_HARDENING_CHECKLIST выполнен перед каждым демо

### 60 дней (пилот)
- [ ] 3–5 демо-сессий, ≥5 feedback-форм
- [ ] Сбор метрик: время подготовки документа, доверие EvidenceMap
- [ ] Решение GO/HOLD/NO-GO по PILOT_SUCCESS_CRITERIA

### 90 дней (после пилота)
- [ ] Security Assessment (STRIDE/OWASP, SAST)
- [ ] Validation тестами: 5 сценариев из ТЗ (поиск → DOCX → sha256, письмо → approve → apply, path enforcement, 403)
- [ ] Оценка кастомизации: % логики через конфиг, время «подключить новый источник»

---

## Доказательства (артефакты)

| Область | Артефакт |
|---------|----------|
| Compliance | docs/plans/EXPECTED_QUESTIONS_COMPLIANCE.md, docs/trust/HOW_WE_ENSURE_AUDIT_INTEGRITY.md |
| Runbook | docs/plans/PILOT_EXECUTION_RUNBOOK.md, PILOT_HARDENING_CHECKLIST.md |
| RBAC | docs/RBAC.md, lib/authz/permissions.ts |
| Security | docs/SECURITY_POSTURE.md |
| Demo | docs/plans/DEMO_SCRIPT_V1.2.md |

---

## Контакты и следующие шаги

| Этап | Действие |
|------|----------|
| До пилота | Согласовать scope (EASA vs ARMAC), выполнить must-fix |
| Пилот | 1–2 недели, 3–5 реальных актов |
| После | Собрать метрики, решение по масштабированию |

---

*Документ подготовлен по ТЗ «Комплексная проверка ПО для собственника». Детальный чек-лист аудитора: [AUDITOR_CHECKLIST.md](./AUDITOR_CHECKLIST.md).*
