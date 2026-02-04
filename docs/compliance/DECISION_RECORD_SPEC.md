# Decision Record — Specification

**Цель:** формализованное объяснение решения верификации, пригодное для регулятора, суда, board review. Не заменяет verify-summary или ledger-entry — дополняет их «почему» и «какие правила сработали».

---

## 1. Назначение

- **Машинный артефакт** (`decision-record.json`) — для интеграций, аудита, подписи.
- **Человекочитаемый** (`decision-record.md`) — для отчётов и комиссий.

Оба генерируются одним и тем же шагом (после верификации); источник истины — результат `independent-verify.mjs`.

---

## 2. Место в пайплайне

- **Когда:** сразу после выполнения проверок, вместе с записью `verify-summary.json` и (при включённом `WRITE_LEDGER_ENTRY`) `ledger-entry.json`.
- **Где:** в каталоге audit pack (рядом с `verify-summary.json`) или по пути из `DECISION_RECORD_PATH`.
- **Кто генерирует:** `independent-verify.mjs` (при верификации pack).

---

## 3. Схема decision-record.json (v1)

| Поле | Тип | Описание |
|------|-----|----------|
| `schema_version` | number | Всегда `1` для данной схемы. |
| `decision_id` | string (UUID) | Уникальный идентификатор экземпляра решения (для UI/DB). |
| `decision_fingerprint_sha256` | string | Детерминированный SHA-256 от `sha256(pack_ref + policy_hash + verify_summary_hash + as_of?)`; криптографическая идентичность решения для регуляторной воспроизводимости. |
| `ledger_entry_id` | string \| null | SHA-256 fingerprint ledger-entry; цепочка: decision_id → ledger_entry_id → anchor. |
| `generated_at` | string (ISO 8601) | Время формирования записи. |
| `pack_ref` | object | Ссылка на проверяемый pack. |
| `pack_ref.dir` | string | Путь к каталогу pack. |
| `pack_ref.pack_id` | string \| null | Идентификатор pack из MANIFEST. |
| `pack_ref.pack_sha256` | string \| null | Хэш pack из pack_hash.json. |
| `input_policies` | array | Применённые политики (откуда загружены, версия, хэш при наличии). |
| `input_policies[].path` | string | Путь к файлу политики. |
| `input_policies[].version` | number \| null | Версия из policy. |
| `input_policies[].fail_severity` | string[] | Severity, при которых результат = fail. |
| `input_policies[].fail_types` | string[] | Типы issue, при которых результат = fail. |
| `input_policies[].require_pack_signature` | boolean | Требовалась ли подпись pack. |
| `input_policies[].require_anchoring_issues` | boolean | Требовался ли файл ANCHORING_ISSUES. |
| `checks` | array | Список проверок и их исход. |
| `checks[].id` | string | Идентификатор проверки (например `pack_signature`, `anchoring_status`, `anchoring_issues`). |
| `checks[].name` | string | Краткое имя для отчёта. |
| `checks[].outcome` | string | `pass` \| `fail` \| `warn` \| `skip`. |
| `checks[].reason` | string \| null | Причина (например «missing pack_hash.json»). |
| `checks[].rule_fired` | string \| null | Идентификатор правила, если сработало (например тип issue). |
| `rules_fired` | array | Какие правила привели к fail/warn. |
| `rules_fired[].rule_type` | string | Тип правила (например `fail_type`, `fail_severity`, `strict_anchoring`). |
| `rules_fired[].severity` | string \| null | Severity issue. |
| `rules_fired[].issue_type` | string \| null | Тип issue (например RECEIPT_INTEGRITY_MISMATCH). |
| `rules_fired[].condition_met` | boolean | Условие сработало. |
| `rules_fired[].message` | string | Человекочитаемое объяснение. |
| `rules_fired[].runbook` | string \| null | Ссылка на runbook. |
| `outcome` | object | Итог решения. |
| `outcome.overall` | string | `pass` \| `fail`. |
| `outcome.severity_effective` | string \| null | `fail` \| `warn` \| null. |
| `outcome.why` | string | Краткое текстовое объяснение («All checks passed» / «Pack signature missing» / «Disallowed anchoring issues: …»). |
| `approval` | object | Кто утвердил / автоматическое утверждение (заготовка под RACI). |
| `approval.mode` | string | `auto` \| `manual`. |
| `approval.policy_ref` | string \| null | Ссылка на политику, по которой auto-approved. |
| `approval.approved_by` | string \| null | При manual — идентификатор (пока не используется). |
| `approval.approved_at` | string \| null | При manual — ISO 8601 (пока не используется). |
| `references` | object | Ссылки на связанные артефакты. |
| `references.verify_summary` | string | Путь к verify-summary.json. |
| `references.ledger_entry` | string \| null | Путь к ledger-entry.json при наличии. |
| `temporal` | object \| null | При `--as-of`: временной контекст решения. |
| `temporal.as_of` | string (ISO 8601) | Дата «на которую» принято решение. |
| `temporal.ledger_snapshot` | string \| null | ledger_entry_id (snapshot ledger на as_of). |
| `temporal.policy_version` | string \| null | Версия политики (например v1). |
| `temporal.policy_hash` | string \| null | SHA-256 политики. |

---

## 4. Формат decision-record.md (человекочитаемый)

Генерируемый Markdown содержит:

1. **Заголовок:** Decision Record — &lt;pack_id или dir&gt; — &lt;дата&gt;
2. **Итог:** PASS / FAIL и кратко «why».
3. **Входные данные:** pack ref, применённые политики (путь, fail_severity, fail_types).
4. **Проверки:** таблица (Check | Outcome | Reason).
5. **Сработавшие правила:** список правил, приведших к fail/warn (тип, message, runbook).
6. **Утверждение:** Auto-approved under policy &lt;path&gt; (или место для Manual approval).
7. **Ссылки:** verify-summary.json, ledger-entry.json.

Повторять сырые данные из JSON не обязательно — достаточно ссылок и кратких выводов.

---

## 5. Связь с другими артефактами

| Артефакт | Связь |
|----------|--------|
| verify-summary.json | decision-record ссылается на него; дублирует outcome, но добавляет checks/rules_fired/why. |
| ledger-entry.json | decision-record ссылается на него; ledger остаётся источником для append-only trail. |
| verify-policy.json | Упоминается в input_policies; хэш политики при наличии — в расширении. |

---

## 6. Версионирование

- При несовместимом изменении схемы `schema_version` увеличивается.
- Обратная совместимость: новые поля допускаются; старые клиенты игнорируют неизвестные поля.
