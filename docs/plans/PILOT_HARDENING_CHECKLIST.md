# Pilot Hardening Checklist — перед демо

**Цель:** никаких 500 и красной консоли. «Не ломаем доверие».

---

## 0. Версии для пилота (зафиксировать)

| Компонент | Версия |
|-----------|--------|
| Node | 20.x (рекомендуется) или 22.x |
| Next.js | 14.2.35 |

Плавающие версии = плавающие чанки. Не обновлять перед демо.

---

## 1. API — никогда не 500 (safe defaults)

| Endpoint | При ошибке | Поведение |
|----------|------------|-----------|
| `/api/workspace/status` | БД недоступна, таблицы отсутствуют | 200 + `ok: false`, `warning`, `error_code` |
| `/api/anchoring/health` | Таблицы нет, сервис не настроен | 200 + `status: 'UNAVAILABLE'` |
| `/api/agent/search` | Индекс не построен | 200 + `results: []`, `warning` |
| `/api/agent/draft` | Ошибка обогащения evidence | 200 + evidence без snippet |
| `/api/agent/export` | Черновик не confirmed | 400 (ожидаемо) |

**Правило:** 500 — только для production misconfiguration (default admin password).

---

## 2. Фичи, отключаемые флагом (для демо)

| Фича | Флаг / условие | Пилот |
|------|----------------|-------|
| Anchoring health | Нет таблицы `ledger_anchors` | Показывать «UNAVAILABLE», не падать |
| Workspace status | Нет БД / не migrate | Показывать `warning`, не 500 |
| Agent pgvector | `DATABASE_URL` + `docs:index:agent` | SQLite FTS5 fallback без DATABASE_URL |

---

## 3. Минимальный env для пилота

```env
# Обязательно
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3001
AUTH_ADMIN_EMAIL=admin@local
AUTH_ADMIN_PASSWORD=<не admin в production>

# Workspace (по умолчанию data/)
WORKSPACE_ROOT=./data

# Agent: документы (каноничная схема)
PAPA_DB_ROOT=/Users/yrippertgmail.com/Desktop/papa-app/БАЗА/menasa
PAPA_DOC_SOURCES=руководства,документы
PAPA_PRODUCTS=ТВ3-117
# Legacy: DOCS_ROOT_DIR=/path/to/folder
```

**Проверка путей (без изменения кода):**
```bash
ls "$PAPA_DB_ROOT"
ls "$PAPA_DB_ROOT/руководства"
ls "$PAPA_DB_ROOT/документы"
```

**Опционально (для семантического поиска):**
```env
DATABASE_URL=postgresql://...
# + npm run docs:index:agent
```

**Без DATABASE_URL:** SQLite FTS5, полнотекстовый поиск. Работает.

---

## 3.1. Канонический демо-запрос (пилот)

Для стабильного поиска используй:

- **TV3-117**
- **Akt TV3**
- **akt_tv3_117**

Русская фраза («акт входного контроля…») зависит от схемы токенизации; в пилоте фиксируем язык/токенизатор отдельно.

---

## 4. Safe defaults для демо

| Сценарий | Действие |
|----------|----------|
| Первый запуск | `npm run migrate` + `npm run seed:admin` |
| Документы не проиндексированы | Поиск вернёт пустой список + warning |
| Anchoring не настроен | 200 + `status: UNAVAILABLE`, UI не падает |
| Workspace не инициализирован | 200 + `dbExists: false`, `warning` |

---

## 5. Полный сброс Next.js (при 404 на app/page.js, layout.js и т.п.)

```bash
rm -rf .next
rm -rf node_modules/.cache
npm run dev
```

Или одной командой:
```bash
npm run dev:stable
```

Если 404 сохраняются — **ядерный сброс** (один раз):
```bash
rm -rf .next node_modules/.cache
rm -rf node_modules
npm install
NEXT_DISABLE_TURBOPACK=1 next dev -p 3001
```

---

## 6. Запуск перед демо (обязательно)

**В день пилота — только:**
```bash
npm run migrate
npm run docs:index:agent:seed
npm run smoke:agent
npm run dev:stable
```

`smoke:agent` проверяет ACL (add-only) и индекс. Если ACL не настроены: `SMOKE_SKIP_PERMS=1 npm run smoke:agent` для пропуска проверки прав.

❌ **Не использовать** `npm run dev` в день демо — риск 404 на чанках.

---

## 7. Чек-лист перед демо (5 мин)

| # | Проверка | Ожидание |
|---|----------|----------|
| 1 | Консоль браузера | Нет красных ошибок |
| 2 | `/api/workspace/status` | 200, не 500 |
| 3 | `/api/anchoring/health` | 200, не 500 |
| 4 | Поиск в Помощнике | Результаты или пусто + warning |
| 5 | Draft → Confirm → Export | Работает |
| 6 | EvidenceMap | Раскрывается, «Открыть документ» |
| 7 | Confidence % | Отображается |

---

## 8. Структура App Router (обязательные файлы)

```
app/
├── layout.tsx
├── page.tsx
├── error.tsx
├── not-found.tsx
├── global-error.tsx
```

Все пять должны существовать. `error.tsx` — error boundary для вложенных сегментов. `global-error.tsx` — для root layout (должен включать свои `<html>` и `<body>`).
