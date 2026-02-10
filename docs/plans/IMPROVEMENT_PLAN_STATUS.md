# План улучшений ПАПА — статус

Источник: ПАПА_План_улучшений_v1.0.docx (8 февраля 2026)

## S1 — Фундамент (выполнено)

### Хуки
| # | Задача | Статус | Файл |
|---|--------|--------|------|
| H1 | usePermissions | ✅ | `hooks/usePermissions.ts` |
| H2 | useApiQuery | ✅ | `hooks/useApiQuery.ts` |
| H3 | useApiMutation | ✅ | `hooks/useApiMutation.ts` |

### UI-компоненты
| # | Задача | Статус | Файл |
|---|--------|--------|------|
| C1 | DataTable | ✅ | `components/ui/DataTable.tsx` |
| C2 | StatusBadge | ✅ | `components/ui/StatusBadge.tsx` |
| C3 | EmptyState | ✅ | `components/ui/EmptyState.tsx` |
| C4 | LoadingOverlay / Skeleton | ✅ | `components/ui/LoadingOverlay.tsx`, `Skeleton.tsx` |
| C5 | PageShell | ✅ | `components/ui/PageShell.tsx` |

## S2 (выполнено)

| # | Задача | Статус | Файл |
|---|--------|--------|------|
| C6 | ConfirmDialog | ✅ | `components/ui/ConfirmDialog.tsx` |
| C7 | FilterPanel | ✅ | `components/ui/FilterPanel.tsx` |
| C8 | FormField | ✅ | `components/ui/FormField.tsx` |
| C9 | ActionDropdown | ✅ | `components/ui/ActionDropdown.tsx` |
| H4 | usePagination | ✅ | `hooks/usePagination.ts` |
| H5 | useAuditTrail | ✅ | `hooks/useAuditTrail.ts` |
| H6 | useDebounce | ✅ | `hooks/useDebounce.ts` |
| H7 | useLocalStorage | ✅ | `hooks/useLocalStorage.ts` |
| A1–A3 | OpenAPI spec + generator | ✅ | `lib/openapi/`, `scripts/generate-openapi.mjs` |
| T1–T5 | Unit tests | ✅ | `__tests__/lib/sql-utils.test.ts`, `StatusBadge`, `EmptyState`, `retention-service` |

## S3 (частично)

| # | Задача | Статус | Файл |
|---|--------|--------|------|
| E1 | Crash reporting | ✅ | `electron/main.js` (crashReporter.start) |
| E2 | Auto-update UI | ✅ | `components/electron/UpdateBanner.tsx`, preload IPC |
| E4 | Native menus | ✅ | `electron/main.js` (Menu.buildFromTemplate) |

## S4 (выполнено)

| # | Задача | Статус | Файл |
|---|--------|--------|------|
| E3 | Deep linking (papa://) | ✅ | `electron/main.js` |
| E5 | Tray icon | ✅ | `electron/main.js` |
| E6 | Window state persistence | ✅ | `electron/main.js` |
| C10 | Tabs | ✅ | `components/ui/Tabs.tsx` |
| C11 | Toast/Notification | ✅ | `components/ui/Toast.tsx` |
| A4 | Swagger UI page | ✅ | `app/api-docs/page.tsx` |
| M1–M3 | packages/shared-types | ✅ | `packages/shared-types/` |

## C12, A5–A6, M4–M6 (выполнено)

| # | Задача | Статус |
|---|--------|--------|
| C12 | Рефакторинг settings | ✅ EmailSourcesSection, RegulatorySourcesSection, AccessSection, UpdatesSection, Tabs |
| A5 | Аннотация routes | ✅ compliance/monitor, inspection/cards, mail/inbox, anchoring/health в spec |
| M4–M6 | shared-types в auditor-portal | ✅ @papa/shared-types, MailDetailPage использует DocId |

## Дальнейшие шаги

- Расширение OpenAPI на остальные routes (agent, tmc, proof)
- npm run openapi:validate (spectral/ajv) — опционально

## Использование

```tsx
// Хуки
import { usePermissions, useApiQuery, useApiMutation } from '@/hooks';

// Компоненты
import { DataTable, StatusBadge, EmptyState, LoadingOverlay, Skeleton, PageShell, ConfirmDialog, FormField } from '@/components/ui';
```
