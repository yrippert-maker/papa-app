# ПАПА — Архитектура

## Обзор

ПАПА (Программа автоматизации производственной аналитики) — local-first система для управления производственными процессами, ТМЦ и документацией.

## Структура монорепо

```
papa-app/
├── app/                 # Next.js App Router (web)
├── components/          # React UI-компоненты
├── hooks/               # Кастомные хуки (usePermissions, useApiQuery, …)
├── lib/                 # Бизнес-логика, сервисы
├── packages/
│   └── shared-types/    # @papa/shared-types — общие типы
├── apps/
│   └── auditor-portal/  # Vite SPA (auditor UI)
├── services/            # Внешние сервисы (auditor-portal-api)
├── electron/            # Desktop-обёртка (Electron)
└── __tests__/           # Jest + Playwright тесты
```

## npm workspaces

- `packages/*` — shared packages (shared-types)
- `apps/*` — приложения (auditor-portal)

Команды:
- `npm run build:shared-types` — сборка shared-types
- `npm run check:root` — lint, typecheck, build основного приложения
- `npm run check:portal` — сборка auditor-portal

## Ключевые модули

| Модуль | Назначение |
|--------|------------|
| lib/authz | RBAC, permissions |
| lib/governance-policy-service | N-of-M approval |
| lib/key-lifecycle-service | 2-man rule, ротация ключей |
| lib/audit-pack-service | Генерация audit bundles |
| lib/attestation-service | Подписанные attestations |
| lib/anomaly-detection-service | STRIDE, аномалии |

## API

- OpenAPI 3.1 spec: `public/openapi.json`
- Swagger UI: `/api-docs` (RBAC: COMPLIANCE.VIEW | ADMIN)
- Генерация: `npm run openapi:generate`

## Electron

- Deep linking: `papa://path`
- Auto-update: IPC + UpdateBanner
- Tray icon, native menus, window state persistence
