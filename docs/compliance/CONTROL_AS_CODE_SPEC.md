# Control-as-Code DSL — Specification

**Цель:** язык описания контролей, ориентированный на аудиторов и регуляторов (Control-as-Code), поверх существующей verify-policy. Цепочка: Policy → Control → Evidence → Decision.

---

## 1. Назначение

- **VERIFY_POLICY** (fail_types, fail_severity) остаётся источником истины для движка верификации.
- **Control Definitions** — человекочитаемый слой: идентификатор контроля, цель, какие доказательства проверяются, какое утверждение (assertion), severity.
- Аудитор видит «контроль AML-LEDGER-01: обеспечить неизменность ledger; доказательства: ledger_hash, anchor_receipt; утверждение: ledger_hash == anchor_hash; severity: critical» — без погружения в JSON политики.

---

## 2. Связь с verify-policy

| Уровень | Артефакт | Роль |
|---------|----------|------|
| **Engine** | verify-policy.json (fail_types, fail_severity, require_pack_signature, require_anchoring_issues) | Что именно приводит к pass/fail в independent-verify. |
| **Control-as-Code** | control-definitions.yaml (или .json) | Описание контролей: id, objective, evidence, assertion, severity; маппинг на правила движка. |

Маппинг: один контроль может соответствовать одному или нескольким правилам (например контроль «Ledger integrity» → правила pack_signature + anchoring_issues по типам RECEIPT_*).

---

## 3. Схема Control Definition (YAML/JSON)

Пример одного контроля:

```yaml
control:
  id: AML-LEDGER-01
  name: Ledger immutability
  objective: Ensure ledger entries are tamper-evident and anchored.
  evidence:
    - ledger_hash
    - anchor_receipt
    - pack_signature
  assertion:
    - pack_signature_valid
    - no_disallowed_anchoring_issues
  severity: critical
  policy_ref:
    fail_types:
      - RECEIPT_INTEGRITY_MISMATCH
      - RECEIPT_MISSING_FOR_CONFIRMED
      - ANCHOR_FAILED
    fail_severity:
      - critical
    require_pack_signature: true
```

Поля:

| Поле | Тип | Описание |
|------|-----|----------|
| `control.id` | string | Уникальный идентификатор (например AML-LEDGER-01). |
| `control.name` | string | Краткое имя. |
| `control.objective` | string | Цель контроля (для отчётов). |
| `control.evidence` | string[] | Список доказательств (ledger_hash, anchor_receipt, pack_signature, anchoring_issues). |
| `control.assertion` | string[] | Что проверяется (pack_signature_valid, no_disallowed_anchoring_issues, anchoring_status_ok). |
| `control.severity` | string | critical \| high \| medium \| low. |
| `control.not_applicable` | boolean | Опционально: true = контроль вне скоупа (Status: NOT_APPLICABLE в coverage matrix). |
| `control.policy_ref` | object | Связь с verify-policy: fail_types, fail_severity, require_pack_signature и т.д. (для генерации или проверки согласованности). |

---

## 4. Файл control-definitions

- **Расположение:** например `config/control-definitions.yaml` или `docs/compliance/control-definitions.yaml`.
- **Формат:** YAML (предпочтительно для читаемости) или JSON.
- **Использование:**  
  - при генерации decision-record или отчёта — подставлять в человекочитаемый вывод «какие контроли проверялись»;  
  - при необходимости — скрипт проверки согласованности: control-definitions vs verify-policy (все ли fail_types/fail_severity покрыты контролями).

---

## 5. Пример (несколько контролей)

```yaml
version: 1
domain: anchoring
generated_at: "2026-02-03T00:00:00Z"

controls:
  - id: AML-LEDGER-01
    name: Ledger immutability
    objective: Ensure ledger entries are tamper-evident and anchored.
    evidence: [ledger_hash, anchor_receipt, pack_signature]
    assertion: [pack_signature_valid, no_disallowed_anchoring_issues]
    severity: critical
    policy_ref:
      fail_types: [RECEIPT_INTEGRITY_MISMATCH, RECEIPT_MISSING_FOR_CONFIRMED, ANCHOR_FAILED]
      fail_severity: [critical]
      require_pack_signature: true

  - id: AML-LEDGER-02
    name: Anchoring status
    objective: Require anchoring assessment status OK (no FAIL).
    evidence: [anchoring_status]
    assertion: [anchoring_status_ok]
    severity: critical
    policy_ref:
      strict_anchoring: true
```

---

## 6. Control Coverage Matrix (control-coverage-matrix.csv)

Генерируется `generate-compliance-report.mjs` при наличии control-definitions. Колонки:

| Колонка | Описание |
|---------|----------|
| Control ID | control.id |
| Name | control.name |
| Objective | control.objective (обрезано) |
| Covered by policies | fail_types, fail_severity, require_pack_signature, strict_anchoring |
| Covered by checks | Имена проверок из verify-summary/decision-record, покрывающих evidence |
| Evidence present | Доказательства, для которых check = pass/skip |
| Evidence missing | Доказательства, для которых check = fail/warn или отсутствует |
| Rules fired | rule_fired из checks при fail (если control провалился) |
| Status | PASS \| FAIL \| WARN \| NOT_APPLICABLE |

**Status:**
- `PASS` — все evidence checks pass/skip
- `FAIL` — хотя бы один check = fail
- `WARN` — нет fail, но есть check = warn
- `NOT_APPLICABLE` — evidence пустой или control.not_applicable = true (вне скоупа)

---

## 7. Интеграция с decision-record (опционально)

В decision-record.json можно добавить блок `controls_checked`: список control.id и outcome (pass/fail) по каждому, производный из checks и rules_fired. Это даёт трассировку «контроль AML-LEDGER-01 → fail из-за правила RECEIPT_INTEGRITY_MISMATCH».

---

## 8. Реализация (минимальная)

1. **Сейчас:** добавить файл-пример `config/control-definitions.example.yaml` (или в docs/compliance) по схеме выше.
2. **Далее:** при генерации decision-record или Compliance Report — при наличии control-definitions подставлять в отчёт список контролей и их цели; опционально — скрипт проверки согласованности control-definitions ↔ verify-policy.

---

## 9. Связь с ENTERPRISE_PARITY_ROADMAP

Блок «Control-as-Code DSL» из roadmap: язык общения с аудиторами (control id, objective, evidence, assertion, severity), без замены verify-policy как движка.
