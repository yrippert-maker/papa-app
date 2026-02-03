# Mail MVP — Техническое задание / План реализации

**Источники:** Gmail + mail.nic.ru (IMAP)  
**Оператор:** Portal (существующий)  
**Документы:** Финансы (реестр платежей) + Документация «Mura Menasa»

Универсальный план для разработки и аудитора.

---

# A) MVP scope (первая итерация)

## A1) Ingestion (миграция почты)

### 1. Коннектор Gmail

- **Режимы:** Gmail API (предпочтительно) или IMAP (если проще старт).
- **Забор:** письма из заданных label/папок (например `Migration/Inbound`, `Finance`, `Mura`).

### 2. Коннектор mail.nic.ru

- **IMAP:** INBOX + выбранные папки.

### 3. Дедупликация

- **Primary:** `Message-ID`.
- **Fallback:** `sha256(normalized_headers + normalized_body + attachment_hashes)`.

**Результат:** каждое письмо → `mail_event` → очередь triage.

---

## A2) AI triage + Human approval

AI-агент выполняет только:

- **Классификация:** `finance_payment` | `doc_mura_menasa` | `other`.
- **Extraction** (структурно).
- **Risk flags:** PII / legal / payment.
- **Proposal изменений** в документах как «черновик».

Оператор в Portal:

- видит карточку письма;
- кнопки: **Accept** / **Reject** / **Escalate** / **Request info**;
- при Accept: **Apply as draft** или **Apply immediately (safe rules only)**.

---

## A3) Document updates (минимально безопасно)

Для MVP — только два «пишущих» адаптера:

### Финансы

- Обновлять **единый реестр платежей** (структурный документ):
  - вариант: `docs/finance/payments.md` (Markdown);
  - предпочтительно: `docs/finance/payments.csv` или `payments.json` (машинная обработка).

### Документация «Mura Menasa»

- Обновлять документ(ы): `docs/mura-menasa/*.md` (или один `docs/mura-menasa.md`).
- Изменения через **patch/diff**, применяемые **после Accept**.

Если документы не в Git/Markdown: MVP возможен через **internal doc store** (файлы в object storage + versioning).

---

# B) Где живут документы (варианты)

| Вариант | Описание | Аудируемость | Сложность |
|--------|-----------|--------------|-----------|
| **1. Git/Markdown** | Документы — файлы в репо (`.md`/`.json`). AI делает PR/commit, оператор approves/merge. | Максимальная | Средняя |
| **2. Google Docs / Confluence** | Внешний сервис. AI — suggested edits, оператор подтверждает, применение через API. Хранить diff+snapshot. | Средняя | Высокая |
| **3. Portal-хранилище** | Файлы в S3/GCS с versioning. Portal показывает версии, AI пишет новую версию после Accept. | Хорошая | Низкая |

**Рекомендация для MVP:** **(3)** или **(1)**. (1) — лучше для DD/аудита; (3) — быстрее при отсутствии процесса PR.

---

# C) Data contracts

## C1) `mail_event.json`

```json
{
  "version": 1,
  "mail_id": "uuid",
  "source": { "system": "gmail|imap", "mailbox": "string", "uid": "string" },
  "message_id": "<rfc822-message-id>",
  "thread_id": "optional",
  "received_at": "ISO8601",
  "from": "name <email>",
  "to": ["..."],
  "cc": ["..."],
  "subject": "string",
  "body_text": "normalized text",
  "attachments": [
    { "filename": "x.pdf", "mime": "application/pdf", "size": 123, "sha256": "..." }
  ],
  "integrity": {
    "sha256_normalized": "..."
  }
}
```

## C2) `triage_result.json`

```json
{
  "version": 1,
  "mail_id": "uuid",
  "category": "finance_payment|doc_mura_menasa|other",
  "confidence": 0.0,
  "summary": "short",
  "risk_flags": ["payment", "pii"],
  "entities": {
    "payment": {
      "amount": 123.45,
      "currency": "RUB",
      "date": "YYYY-MM-DD",
      "counterparty": "string",
      "invoice": "string|null",
      "bank_ref": "string|null"
    }
  },
  "suggested_operator": "ops-finance|docs-owner",
  "proposed_changes": [
    {
      "target": "finance_payments_register|mura_menasa_doc",
      "mode": "append|patch",
      "patch": "unified diff OR structured patch",
      "explanation": "why"
    }
  ]
}
```

## C3) `operator_decision.json`

```json
{
  "version": 1,
  "mail_id": "uuid",
  "operator_id": "string",
  "decision": "accept|reject|escalate|request_info",
  "reason": "string|null",
  "apply_mode": "draft|safe_auto|manual",
  "at": "ISO8601"
}
```

---

# D) Policy / Safety rules

## D1) Safe auto-apply (MVP)

Разрешаем **автоматически** только:

- **Finance register:** добавление новой строки (append), без редактирования истории.
- **Mura menasa:** добавление в секцию «Incoming updates» как draft (append), без изменения существующих параграфов.

Любые «edit existing paragraphs» → только **draft** или **manual apply**.

## D2) Redaction / PII

- В UI оператору показывать письмо полностью.
- В AI передаём `body_text`, но:
  - маскируем номера карт/паспортов/телефоны (regex);
  - вложения (PDF/сканы) в AI **не отправляем**, только метаданные + хеш.

---

# E) Portal UX (минимальные страницы)

1. **/mail/inbox** — очередь писем  
   - Фильтры: source (gmail/nic), category, risk, status (new/accepted/rejected).  
   - Карточка: summary, category, извлечённые поля платежа, suggested changes.  
   - Кнопки: Accept / Reject / Escalate.

2. **/mail/:mail_id** — детальный просмотр  
   - Raw headers + body.  
   - Proposed diff preview.  
   - Decision history.  
   - Выбор apply mode.

3. **/documents/finance** и **/documents/mura-menasa**  
   - Текущая версия + changelog.  
   - «Changes pending» (drafts).

---

# F) Evidence / Compliance

Встраиваем в существующую схему (pack hash/sign, ledger, rollups, anchoring, portal):

- **mail_event** и **operator_decision** — записи в ledger (или отдельный префикс `mail-ledger/…`).
- Ежедневный rollup для mail-events (тот же домен или отдельный `mail-rollup`).

**Definition of done для комплаенса:**

- Любое письмо → immutable запись (hash) + решение оператора + применённые правки + ссылка на версии документов.

---

# G) План внедрения

| Sprint | Содержание |
|--------|------------|
| **M1** | Ingestion + Triage + Portal approval: коннектор Gmail + IMAP nic.ru; хранение `mail_event` (object storage) + ledger; AI triage (category + extraction); Portal: inbox + approve. |
| **M2** | Finance register auto-append: структура register (md/csv/json); генерация append patch; apply после Accept (safe_auto). |
| **M3** | Mura menasa docs (draft workflow): предложенные правки как draft sections; оператор: apply/merge drafts. |

---

# H) Раздел документации «Mura Menasa»

Для MVP — один «root doc» с возможностью дополнять секциями:

- **Путь:** `docs/mura-menasa/index.md` (и при необходимости другие `docs/mura-menasa/*.md`).

---

# Итог

- **Источники:** Gmail (API/IMAP) + mail.nic.ru (IMAP).  
- **Поток:** mail_event → triage → operator decision → apply (draft/safe_auto/manual).  
- **Документы:** реестр платежей (finance) + Mura Menasa (draft/append).  
- **Compliance:** mail_event + operator_decision в ledger; rollup по необходимости.

Документ готов к передаче разработке и аудитору.
