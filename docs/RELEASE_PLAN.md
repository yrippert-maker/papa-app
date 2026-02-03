# Release Plan: v0.1.1 и v0.2.0

## v0.1.1 — Bugfix / Infra (после US-7, US-8)

**Цель:** завершить P1, снять операционные риски.

**Scope:**
- US-7: пагинация (API + минимум UI)
- US-8: SQLite safe mode (WAL, busy_timeout, retry)

**Release notes (шаблон):**
```
## v0.1.1 — P1 Completion

### Changes
- Pagination: limit/cursor на admin/users, tmc, files
- SQLite: WAL, busy_timeout, retry на SQLITE_BUSY
- UI: Load more на списке пользователей

### Upgrade
Без breaking changes. Опционально: использовать ?limit=&cursor= в API.
```

**Checklist:**
- [ ] US-7, US-8 приняты по PR_ACCEPTANCE_US7_US8.md
- [ ] `npm test` + `npm run test:e2e` зелёные
- [ ] Release notes обновлены
- [ ] `./scripts/create-release.sh owner/papa-app v0.1.1` (или вручную)

---

## v0.2.0 — P2-Core (Postgres + Storage)

**Цель:** масштабирование, надёжность.

**Scope:** см. [BACKLOG_P2_CORE.md](BACKLOG_P2_CORE.md)
- DB adapter (SQLite + Postgres)
- Object Storage (FS + S3)
- Health/readiness
- Backup strategy

**Release notes (шаблон):**
```
## v0.2.0 — P2-Core: Scalability

### Features
- PostgreSQL support (DB_PROVIDER=postgres, DATABASE_URL)
- S3-compatible storage (STORAGE_PROVIDER=s3)
- Health checks: /api/health, /api/health/ready
- Backup script и документация

### Breaking
- Новые env: DATABASE_URL, S3_* — см. env.example
- Миграция SQLite→Postgres: scripts/migrate-sqlite-to-postgres.mjs
- Миграция файлов: scripts/migrate-files-to-s3.mjs

### Upgrade
1. v0.1.1 → v0.2.0: см. docs/UPGRADE_V0.2.0.md
```

**Checklist:**
- [ ] Все US-P2 из BACKLOG_P2_CORE приняты
- [ ] Миграционные скрипты протестированы
- [ ] UPGRADE_V0.2.0.md создан
- [ ] Release notes

---

## Временная шкала (ориентир)

| Этап | Оценка | Релиз |
|------|--------|-------|
| US-7 + US-8 | 2–5 дней | v0.1.1 |
| P2-Core (US-P2-1 … US-P2-7) | 1–2 недели | v0.2.0 |
