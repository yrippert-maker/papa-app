# Сопоставление Compliance Framework с docs/ papa-app

**Источник:** Compliance.docx (Универсальный Compliance & Due Diligence Plan / Program Information Disclosure Framework).  
**Цель:** отчёт о покрытии структуры плана существующей документацией в репозитории.

---

## Сводка

| Раздел плана | Покрытие | Комментарий |
|--------------|----------|-------------|
| 0. Executive summary | ✅ Покрыто | docs/EXEC_SUMMARY.md — надстройка со ссылками на существующие документы |
| 1. Legal & Organizational Context | ⚠️ Частично | Контакты/Scope в ASSURANCE; нет LEGAL_ENTITY.md, THIRD_PARTIES.md |
| 2. Scope & Trust Model | ✅ Покрыто | ASSURANCE.md, THREAT_MODEL.md, trust/, governance/ |
| 3. Architecture & Data Flow | ✅ Покрыто | ARCHITECTURE_OVERVIEW, README_COMPLIANCE, диаграммы по ссылкам |
| 4. Integrity & Cryptography | ✅ Покрыто | EVIDENCE_SIGNING, VERIFY_POLICY, fixtures, config |
| 5. Evidence & Audit Trail | ✅ Покрыто | README_COMPLIANCE, AUDIT_PACK_RETENTION, runbooks |
| 6. Policies & Controls | ✅ Покрыто | VERIFY_POLICY, verify-policy.default.json, config |
| 7. Issue Management | ✅ Покрыто | runbooks/anchoring, runbook/anchoring-issues |
| 8. Monitoring, Alerting & Response | ✅ Покрыто | ALERTS_COMPLIANCE, compliance/INCIDENT_RESPONSE |
| 9. Access Control & Security | ✅ Покрыто | compliance/ACCESS_REVIEW, KEY_MANAGEMENT, AUTHZ, RBAC |
| 10. Reproducibility & Independent Verification | ✅ Покрыто | AUDITOR_CHECKLIST, scripts/independent-verify.mjs, VERIFY_POLICY |
| 11. Change Management & Governance | ⚠️ Частично | Release notes, LTS, governance/ — нет отдельного CHANGE_MANAGEMENT.md |
| 12. Historical Coverage & Limitations | ⚠️ Частично | Есть в ASSURANCE (Scope/Limitations); нет отдельного LIMITATIONS.md |
| 13. Appendix (schemas, fixtures) | ✅ Частично | schemas/, __fixtures__; не в docs/schemas |

---

## 0. Executive summary

**План:** EXEC_SUMMARY.md, диаграмма high-level.

| Артефакт плана | В papa-app | Статус |
|----------------|------------|--------|
| EXEC_SUMMARY.md | docs/EXEC_SUMMARY.md | ✅ Надстройка: 1–2 стр., только ссылки, без дублирования деталей |
| Диаграмма high-level | Упоминания в ARCHITECTURE_OVERVIEW, REGULATORY_BUNDLE_MANIFEST | ⚠️ По ссылкам / в бандле |
| Краткое «что делает программа» | README_COMPLIANCE (Overview), ASSURANCE.md, AUDIT_EXECUTIVE_SUMMARY.md | ✅ |

---

## 1. Legal & Organizational Context

**План:** LEGAL_ENTITY.md, THIRD_PARTIES.md, контактный security policy.

| Артефакт плана | В papa-app | Статус |
|----------------|------------|--------|
| LEGAL_ENTITY.md | Нет | ❌ |
| THIRD_PARTIES.md | Нет | ❌ |
| Контакты security / compliance | ASSURANCE.md (§ Contact), README_COMPLIANCE | ✅ |
| Роли (owner, auditor, security) | RESPONSIBILITY_MATRIX.md, compliance/ACCESS_REVIEW_CADENCE.md | ✅ |

**Рекомендация:** при запросе регулятора/инвестора добавить LEGAL_ENTITY.md и THIRD_PARTIES.md (юрисдикции, облака, CI, хранилища).

---

## 2. Scope & Trust Model

**План:** SCOPE.md, THREAT_MODEL.md.

| Артефакт плана | В papa-app | Статус |
|----------------|------------|--------|
| SCOPE.md | ASSURANCE.md (§ Scope: In Scope / Out of Scope) | ✅ По смыслу |
| THREAT_MODEL.md | security/THREAT_MODEL.md | ✅ |
| Trust assumptions | trust/PUBLIC_TRUST_EXPLAINER.md, HOW_WE_ENSURE_AUDIT_INTEGRITY.md | ✅ |
| DRY_RUN_AUDIT_PLAN | governance/DRY_RUN_AUDIT_PLAN.md | ✅ |

---

## 3. Architecture & Data Flow

**План:** ARCHITECTURE.md, Data Flow Diagram, Sequence diagram.

