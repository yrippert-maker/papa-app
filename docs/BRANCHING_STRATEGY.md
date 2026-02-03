# Branching Strategy — P1/P2

## Основные ветки

| Ветка | Назначение |
|-------|------------|
| `main` | Production-ready код. CI проходит. |
| `develop` | Интеграционная ветка для P1/P2. (опционально) |

## Рекомендуемый поток для P1

### Feature branches

```
main ──► feature/US-5-admin-ui ──► PR ──► main
main ──► feature/US-7-pagination ──► PR ──► main
main ──► feature/US-8-sqlite-safe ──► PR ──► main
```

**Именование:** `feature/US-{N}-{slug}` или `fix/{описание}`

### Workflow

1. От `main` создать `feature/US-5-admin-ui`
2. Разработка, коммиты с префиксом `feat(auth):`, `fix(api):`
3. Push, открыть PR в `main`
4. CI должен проходить (lint, test, build, e2e)
5. Code review, merge в `main`

## Рекомендуемый поток для P2

При переходе к P2 (масштабирование, облако):

```
main ──► develop (P2 integration)
         ├── feature/postgres-migration
         ├── feature/s3-storage
         └── feature/...
```

Или по-прежнему feature branches от `main`, если команда малая.

## Защита веток (GitHub Settings)

- `main`: require status checks (CI), require pull request
- Опционально: require review, restrict push

## Конвенция коммитов

```
feat(auth): add admin UI for users
feat(rbac): enforce permissions in UI
feat(api): add pagination to files
fix(db): sqlite busy_timeout
docs(p1): update demo table
chore(ci): add E2E_MODE to workflow
```
