# GitHub Issues — из BACKLOG_P1

Скопируйте содержимое каждого блока в новое Issue на GitHub.

---

## Issue: US-5 Admin UI для управления пользователями

**Title:** `feat(auth): US-5 Admin UI для управления пользователями`

**Labels:** `enhancement`, `P1`

**Body:**

```markdown
## Scope

- Страница «Users» (только admin): создать, назначить роль, сбросить пароль
- Можно без сложного UI, важна функциональность

## Acceptance criteria

- [ ] Доступ только при `admin:manageUsers`
- [ ] Операции логируются (кто сделал, кого изменили)

## Технические заметки

- Добавить `audit_log` или использовать ledger для sensitive actions
- Сброс пароля: генерация временного или reset token (email — опционально позже)

## Ссылки

- [BACKLOG_P1.md — US-5](BACKLOG_P1.md)
- [DEV_BRIEF_P1.md](DEV_BRIEF_P1.md)
```

---

## Issue: US-6 OAuth/SSO — ADR (опционально)

**Title:** `docs: US-6 ADR OAuth/SSO`

**Labels:** `documentation`, `P1`, `optional`

**Body:**

```markdown
## Scope

- Исследовать провайдера (Google/Microsoft/Keycloak)
- Короткий ADR: Credentials vs OAuth для контекста papa-app
- Без внедрения в код

## Acceptance criteria

- [ ] ADR: рекомендация и шаги при необходимости OAuth

## Ссылки

- [BACKLOG_P1.md — US-6](BACKLOG_P1.md)
```

---

## Issue: US-7 Пагинация API

**Title:** `feat(api): US-7 Пагинация /api/files/list и TMC API`

**Labels:** `enhancement`, `P1`

**Body:**

```markdown
## Scope

- `limit`, `cursor`/`offset`, сортировка
- Max limit (например, 100/200) enforced сервером
- UI: пагинация / «Load more» на страницах ТМЦ, files

## Acceptance criteria

- [ ] Лимиты enforced сервером
- [ ] Тесты: max limit, next page, invalid cursor

## Endpoints

- `/api/files/list`
- `/api/tmc/items`
- `/api/tmc/lots`
- `/api/tmc/requests`

## Технические заметки

- Cursor-based предпочтительнее offset при больших объёмах

## Ссылки

- [BACKLOG_P1.md — US-7](BACKLOG_P1.md)
```

---

## Issue: US-8 SQLite safe mode

**Title:** `fix(db): US-8 Конкурентные записи (SQLite safe mode)`

**Labels:** `enhancement`, `P1`

**Body:**

```markdown
## Scope

- Единый транзакционный путь для записи
- Retry/backoff при SQLITE_BUSY (если актуально)
- Короткие транзакции

## Acceptance criteria

- [ ] Нет долгих write-транзакций
- [ ] При SQLITE_BUSY — retry или понятная 503/409

## Технические заметки

- better-sqlite3: `db.pragma('busy_timeout', 5000)` или явный retry в lib/db
- Транзакции: `BEGIN; ... COMMIT` в одном блоке

## Ссылки

- [BACKLOG_P1.md — US-8](BACKLOG_P1.md)
```

---

## Создание Issues через GitHub CLI

```bash
# Установить gh: https://cli.github.com/
gh auth login

# Создать issue (заменить REPO на your-username/papa-app)
gh issue create --repo REPO --title "feat(auth): US-5 Admin UI" --body-file - <<'EOF'
... вставить body из блока выше ...
EOF
```

Или создать все разом:

```bash
chmod +x scripts/create-github-issues.sh
./scripts/create-github-issues.sh your-username/papa-app
```
