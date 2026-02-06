# ПАПА — Программа автоматизации производственной аналитики

> Local-first система для управления производственными процессами, ТМЦ и документацией.

[![CI](https://github.com/YOUR_USERNAME/papa-app/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/papa-app/actions/workflows/ci.yml)  
<!-- Замените YOUR_USERNAME на ваш GitHub username -->

## Возможности

- **Дашборд** — обзор workspace, БД, файлов и ledger
- **ТМЦ** — реестр номенклатуры, остатки, лоты, входящие/исходящие заявки
- **Workspace** — просмотр файловой структуры
- **AI Inbox** — загрузка документов
- **RBAC** — роли (admin, manager, storekeeper, engineer, auditor), policy layer

## Быстрый старт

```bash
npm install
cp env.example .env.local
npm run migrate
npm run seed:admin
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000). Вход: **admin@local** / **admin**.

## Требования

- Node.js 20+
- `NEXTAUTH_SECRET` в production: `openssl rand -base64 32`

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev` | Запуск dev-сервера |
| `npm run build` | Production сборка |
| `npm start` | Запуск production |
| `npm test` | Unit-тесты |
| `npm run test:e2e` | E2E smoke (build + migrate + seed + start) |
| `npm run migrate` | Применить миграции БД |
| `npm run seed:admin` | Создать первого admin (SQLite) |
| `npm run db:seed` | Prisma seed (Postgres) |
| `npm run db:seed:supabase` | Seed для Supabase/облака (TLS workaround) |

## БД: seed и TLS (Supabase / облачный Postgres)

При `self-signed certificate in certificate chain`:
- **Безопасно:** `NODE_EXTRA_CA_CERTS=/path/to/ca.pem npm run db:seed`
- **Fallback:** `npm run db:seed:supabase` — отключает TLS-валидацию **для всего процесса**; только локально, не в проде

Подробнее: [docs/ops/DB_SEED_TLS.md](docs/ops/DB_SEED_TLS.md)

## Документация

| Документ | Описание |
|----------|----------|
| [docs/ARCHITECTURE_OVERVIEW.md](docs/ARCHITECTURE_OVERVIEW.md) | Архитектура, ADR-lite, scalability |
| [docs/BACKLOG_P1.md](docs/BACKLOG_P1.md) | Backlog P1, User Stories |
| [docs/SECURITY_POSTURE.md](docs/SECURITY_POSTURE.md) | Безопасность, production checklist |
| [docs/ASSURANCE.md](docs/ASSURANCE.md) | Security & Compliance Assurance (auditor pack, attestation, disclosure) |
| [docs/OPS_AUDIT_CHECKLIST_ANCHORING.md](docs/OPS_AUDIT_CHECKLIST_ANCHORING.md) | **Anchoring audit & verification** — start here; auditor pack, CI gate |
| [docs/AUDIT_ATTESTATION.md](docs/AUDIT_ATTESTATION.md) | Audit attestation (anchoring governance) — ready for SOC/ISO |
| [docs/SOX_MAPPING.md](docs/SOX_MAPPING.md) | SOX 404 ITGC mapping |
| [docs/ISO27001_MAPPING.md](docs/ISO27001_MAPPING.md) | ISO 27001 controls mapping |
| [docs/DOMAIN_ROLLOUT_PLAYBOOK.md](docs/DOMAIN_ROLLOUT_PLAYBOOK.md) | Domain rollout playbook — audit-ready template |
| [docs/DEMO_TABLE_M1_M2.md](docs/DEMO_TABLE_M1_M2.md) | M1/M2 acceptance |
| [docs/BRANCHING_STRATEGY.md](docs/BRANCHING_STRATEGY.md) | Ветки, feature flow |
| [docs/GITHUB_ISSUES_P1.md](docs/GITHUB_ISSUES_P1.md) | Issues из backlog |
| [docs/GITHUB_SETUP.md](docs/GITHUB_SETUP.md) | Настройка после push |
| [docs/GITHUB_PROJECT_BOARD.md](docs/GITHUB_PROJECT_BOARD.md) | Project board P1/P2 |
| [docs/US5_ADMIN_UI_DESIGN.md](docs/US5_ADMIN_UI_DESIGN.md) | Admin UI (US-5) UX design |
| [docs/RELEASE_CHECKLIST_V0.1.0.md](docs/RELEASE_CHECKLIST_V0.1.0.md) | Checklist перед v0.1.0 |
| [docs/PR_HARDENING_V0.1.0.md](docs/PR_HARDENING_V0.1.0.md) | Hardening перед релизом |
| [docs/PR_ACCEPTANCE_US7_US8.md](docs/PR_ACCEPTANCE_US7_US8.md) | Ревью/приёмка US-7, US-8 |
| [docs/US7_US8_SUBTASKS.md](docs/US7_US8_SUBTASKS.md) | Подзадачи US-7/US-8 с timebox |
| [docs/BACKLOG_P2_CORE.md](docs/BACKLOG_P2_CORE.md) | P2-Core: Postgres + Storage |
| [docs/ADR-002_SQLite_to_PostgreSQL.md](docs/ADR-002_SQLite_to_PostgreSQL.md) | ADR: миграция на Postgres |
| [docs/RELEASE_PLAN.md](docs/RELEASE_PLAN.md) | План v0.1.1 и v0.2.0 |
| [docs/ADR-003_Adapter_Contracts.md](docs/ADR-003_Adapter_Contracts.md) | Контракты DB/Storage адаптеров |
| [docs/P2_CORE_PREREVIEW.md](docs/P2_CORE_PREREVIEW.md) | P2-Core: что нельзя делать |
| [docs/MIGRATION_RISKS.md](docs/MIGRATION_RISKS.md) | Риски миграции SQLite→Postgres, Files→S3 |
| [docs/ADR-004_Dialect_Handling.md](docs/ADR-004_Dialect_Handling.md) | ADR: dialect/capabilities |
| [docs/PR_ACCEPTANCE_P2_CORE.md](docs/PR_ACCEPTANCE_P2_CORE.md) | Ревью/приёмка P2-Core |
| [docs/RESPONSIBILITY_MATRIX.md](docs/RESPONSIBILITY_MATRIX.md) | Матрица ответственности (роли, запреты, аудит) |
| [docs/REGULATOR_PACKAGE.md](docs/REGULATOR_PACKAGE.md) | Пакет для регулятора и руководства (включая SQLite Safe Mode) |
| [docs/ENDPOINT_DB_EVIDENCE.md](docs/ENDPOINT_DB_EVIDENCE.md) | Endpoint→DB mode→роль→evidence (регуляторный артефакт) |
| [docs/RELEASE_NOTES_v0.1.1.md](docs/RELEASE_NOTES_v0.1.1.md) | Release notes v0.1.1 |
| [docs/RELEASE_GUIDE_v0.1.1.md](docs/RELEASE_GUIDE_v0.1.1.md) | Release guide: gate, tag, push, post-release |
| [docs/AUDIT_LOG_SCHEMA.md](docs/AUDIT_LOG_SCHEMA.md) | Audit Log schema (SQLite/WAL) |
| [docs/REGULATORY_BUNDLE_MANIFEST.md](docs/REGULATORY_BUNDLE_MANIFEST.md) | Regulatory bundle manifest |
| [env.example](env.example) | Переменные окружения |

## Технологии

- Next.js 14, React 18
- NextAuth (credentials, JWT)
- better-sqlite3
- Tailwind CSS
- zod

## Лицензия

Proprietary / MIT — уточните при публикации.

---

**Production:** см. [docs/SECURITY_POSTURE.md](docs/SECURITY_POSTURE.md) — обязательные настройки перед деплоем.
