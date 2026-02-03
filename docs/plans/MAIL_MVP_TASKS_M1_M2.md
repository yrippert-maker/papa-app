# Mail MVP — Jira-style tasks (M1 + M2 + M2.1)

## EPIC: Mail → Portal → Docs store

---

## M1-1 Mail storage & listing

**Task:** Implement mail storage prefixes + API listing  
**AC:**
- [ ] Collector пишет mail-events/.../*.json
- [ ] GET /v1/mail/inbox возвращает список ключей
- [ ] GET /v1/mail/get?key= возвращает mail_event

---

## M1-2 Docs store read

**Task:** Add docs list/get/versions  
**AC:**
- [ ] GET /v1/docs/list показывает finance/payments и mura-menasa/handbook (после bootstrap)
- [ ] GET /v1/docs/get?doc_id= возвращает latest (doc)
- [ ] GET /v1/docs/versions возвращает версии

---

## M1-3 Proposals & approvals (write)

**Task:** Add propose/approve endpoints with PORTAL_WRITE_API_KEY  
**AC:**
- [ ] POST /v1/docs/propose сохраняет mail-proposals/<proposal_id>.json
- [ ] POST /v1/docs/approve: создаёт новую версию в docs-store/.../versions/..., обновляет latest.*, пишет doc-ledger/...json

---

## M1-4 Portal UI: inbox + mail view

**Task:** Add /mail/inbox + /mail/view  
**AC:**
- [ ] Список писем
- [ ] Просмотр письма
- [ ] Создание proposal (MVP manual)
- [ ] Approve/Reject работают при корректном x-api-key

---

## M1-5 Portal UI: documents

**Task:** Add /documents/:docId  
**AC:**
- [ ] Показывает latest + список versions

---

## M1-6 Bootstrap initial docs

**Task:** Create initial latest docs in storage  
**AC:**
- [ ] finance/payments/latest.json создан (items пустой массив)
- [ ] mura-menasa/handbook/latest.md создан (шапка + drafts section)

---

## M1-7 IMAP nic.ru collector

**Task:** Implement IMAP polling with uid+since window  
**AC:**
- [ ] Забирает письма за MAIL_SINCE_HOURS
- [ ] Пишет mail_event, не падает при плохих письмах

---

## M1-8 Gmail collector (Workspace SA)

**Task:** Implement Gmail API service-account impersonation  
**AC:**
- [ ] При корректных creds/impersonate читает 50 писем по query/labels
- [ ] Пишет mail_events в S3

---

## M1-9 Triage agent (rule-based MVP)

**Task:** Implement triage that creates proposals  
**AC:**
- [ ] По mail-events создаёт proposals в mail-proposals/
- [ ] Finance proposals только если смог извлечь amount/currency

---

## M2 Mail collector: allowlist по From

**Task:** Filter by MAIL_ALLOWED_FROM / MAIL_ALLOWED_FROM_REGEX / MAIL_ALLOWED_FROM_MODE  
**AC:**
- [ ] MAIL_ALLOWED_FROM=... → collector забирает только письма от этих адресов
- [ ] allowlist пуст и deny_all → ничего не собирает
- [ ] MAIL_ALLOWED_FROM_MODE=allow_all → собирает всё при пустом списке

---

## M2.1 UI allowlist + config-as-data

**Task:** Allowlist хранится в docs-store config/mail-allowlist; Portal UI редактирует; collector читает из S3  
**AC:**
- [ ] GET /v1/config/mail-allowlist возвращает latest allowlist (или defaults)
- [ ] POST /v1/config/mail-allowlist (x-api-key) сохраняет новую версию
- [ ] Страница /settings/mail-allowlist: режим, список email, regex, Save/Reload
- [ ] Collector при старте загружает allowlist из DOCS_BUCKET/docs-store/config/mail-allowlist/latest.json; env перебивает UI-конфиг
