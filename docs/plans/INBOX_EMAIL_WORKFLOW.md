# Inbox Email Workflow — контур писем info@2rh.org

**Цель:** сбор → анализ → review packet → approve → изменение документации (с датой внесения).

---

## 1. Allowlist отправителей (стартовый)

| Домен | Источник (label) |
|-------|------------------|
| @mak.ru | ARMAK |
| @klimov.ru | UDK_Klimov |
| @ao-star.ru | UDK_Star |

---

## 2. Структура папок

```
.../БАЗА/menasa/руководства/регуляторика/INBOX/
  ARMAK/
  UDK_Klimov/
  UDK_Star/

.../БАЗА/menasa/выгрузки/INBOX_UPDATES/YYYY-MM/
  <source>/
    review_packet/
    approved_patch/
    raw_email/
      .eml
      attachments/
```

---

## 3. Security guardrail

- **DMARC pass** (или DKIM pass + aligned domain) — обязательно для авто-анализа
- Без проверки → сохраняем как "untrusted", только ручная обработка

---

## 4. Workflow

| Этап | Действие |
|------|-----------|
| Ingest | Чтение info@2rh.org, фильтр allowlist, сохранение EML + вложений |
| Analyze | Извлечение требований, затрагиваемых доков, draft patch, EvidenceMap |
| Approve | Оператор: Approve & Apply / Reject / Request Clarification |
| Apply | Только после Approve: новая версия, дата внесения, sha256, audit log |

**Правило:** Auto-analyze допустим, но **Apply только после ручного Approve**.

---

## 5. UI: кнопка «Настройки источников»

Таблица:
- Enabled, Тип (Domain/Email), Значение, Источник (label)
- Правило доверия: только DMARC pass
- Действие: Auto-collect / Auto-analyze / Require approval (всегда ON для Apply)
- Последняя активность

---

## 6. Платформа почты

**IMAP** — mail.nic.ru (уже поддерживается в mail-collector.mjs через imapflow).

```env
MAIL_IMAP_ENABLED=1
MAIL_IMAP_HOST=mail.nic.ru
MAIL_IMAP_PORT=993
MAIL_IMAP_USER=info@2rh.org
MAIL_IMAP_PASSWORD=...
MAIL_IMAP_FOLDERS=INBOX
```
