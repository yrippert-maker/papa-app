# Agent: диагностика «ошибка соединения»

Агент — **inline API** в том же Next.js. Отдельного воркера/очереди нет.

---

## Endpoints (все в /api/agent/)

| Endpoint | Метод | Назначение |
|----------|-------|------------|
| `/api/agent/search` | POST | Поиск документов |
| `/api/agent/draft` | POST | Подготовка черновика |
| `/api/agent/confirm` | POST | Подтверждение |
| `/api/agent/export` | POST | Экспорт DOCX |
| `/api/agent/doc/:docId` | GET | Скачать оригинал |

---

## Smoke-check (без UI)

```bash
curl -X POST http://localhost:3001/api/agent/search \
  -H "Content-Type: application/json" \
  -d '{"query":"TV3-117","topK":5}' \
  -i
```

Ожидание: `Content-Type: application/json`, тело `{ "results": [...] }`. Если HTML — проблема в backend handler.

---

## «Ошибка соединения» — что это на самом деле

В UI эта фраза появляется при **любом** исключении в `fetch`/`res.json()`:

1. **fetch failed** — сеть, CORS, сервер не отвечает
2. **res.json() throws** — сервер вернул HTML (error page) вместо JSON → `Unexpected token '<'`

---

## Быстрая проверка (3 шага)

### 1. Network → какой запрос падает

Chrome DevTools → Network → Preserve log → повторить поиск.

- **URL:** `/api/agent/search` (или draft/confirm/export)
- **Status:** 0 / 401 / 500?
- **Response:** JSON или HTML?

### 2. curl — backend жив?

```bash
curl -X POST http://localhost:3001/api/agent/search \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION" \
  -d '{"query":"акт ТВ3-117","topK":5}'
```

Без cookie → 401. С cookie (скопировать из DevTools) → 200 + JSON или 500.

### 3. Server logs

В терминале `npm run dev:stable` после запроса — stack trace при 500.

---

## Типичные причины

| Симптом | Причина | Фикс |
|---------|---------|------|
| Status 0, fetch failed | Сервер не запущен / порт занят | `npm run dev:stable` |
| 401 | Нет сессии | Залогиниться |
| 500 + HTML | Ошибка в route handler | Смотреть server logs |
| 200 + warning «Index not built» | Индекс не создан | `npm run docs:index:agent` |
| 200 + warning «pgvector requires DATABASE_URL» | Postgres не настроен | Задать DATABASE_URL или использовать SQLite |
| «Workspace database not found» | Миграции не применены | `npm run migrate` |

---

## Требования для поиска

**SQLite (без DATABASE_URL):**
- `WORKSPACE_ROOT` — папка с workspace (по умолчанию `./data`)
- `npm run migrate` — создаёт БД
- Источники документов (один из вариантов):
  - **Каноничная схема:** `PAPA_DB_ROOT`, `PAPA_DOC_SOURCES`, опционально `PAPA_PRODUCTS`
  - **Legacy:** `DOCS_ROOT_DIR` — одна папка
- `npm run docs:index:agent` — создаёт индекс (при OOM см. ниже)
- `npm run docs:index:agent:seed` — минимальный индекс (2 доки) для пилота, если `docs:index:agent` падает по памяти

**Postgres (с DATABASE_URL):**
- `OPENAI_API_KEY` или `OLLAMA_BASE_URL` — для эмбеддингов
- Источники: `PAPA_DB_ROOT` + `PAPA_DOC_SOURCES` или `DOCS_ROOT_DIR`
- `npm run docs:index:agent` — индексирует в pgvector

---

## Пилотный fallback

Если агент недоступен — UI показывает «Ошибка соединения» + можно нажать «Повторить». Для демо этого достаточно: проблема выглядит как контролируемая деградация.

---

## ACL add-only + smoke perms (рекомендуется для пилота)

База документов в защищённом месте (не на Desktop). ACL: можно добавлять, нельзя удалять/переименовывать/перемещать.

**Проверка:** `npm run smoke:agent` включает `smoke:agent:perms`:
- ✅ add_file — пополнение разрешено
- ✅ delete — запрещён (EPERM/EACCES)
- ✅ rename/move — запрещён

**Пропуск perms (dev без ACL):** `SMOKE_SKIP_PERMS=1 npm run smoke:agent`

---

## Политика путей (AGENT_OUTPUT_ROOT)

Все артефакты агента (DOCX, EvidenceMap, sha256, manifest) пишутся **только** в `AGENT_OUTPUT_ROOT`:

```
<AGENT_OUTPUT_ROOT>/<product>/<kind>/<YYYY-MM-DD>/<slug>/
  document.docx
  evidencemap.json
  sha256.txt
  sources_manifest.json
```

- `product` — из allowlist (ТВ3-117, АИ-9, … общие)
- `kind` — docx, evidencemap, evidence_kit, черновики, …
- Неизвестные product/kind → fallback в `общие/черновики/`

**Проверка:** `npm run smoke:agent:outputs` (входит в `smoke:agent` при заданном AGENT_OUTPUT_ROOT).

---

## Immutable hard mode (опционально)

Жёсткая защита: `chflags uchg` на папку БАЗА. Включается отдельно, требует sudo.

```bash
# Включить (из корня проекта, PAPA_DB_ROOT в .env.local)
sudo npm run db:immutable:on

# Снять
sudo npm run db:immutable:off
```

**Импорт документов при immutable:**
1. `sudo npm run db:immutable:off`
2. Положить файлы в `~/Documents/papa-import/ТВ3-117/` (или другую подпапку)
3. `npm run db:import` или `npm run db:import ТВ3-117`
4. `sudo npm run db:immutable:on`
