# Last Touch: Compliance Enhancements

**Версия:** 1.0 | Февраль 2026

---

## 1. Output-path enforcement

**Цель:** Нигде в payload агент/клиент не может передать outputPath/filePath; сервер всегда строит путь сам.

**Реализация:**
- `lib/api/reject-path-payloads.ts` — рекурсивная проверка тела запроса на запрещённые ключи
- Запрещённые ключи: outputPath, output_path, filePath, file_path, outputDir, targetPath, savePath, destPath, absolutePath, fullPath, directory
- При обнаружении → `PATH_PAYLOAD_FORBIDDEN` → 400
- **Логирование:** событие `PATH_PAYLOAD_FORBIDDEN` в ledger_events (actor, endpoint, forbidden_keys, request_id)
- **Content-Type:** только `application/json`; иначе 415

**Где применено:**
- `POST /api/agent/export`
- `POST /api/agent/draft`
- `POST /api/agent/confirm`

---

## 2. Audit-log на apply

**Цель:** Evidence Kit для внешнего контура — полная трассировка apply.

**События в ledger_events:**

| event_type | payload |
|------------|---------|
| AGENT_EXPORT | actor, actor_email, timestamp, draft_id, output_relative_path, sha256, evidencemap_sha256, approval_record_id |
| INBOX_PATCH_APPLIED | actor, actor_email, timestamp, change_event_id, proposal_id, output_relative_path, sha256, artifact_sha256, approval_record_id |

**Где:**
- `POST /api/agent/export` — после успешной записи
- `POST /api/settings/inbox/{id}/apply` — после applyProposal

---

## 3. Контроль email-подлинности

**Цель:** Для комплаенса обязательно: хранить raw .eml, trust_status, auto-analyze только для TRUSTED.

**Реализация:**

### 3.1 trust_status
- Добавлено в `types/mail-mvp.ts`: `MailTrustStatus = 'TRUSTED' | 'UNTRUSTED' | 'UNKNOWN'`
- **TRUSTED** = только при dmarc=pass (safest MVP для комплаенса)
- **UNTRUSTED** = dmarc fail, spf fail, dkim fail или отсутствие dmarc
- **UNKNOWN** = заголовок Authentication-Results отсутствует

### 3.2 raw .eml
- IMAP: `msg.source` сохраняется в S3 как `{prefix}-raw/{YYYY-MM-DD}/{mail_id}.eml`
- Gmail: `format: 'raw'` → base64 decode → сохраняется аналогично
- Поля в mail_event: `raw_eml_key`, `raw_eml_sha256` (доказательство неизменности сырого письма)

### 3.3 auto-analyze только для TRUSTED
- `scripts/mail-triage-agent.mjs`: пропуск писем с `trust_status !== 'TRUSTED'`
- Override для тестов: `MAIL_AUTO_ANALYZE_UNTRUSTED=1`

---

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| MAIL_AUTO_ANALYZE_UNTRUSTED | 1 = разрешить auto-analyze для UNTRUSTED (только для тестов) |

---

## How to verify

### 1. Output-path enforcement
```bash
curl -X POST http://localhost:3001/api/agent/export \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d '{"draftId":"x","format":"docx","outputPath":"/etc/passwd"}'
# Ожидание: 400, в ledger_events — событие PATH_PAYLOAD_FORBIDDEN
```

### 2. Audit-log на apply
```bash
# После успешного apply inbox patch:
# В ledger_events появляется INBOX_PATCH_APPLIED с actor, change_event_id, artifact_sha256

# После успешного agent export:
# В ledger_events появляется AGENT_EXPORT с evidencemap_sha256, sha256
```

### 3. Письмо без dmarc pass → не auto-analyze
```bash
# Письмо с trust_status=UNTRUSTED (нет dmarc=pass) не попадает в triage
# MAIL_AUTO_ANALYZE_UNTRUSTED=1 — override для тестов
npm run mail:triage
# Проверить: в mail-proposals только письма с trust_status=TRUSTED
```

---

*Связано: [INBOX_EMAIL_WORKFLOW.md](./INBOX_EMAIL_WORKFLOW.md), [EXPECTED_QUESTIONS_COMPLIANCE.md](./EXPECTED_QUESTIONS_COMPLIANCE.md)*
