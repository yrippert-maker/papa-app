# Mail MVP — Sprint M1: Ingestion + Triage + Portal approval

Цель: коннекторы почты, хранение `mail_event`, AI triage, очередь в Portal и принятие решений оператором.

Спецификация: [MAIL_MVP_SPEC.md](./MAIL_MVP_SPEC.md).

---

## Результаты спринта

- Письма из Gmail и mail.nic.ru (IMAP) попадают в систему как `mail_event`.
- Дедупликация по Message-ID / sha256(normalized).
- Каждый `mail_event` сохраняется в object storage и получает запись в ledger (или `mail-ledger/`).
- AI triage: категория (`finance_payment` | `doc_mura_menasa` | `other`), извлечение сущностей, risk flags, предложенные правки (черновик).
- Portal: очередь писем (`/mail/inbox`), детальный просмотр (`/mail/:mail_id`), кнопки Accept / Reject / Escalate / Request info; при Accept — выбор apply mode (draft / safe_auto / manual).

---

## Задачи (checklist для разработки)

### 1. Контракты и типы

- [ ] **C1** Типы/схемы по спецификации:
  - `mail_event` (version, mail_id, source, message_id, received_at, from, to, cc, subject, body_text, attachments, integrity)
  - `triage_result` (mail_id, category, confidence, summary, risk_flags, entities, suggested_operator, proposed_changes)
  - `operator_decision` (mail_id, operator_id, decision, reason, apply_mode, at)
- [ ] Размещение: `types/mail-mvp.ts` и/или JSON Schema в `schemas/mail/` для валидации.

### 2. Ingestion

- [ ] Скрипт-точка входа: `npm run mail:ingest` → `scripts/mail-ingest.mjs` (аргументы: `--source gmail|imap|all`, `--dry-run`).
- [ ] **Gmail:** коннектор (Gmail API предпочтительно, или IMAP fallback). Забор из заданных label/папок (напр. `Migration/Inbound`, `Finance`, `Mura`).
- [ ] **mail.nic.ru:** IMAP-коннектор, INBOX + выбранные папки.
- [ ] Дедупликация: primary `Message-ID`, fallback `sha256(normalized_headers + normalized_body + attachment_hashes)`.
- [ ] Скрипт/сервис: чтение почты → формирование `mail_event` → сохранение в object storage (S3/GCS) по ключу вида `mail-events/YYYY/MM/DD/<mail_id>.json`.
- [ ] Запись в ledger: каждая новая запись `mail_event` → ledger (или префикс `mail-ledger/...`) для compliance.

### 3. AI Triage

- [ ] Сервис/скрипт: на входе `mail_event`, на выходе `triage_result`.
- [ ] Классификация: `finance_payment` | `doc_mura_menasa` | `other`.
- [ ] Extraction: структурированные поля (для платежей: amount, currency, date, counterparty, invoice, bank_ref).
- [ ] Risk flags: PII, legal, payment.
- [ ] Предложенные изменения: `proposed_changes[]` (target, mode, patch, explanation).
- [ ] PII: в AI передавать только маскированный `body_text`; вложения — только метаданные + hash (D2).

### 4. Хранение triage и решений

- [ ] Сохранение `triage_result` рядом с `mail_event` или в отдельном префиксе (напр. `mail-triage/<mail_id>.json`).
- [ ] При решении оператора: сохранение `operator_decision` и запись в ledger (evidence).

### 5. API

- [ ] `GET /api/mail/inbox` — список писем (фильтры: source, category, risk, status). Возврат: массив с summary, category, extracted payment, suggested changes, status.
- [ ] `GET /api/mail/:mail_id` — детали письма: raw headers/body, triage_result, decision history.
- [ ] `POST /api/mail/:mail_id/decision` — тело: `{ decision, reason?, apply_mode? }`. Обновление статуса и запись `operator_decision`.

### 6. Portal UX

- [ ] **/mail/inbox:** таблица/карточки, фильтры (source, category, risk, status), кнопки Accept / Reject / Escalate.
- [ ] **/mail/:mail_id:** полный просмотр письма, proposed diff preview, decision history, выбор apply mode при Accept.

### 7. Compliance

- [ ] `mail_event` и `operator_decision` — записи в ledger (или `mail-ledger/`).
- [ ] Определить: ежедневный rollup для mail-events в существующем домене или отдельный `mail-rollup`.

---

## Зависимости

- Object storage (S3/GCS) для `mail_event` и при необходимости `triage_result`.
- Ledger (текущий или отдельный бакет/префикс) для evidence.
- Учётные данные: Gmail (OAuth2 / service account или IMAP), mail.nic.ru (IMAP).
- AI: вызов модели для классификации и извлечения (внутренний API или LLM).

---

## Критерии приёмки M1

1. Письмо из Gmail или nic.ru появляется в системе как `mail_event` и в очереди Portal.
2. По каждому письму есть triage (категория, сущности, risk, proposed_changes).
3. Оператор видит очередь и детали, может принять/отклонить/эскалировать; при Accept выбирает apply mode.
4. Каждое письмо и решение оператора имеют immutable запись (hash) в ledger.

После M1 применение правок к документам (Finance register, Mura Menasa) — в Sprints M2 и M3.
