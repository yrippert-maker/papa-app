# Compliance Report (PDF) — Specification

**Цель:** формальный слой «официальный отчёт для regulator / board / court»: генерация Executive Compliance Report (PDF), Technical Appendix и подписываемого артефакта.

---

## 1. Назначение

- **Executive Compliance Report (PDF)** — краткий отчёт для подписи (1–3 страницы): что проверено, итог, дата, ссылки на доказательства.
- **Technical Appendix** — приложение (PDF или отдельный файл): детали проверок, decision record, policy, артефакты.
- **Подписываемый артефакт** — хэш отчёта, подпись, ссылка на audit pack / ledger; привязка отчёта к неизменяемой цепочке.

---

## 2. Структура Executive Compliance Report (PDF)

Рекомендуемые секции (1–3 страницы):

| Секция | Содержимое |
|--------|-------------|
| **Title / Meta** | Название «Compliance Verification Report», дата генерации, идентификатор отчёта (UUID или hash), версия схемы. |
| **Scope** | Что проверено: audit pack (pack_id, pack_sha256), период/дата верификации, применённая политика (path или id). |
| **Outcome** | PASS / FAIL; краткое текстовое объяснение (из decision-record.outcome.why). |
| **Evidence references** | Ссылки на: audit pack (path или URI), ledger entry (fingerprint_sha256 или URI), decision-record.json, verify-summary.json. |
| **Approval** | Auto-approved under policy &lt;ref&gt; или Manual: approved by X at Y (при наличии RACI). |
| **Signature block** | Место для подписи (опционально): «Report hash: SHA-256 &lt;hex&gt;», «Signed: &lt;key_id&gt; at &lt;timestamp&gt;» (если подпись отчёта включена). |

Источник данных: `decision-record.json`, `verify-summary.json`, `ledger-entry.json` (в pack).

---

## 3. Technical Appendix

- Включить или сослаться на:
  - Decision Record (human-readable: decision-record.md или фрагмент).
  - Применённая политика (verify-policy.json или anchoring.verify-policy.json).
  - Краткая таблица проверок (checks) и исходов (из decision-record.json).
  - **Historical Compliance Changes** (при `--diff-from` и `--diff-to`): семантический diff между двумя решениями; ссылка на decision-diff.json.
- Формат: PDF (второй файл) или Markdown/HTML как приложение — по выбору реализации.

---

## 4. Подписываемый артефакт (report manifest)

Чтобы привязать отчёт к audit trail:

| Поле | Описание |
|------|-----------|
| `report_id` | Уникальный идентификатор отчёта (UUID или hash от содержимого). |
| `generated_at` | ISO 8601. |
| `report_type` | `executive_compliance_report` \| `technical_appendix`. |
| `report_md_hash_sha256` | SHA-256 от canonical markdown — источник истины; PDF считается presentation layer. |
| `report_pdf_hash_sha256` | SHA-256 от PDF (если сгенерирован); опционально. |
| `pack_ref` | pack_id, pack_sha256, путь к pack. |
| `ledger_entry_id` | fingerprint_sha256 ledger-entry. |
| `decision_record_ref` | `{ path, sha256 }` — ссылка на decision-record.json. |
| `verify_summary_ref` | `{ path, sha256 }` — ссылка на verify-summary.json. |
| `policy_ref` | `{ path, sha256 }` — ссылка на verify-policy. |
| `control_definitions_ref` | `{ path, sha256 }` — ссылка на control-definitions (если использовались). |
| `ledger_entry_ref` | `{ path, sha256 }` — ссылка на ledger-entry.json. |

Файл: `report-manifest.json`. Подпись: `report-signature.json` (manifest_hash_sha256, signature_base64, key_id) — подписывается canonical JSON manifest. Переменные: `REPORT_SIGN_PRIVATE_KEY_PEM` или `REPORT_SIGN_PRIVATE_KEY_PATH`, `REPORT_SIGN_KEY_ID`.

---

## 5. Место в пайплайне

- **Вход:** audit pack с уже сгенерированными `verify-summary.json`, `ledger-entry.json`, `decision-record.json`.
- **Шаги:**  
  1) Собрать данные из этих файлов;  
  2) Сгенерировать Executive Report (MD) и при необходимости Technical Appendix;  
  3) Вычислить report_hash_sha256;  
  4) Записать compliance-report.md, report-manifest.json;  
  5) (Опционально) Control Coverage Matrix → control-coverage-matrix.csv;  
  6) (Опционально) PDF через `md-to-pdf` при флаге `--pdf`.
- **Реализация:** `scripts/generate-compliance-report.mjs` (npm run compliance:report).

```bash
# Из каталога pack
npm run compliance:report -- --pack ./audit-pack --output ./reports
# С PDF (требует: npm install md-to-pdf)
npm run compliance:report -- --pack ./audit-pack --output ./reports --pdf
# С Historical Compliance Changes (Appendix)
npm run compliance:report -- --pack ./audit-pack --diff-from decision-A.json --diff-to decision-B.json --output ./reports
```

---

## 6. Версионирование

- Схема отчёта и manifest: версия в имени файла или внутри JSON (например `schema_version: 1`).
- Обратная совместимость: новые поля допускаются.

---

## 7. Связь с другими артефактами

| Артефакт | Связь |
|----------|--------|
| decision-record.json | Источник outcome, why, checks, approval. |
| verify-summary.json | Источник policy, anchoring, result. |
| ledger-entry.json | Ссылка для доказательства в ledger; fingerprint_sha256 в manifest. |
| pack_hash.json / pack_signature.json | Модель для подписи manifest (аналогичный формат). |