| Артефакт плана | В papa-app | Статус |
|----------------|------------|--------|
| ARCHITECTURE.md | ARCHITECTURE_OVERVIEW.md | ✅ |
| Data flow (ledger, rollup, anchor) | README_COMPLIANCE.md (Overview, Artifacts) | ✅ |
| Компоненты (CI, pack, verifier, ledger, portal) | README_COMPLIANCE, AUDITOR_PORTAL.md, ops/verify-aggregator.md | ✅ |
| Диаграммы | Упоминания в манифестах; отдельные файлы не перечислены в docs/ | ⚠️ |

---

## 4. Integrity & Cryptography

**План:** CRYPTOGRAPHY.md, pack_hash.json, pack_signature.json, verify-summary.json.

| Артефакт плана | В papa-app | Статус |
|----------------|------------|--------|
| Описание хэшей/подписей/алгоритмов | ops/EVIDENCE_SIGNING.md | ✅ |
| Key rotation, verification | compliance/KEY_MANAGEMENT_POLICY.md, VERIFY_POLICY.md | ✅ |
| Примеры pack / verify-summary | __fixtures__/auditor-pack-minimal/, auditor-pack-bad-receipt/ (ledger-entry.json, verify-summary.json) | ✅ |
| pack_hash / pack_signature в репо | В составе fixtures и скриптов (create-auditor-pack, independent-verify) | ✅ |

---

## 5. Evidence & Audit Trail

**План:** AUDIT_PACK_RETENTION.md, примеры ledger, rollup, Merkle.

| Артефакт плана | В papa-app | Статус |
|----------------|------------|--------|
| AUDIT_PACK_RETENTION.md | docs/AUDIT_PACK_RETENTION.md | ✅ |
| Что такое audit pack / ledger entry | README_COMPLIANCE (Artifacts, Evidence) | ✅ |
| Хранение, неизменность, retention | ops/RETENTION_POLICY.md, RETENTION_POLICY_MANIFEST.md | ✅ |
| Примеры ledger/rollup/anchor | __fixtures__, samples-redacted в trust/REDACTED_SAMPLES.md, compliance-package | ✅ |

---

## 6. Policies & Controls

**План:** VERIFY_POLICY.md, verify-policy.json, policy versioning.

| Артефакт плана | В papa-app | Статус |
|----------------|------------|--------|
| VERIFY_POLICY.md | docs/VERIFY_POLICY.md | ✅ |
| verify-policy.json (default) | docs/verify-policy.default.json, config/anchoring.verify-policy.json | ✅ |
| Severity, fail/warn | VERIFY_POLICY.md, policy-as-data в README_COMPLIANCE | ✅ |
| Versioning policy | compliance/COMPLIANCE_PACKAGE_VERSIONING.md | ✅ |

---

## 7. Issue Management & Exception Handling

**План:** ANCHORING_ISSUES.md, runbooks (receipt-mismatch, receipt-missing, anchor-failed), ack.

| Артефакт плана | В papa-app | Статус |
|----------------|------------|--------|
| Типы issues, severity, ack/TTL | runbook/anchoring-issues.md, VERIFY_POLICY | ✅ |
| Runbooks | runbooks/anchoring/receipt-mismatch.md, receipt-missing.md, anchor-failed.md, pending-too-long.md, gap-periods.md | ✅ |
| Exception register | README_COMPLIANCE (Exception register) | ✅ |

---

## 8. Monitoring, Alerting & Response

**План:** INCIDENT_RESPONSE.md, CI/monitor jobs, алерты, эскалация.

| Артефакт плана | В papa-app | Статус |
|----------------|------------|--------|
| INCIDENT_RESPONSE.md | compliance/INCIDENT_RESPONSE.md | ✅ |
| Алерты (Slack, PromQL) | ops/ALERTS_COMPLIANCE.md | ✅ |
| Runbooks (evidence, ledger, aggregator) | ops/RUNBOOK_EVIDENCE_VERIFY.md, RUNBOOK_LEDGER_DEAD_LETTER.md, RUNBOOK_VERIFY_AGGREGATOR.md | ✅ |

---

## 9. Access Control & Security

**План:** ACCESS_CONTROL.md, key management runbook.

| Артефакт плана | В papa-app | Статус |
|----------------|------------|--------|
| Кто имеет доступ к CI/ключам/ledger/portal | compliance/ACCESS_REVIEW_CADENCE.md, KEY_MANAGEMENT_POLICY.md | ✅ |
| Auth model (RBAC, OIDC) | AUTHZ_MODEL.md, ENDPOINT_AUTHZ_EVIDENCE.md, RBAC.md | ✅ |
| Key management runbook | compliance/KEY_MANAGEMENT_POLICY.md (rotation, revoke) | ✅ |

