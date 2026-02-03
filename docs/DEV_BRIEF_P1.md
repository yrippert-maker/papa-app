# Вводный бриф: Этап P1 (масштабирование до 30+ пользователей)

**Время чтения:** ~30 минут  
**Цель:** быстрый вход в контекст без перелопачивания 10 документов.

---

## 1. Что делаем и зачем

Переводим papa-app из **single-user** в **многопользовательскую систему с ролями**:

- Пользователи в БД (не env)
- RBAC — проверка прав на каждом API
- Единый policy layer (никаких «ручных if» в endpoint’ах)
- Пагинация и стабильность SQLite при росте данных

**Не делаем:** облако, PostgreSQL, S3, blockchain, AI — это отдельные этапы.

---

## 2. Где что лежит

| Документ | Зачем |
|----------|-------|
| **ARCHITECTURE_OVERVIEW.md** | As-is архитектура, ограничения, scalability envelope, risk register |
| **BACKLOG_P1.md** | Задачи (US-1 … US-8), acceptance criteria, зависимости |
| **AUDIT_REPORT.md** | Что уже закрыто по безопасности |
| **SECURITY_POSTURE.md** | Checklist перед релизом, условия production |

---

## 3. Ключевые решения (не менять без ADR)

- **Modular monolith** — не микросервисы
- **RBAC** — роли уже в схеме БД (`rbac_role`, `rbac_role_permission`), нужно подключить
- **Hash-chain** для ledger — не blockchain
- **Policy layer** — одна точка проверки прав, все API через неё
- **401 vs 403** — не залогинен / нет прав; разводить явно

---

## 4. Порядок работ (строго)

```
US-1 (users, миграции, сид ролей)
  → US-2 (policy layer lib/authz)
  → US-3 (RBAC на API, e2e 403)
  → US-4 (credentials из users table)
  → US-5 (Admin UI Users)
  → US-7 (пагинация)
  → US-8 (SQLite safe mode)
```

US-6 (ADR OAuth) — параллельно/после, без кода.

---

## 5. Definition of Done (инварианты)

- Unit + e2e (включая 403) проходят
- Миграции up/down, нет plaintext паролей
- Все защищённые API через policy layer
- 401 ≠ 403
- Code review: нет ручных проверок прав в endpoint’ах

---

## 6. Контрольные точки

| Milestone | Критерий | Блокер? |
|-----------|----------|---------|
| **M1** | Policy layer + 401/403 работают на API | Да — дальше нельзя без этого |
| **M2** | Логин через users table (не env) | Да |
| **M3** | e2e проходит для разных ролей | Да |

Если M1 не получается — стоп, архитектурный сигнал.

---

## 7. Чеклист приёмки P1 (для PR / ревью)

- [ ] Есть users в БД, не только admin
- [ ] Любой endpoint защищён через policy layer
- [ ] Нельзя «случайно» дать доступ через if в коде
- [ ] 401 ≠ 403 в ответах
- [ ] e2e ловит отсутствие прав
- [ ] Документация обновлена

---

## 8. Технический контекст

- **Auth:** NextAuth Credentials, JWT в cookie
- **БД:** better-sqlite3, один файл `papa.sqlite`
- **Роли в схеме:** `rbac_role`, `rbac_permission`, `rbac_role_permission` — используются только в сиде
- **Сейчас:** `authorize()` проверяет `AUTH_USER`/`AUTH_PASSWORD` из env; возвращает фиксированный user
- **Нужно:** `authorize()` — select из `users` по email, проверка bcrypt; session — user id + role

---

## 9. Правила этапа

- **ADR:** изменения policy / auth / storage — только через ADR (шаблон в docs)
- **Демо:** сценарии M1–M3 в [DEMO_SCENARIOS_M1_M3.md](DEMO_SCENARIOS_M1_M3.md)
- **Владелец архитектуры:** назначен на P1, участвует в review

Подробно: [P1_RULES.md](P1_RULES.md)

---

## 10. Контакты и вопросы

При сомнениях по архитектуре — сверяться с ARCHITECTURE_OVERVIEW и BACKLOG_P1.  
Новые решения — фиксировать в ADR (кратко: контекст, решение, альтернативы).
