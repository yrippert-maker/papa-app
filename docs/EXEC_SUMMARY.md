# Executive Summary — Compliance & Due Diligence

**Позиционирование:** *Independent, reproducible compliance verification infrastructure.*

Краткая надстройка для non-technical decision-maker: что это, зачем, кому доверять и где детали. Источники истины — перечисленные ниже документы; здесь только ссылки и один абзац контекста.

---

## Что делает программа

Система ведёт неизменяемый журнал доказательств (ledger), строит дневные Merkle-сводки (rollups) и при необходимости якорит корень в публичной сети (Polygon). Верификация воспроизводима офлайн по auditor pack без доступа к живой системе.

→ **[README_COMPLIANCE.md](./README_COMPLIANCE.md)** — обзор пайплайна, артефакты, кому что отдавать.

---

## Use cases

Due diligence, запросы регуляторов, банковские/платёжные аудиты, enterprise procurement, внутренний и внешний аудит, board-level review.

→ **[README_COMPLIANCE.md](./README_COMPLIANCE.md)** (§ How to use this in practice), **[compliance/DUE_DILIGENCE_ANSWER_SHEET.md](./compliance/DUE_DILIGENCE_ANSWER_SHEET.md)**.

---

## Принцип доверия (high-level)

Целостность и происхождение событий обеспечиваются криптографически (подписи, хэши); на цепочку выносятся только коммитменты, не операционные данные. Независимая проверка — через auditor pack и скрипт верификации.

→ **[ASSURANCE.md](./ASSURANCE.md)** (§ Integrity Anchoring, Scope and Limitations), **[trust/PUBLIC_TRUST_EXPLAINER.md](./trust/PUBLIC_TRUST_EXPLAINER.md)**, **[trust/HOW_WE_ENSURE_AUDIT_INTEGRITY.md](./trust/HOW_WE_ENSURE_AUDIT_INTEGRITY.md)**.

---

## Какие риски контролируются

Целостность и прослеживаемость событий в ledger; подмена артефактов верификации; отсутствие независимой проверки. Угрозы и границы — в threat model и scope.

→ **[security/THREAT_MODEL.md](./security/THREAT_MODEL.md)**, **[ASSURANCE.md](./ASSURANCE.md)** (§ Scope).

---

## Неизменность и проверяемость

Ledger append-only; rollups по дням с Merkle root; опциональное якорение; политика верификации (policy-as-data); независимая проверка по pack без доступа к продакшену.

→ **[README_COMPLIANCE.md](./README_COMPLIANCE.md)** (Artifacts), **[VERIFY_POLICY.md](./VERIFY_POLICY.md)**, **[AUDIT_PACK_RETENTION.md](./AUDIT_PACK_RETENTION.md)**, **[ops/EVIDENCE_SIGNING.md](./ops/EVIDENCE_SIGNING.md)**.

---

## Контакты и следующие шаги для аудитора

Security disclosure и audit inquiries — **[ASSURANCE.md](./ASSURANCE.md)** (§ Contact). Однодневный чеклист для аудитора — **[AUDITOR_CHECKLIST_1DAY.md](./AUDITOR_CHECKLIST_1DAY.md)**. Сборка compliance ZIP — **[README_COMPLIANCE.md](./README_COMPLIANCE.md)** (§ Building the compliance ZIP).

---

## Рекомендуемый план (если цель — рынок / монетизация / enterprise)

| Шаг | Срок | Действие |
|-----|------|----------|
| **1** | 1–2 дня | ✅ EXEC_SUMMARY.md добавлен (этот документ). |
| **2** | По запросу, 1 день | Добавить шаблонные LEGAL_ENTITY.md, THIRD_PARTIES.md, CHANGE_MANAGEMENT.md, LIMITATIONS.md (формализация без изменения логики). |
| **3** | — | Зафиксировать позиционирование: *"Independent, reproducible compliance verification infrastructure."* — см. первый абзац выше. |

Детальное сопоставление с Compliance Framework и статус артефактов — **[compliance/COMPLIANCE_FRAMEWORK_MAPPING.md](./compliance/COMPLIANCE_FRAMEWORK_MAPPING.md)**.  
План достижения паритета с custom audit infra (Decision Record, отчёты, RACI, Control-as-Code) — **[compliance/ENTERPRISE_PARITY_ROADMAP.md](./compliance/ENTERPRISE_PARITY_ROADMAP.md)**.