---

## 10. Reproducibility & Independent Verification

**План:** INDEPENDENT_VERIFICATION.md, команды (independent-verify.mjs).

| Артефакт плана | В papa-app | Статус |
|----------------|------------|--------|
| Как аудитор скачивает pack, проверяет подпись | AUDITOR_CHECKLIST_1DAY.md, AUDIT_HANDOFF_ANCHORING.md | ✅ |
| Команда верификации | VERIFY_POLICY.md, scripts/independent-verify.mjs | ✅ |
| Минимальные требования (Node, env) | В checklist и VERIFY_POLICY | ✅ |

**Примечание:** отдельного файла с названием INDEPENDENT_VERIFICATION.md нет; содержание разнесено по AUDITOR_CHECKLIST_1DAY, VERIFY_POLICY, AUDIT_HANDOFF_ANCHORING.

---

## 11. Change Management & Governance

**План:** CHANGE_MANAGEMENT.md, release notes, versioning.

| Артефакт плана | В papa-app | Статус |
|----------------|------------|--------|
| CHANGE_MANAGEMENT.md | Нет отдельного файла | ❌ |
| Approval flow, backward compatibility | governance/, BRANCHING_STRATEGY.md, LTS (ops/LTS_POLICY.md) | ⚠️ |
| Release notes / changelog | Множество RELEASE_NOTES_*, GITHUB_RELEASE_NOTES_*, CHANGELOG_* | ✅ |

**Рекомендация:** при необходимости оформить один документ CHANGE_MANAGEMENT.md (процесс изменений, approval, версионирование) со ссылками на governance и LTS.

---

## 12. Historical Coverage & Limitations

**План:** LIMITATIONS.md (с какого момента ledger, гэпы).

| Артефакт плана | В papa-app | Статус |
|----------------|------------|--------|
| LIMITATIONS.md | Нет отдельного файла | ❌ |
| Scope and Limitations | ASSURANCE.md (§ Integrity Anchoring — Scope and Limitations, § Scope / Out of Scope) | ✅ По смыслу |

**Рекомендация:** при запросе добавить LIMITATIONS.md (историческое покрытие ledger, явные ограничения).

---

## 13. Appendix (schemas, fixtures)

**План:** /docs/schemas/*.json, /fixtures/*.

| Артефакт плана | В papa-app | Статус |
|----------------|------------|--------|
| docs/schemas/*.json | В корне репо: schemas/approval-policy-v1.json | ⚠️ Не в docs/schemas |
| Fixtures | __fixtures__/auditor-pack-minimal/, auditor-pack-bad-receipt/ | ✅ |
| Примеры payload (ledger, verify-summary) | В __fixtures__, в compliance ZIP (samples-redacted) | ✅ |

---

## Варианты передачи внешней стороне (по плану)

| Вариант плана | В papa-app | Статус |
|---------------|------------|--------|
| **A. Read-only Auditor Portal + ZIP** | AUDITOR_PORTAL.md, scripts/compliance-package.mjs → External-Trust-Package-*.zip | ✅ |
| **B. Минимальный: README_COMPLIANCE + ссылки** | docs/README_COMPLIANCE.md, ссылки на portal и артефакты | ✅ |

---

## Рекомендуемые шаги (по приоритету)

1. ~~**Опционально:** добавить `docs/EXEC_SUMMARY.md`~~ — **Сделано:** [docs/EXEC_SUMMARY.md](../EXEC_SUMMARY.md) (надстройка со ссылками, позиционирование зафиксировано).
2. **По запросу регулятора/инвестора:** добавить шаблонные `LEGAL_ENTITY.md` и `THIRD_PARTIES.md` в docs или docs/compliance (формализация без изменения логики).
3. **По запросу:** добавить шаблонные `CHANGE_MANAGEMENT.md` и `LIMITATIONS.md` (формализация без изменения логики).
4. **Единая точка входа:** сохранить README_COMPLIANCE.md как главный индекс; при добавлении новых артефактов — дописать ссылки в README_COMPLIANCE и при необходимости в REGULATORY_BUNDLE_MANIFEST / compliance-package.mjs.

### План при цели «рынок / монетизация / enterprise»

| Шаг | Срок | Действие |
|-----|------|----------|
| **1** | 1–2 дня | EXEC_SUMMARY.md — добавлен. |
| **2** | По запросу, 1 день | Шаблонные LEGAL_ENTITY.md, THIRD_PARTIES.md, CHANGE_MANAGEMENT.md, LIMITATIONS.md. |
| **3** | — | Позиционирование: *"Independent, reproducible compliance verification infrastructure."* — зафиксировано в EXEC_SUMMARY.md. |

---

*Отчёт составлен по сопоставлению структуры Compliance.docx с содержимым docs/ и смежных каталогов papa-app.*
