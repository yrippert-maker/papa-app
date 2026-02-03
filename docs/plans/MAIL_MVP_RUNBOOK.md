# Mail MVP — Runbook (локально и CI)

## 1. Подготовить начальные документы (один раз)

Создать в S3/GCS (или через AWS Console / gsutil):

- **docs-store/finance/payments/latest.json**
```json
{ "version": 1, "generated_at": null, "items": [] }
```

- **docs-store/mura-menasa/handbook/latest.md**
```markdown
# Mura menasa handbook

## Incoming updates (drafts)
```

Опционально: **docs-store/config/mail-allowlist/latest.json** (для M2.1)
```json
{ "version": 1, "mode": "deny_all", "allowed_from": [], "allowed_from_regex": "", "updated_at": null, "updated_by": null }
```

## 2. Запуск portal-api

```bash
cd services/auditor-portal-api
npm i
LEDGER_BUCKET=my-ledger \
DOCS_BUCKET=my-docs DOCS_PREFIX=docs-store \
MAIL_BUCKET=my-ledger MAIL_EVENTS_PREFIX=mail-events MAIL_PROPOSALS_PREFIX=mail-proposals \
PORTAL_AUTH_MODE=none \
PORTAL_WRITE_API_KEY=secret-write-key \
npm start
```

## 3. Запуск portal-ui

```bash
cd apps/auditor-portal
npm i
VITE_PORTAL_API_URL=http://localhost:8790 npm run dev
```

Открыть: http://localhost:5179/mail/inbox, /documents/finance%2Fpayments, /documents/mura-menasa%2Fhandbook, /settings/mail-allowlist.

## 4. Сбор писем (collector)

**IMAP (mail.nic.ru):**
```bash
MAIL_IMAP_ENABLED=1 MAIL_IMAP_HOST=mail.nic.ru MAIL_IMAP_USER=... MAIL_IMAP_PASSWORD=... \
MAIL_BUCKET=my-ledger MAIL_EVENTS_PREFIX=mail-events \
MAIL_ALLOWED_FROM=pay@bank.ru,billing@vendor.com \
MAIL_ALLOWED_FROM_MODE=deny_all \
node scripts/mail-collector.mjs
```

**Gmail (Workspace, service account impersonation):**
```bash
MAIL_GMAIL_ENABLED=1 MAIL_GMAIL_PROJECT_ID=... MAIL_GMAIL_CLIENT_EMAIL=... \
MAIL_GMAIL_PRIVATE_KEY="..." MAIL_GMAIL_IMPERSONATE=user@domain \
MAIL_BUCKET=my-ledger MAIL_EVENTS_PREFIX=mail-events \
MAIL_ALLOWED_FROM=... \
node scripts/mail-collector.mjs
```

**Allowlist из UI (M2.1):** если задан `DOCS_BUCKET` и `MAIL_ALLOWLIST_DOC_ID=config/mail-allowlist`, collector при старте загружает allowlist из docs-store; env перебивает UI-конфиг.

## 5. Триаж (создаёт proposals)

```bash
MAIL_BUCKET=my-ledger MAIL_EVENTS_PREFIX=mail-events MAIL_PROPOSALS_PREFIX=mail-proposals \
node scripts/mail-triage-agent.mjs
```

По умолчанию сканируется префикс текущего дня `mail-events/YYYY/MM/DD/`. Переопределить: `MAIL_SCAN_PREFIX=mail-events/`, `MAIL_SCAN_LIMIT=200`.

## 6. CI (пример)

- **Collector:** cron или workflow по расписанию с env из secrets.
- **Triage:** после collector или отдельно по расписанию.
- **Portal API:** деплой с `LEDGER_BUCKET`, `DOCS_BUCKET`, `MAIL_BUCKET`, `PORTAL_WRITE_API_KEY`.

## 7. Definition of Done (Sprint M1)

- [ ] Письмо из Gmail/IMAP появляется в mail-events/ и в Portal inbox.
- [ ] Оператор открывает письмо, создаёт proposal (ручной MVP) или triage создал proposal.
- [ ] Оператор нажимает Approve с PORTAL_WRITE_API_KEY → создаётся новая версия документа (finance/payments или mura-menasa/handbook) и запись в doc-ledger.
- [ ] Allowlist (M2/M2.1): collector собирает только разрешённых отправителей; при пустом allowlist и deny_all ничего не собирает.
