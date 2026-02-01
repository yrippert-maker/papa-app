#!/bin/bash
# Создание GitHub Issues из BACKLOG_P1 (US-5, US-6, US-7, US-8)
# Требуется: gh cli (gh auth login)
# Использование: ./scripts/create-github-issues.sh [owner/repo]

REPO="${1:-YOUR_USERNAME/papa-app}"

gh issue create --repo "$REPO" --title "feat(auth): US-5 Admin UI для управления пользователями" --label "enhancement,P1" --body "## Scope
- Страница «Users» (только admin): создать, назначить роль, сбросить пароль
- Можно без сложного UI, важна функциональность

## Acceptance criteria
- [ ] Доступ только при admin:manageUsers
- [ ] Операции логируются (кто сделал, кого изменили)

## Ссылки
- docs/BACKLOG_P1.md — US-5"

gh issue create --repo "$REPO" --title "docs: US-6 ADR OAuth/SSO (опционально)" --label "documentation,P1,optional" --body "## Scope
- Исследовать провайдера (Google/Microsoft/Keycloak)
- Короткий ADR: Credentials vs OAuth
- Без внедрения в код

## Acceptance criteria
- [ ] ADR: рекомендация и шаги при необходимости OAuth"

gh issue create --repo "$REPO" --title "feat(api): US-7 Пагинация API" --label "enhancement,P1" --body "## Scope
- limit, cursor/offset, сортировка
- Max limit enforced сервером
- UI: пагинация на ТМЦ, files

## Acceptance criteria
- [ ] Лимиты enforced
- [ ] Тесты: max limit, next page"

gh issue create --repo "$REPO" --title "fix(db): US-8 SQLite safe mode" --label "enhancement,P1" --body "## Scope
- Retry/backoff при SQLITE_BUSY
- Короткие транзакции

## Acceptance criteria
- [ ] Нет долгих write-транзакций
- [ ] При SQLITE_BUSY — retry или 503/409"

echo "Issues created. Check: https://github.com/$REPO/issues"
