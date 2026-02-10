# AI Agent MVP — спецификация

## Режимы работы

| Режим | Условие | Поиск | Индексация |
|-------|---------|-------|------------|
| **Postgres + pgvector** | DATABASE_URL задан | Семантический (embedding stub) | `npm run docs:index:pgvector` |
| **SQLite FTS5** | Без DATABASE_URL | Полнотекстовый | `npm run docs:index:agent` |

## Реализовано (Неделя 1)

### 1. Источник данных
- **DOCS_ROOT_DIR** в env — путь к папке с документами
- Поддержка: `.txt`, `.md`, `.pdf`
- Индексация рекурсивная, метаданные: путь, имя, размер, mtime, sha256

### 2. Поиск
- **SQLite FTS5** — полнотекстовый поиск (без pgvector в MVP)
- API `POST /api/agent/search` — query, filters, topK
- Виджет «Помощник по документам» на Dashboard

### 3. Индексация
- `npm run docs:index:agent` — CLI
- `POST /api/admin/reindex` — под ADMIN.MANAGE_USERS

### 4. Evidence
- Каждый документ: sha256 для неизменности
- Структура: doc_metadata + doc_chunks + doc_chunks_fts

## План (Неделя 2 — DOCX)

### Шаблоны DOCX
- `/templates/docx/letter.docx` — письмо
- `/templates/docx/act.docx` — акт
- `/templates/docx/report.docx` — отчёт
- `/templates/docx/memo.docx` — служебная записка

### Стек
- docxtemplater + pizzip
- Плейсхолдеры: `{{org_name}}`, `{{recipient}}`, `{{date}}`, `{{items}}` (loop)

### API
- `POST /api/agent/draft` — draft_fields, missing_fields, evidence
- `POST /api/agent/export` — генерация DOCX

### Правило качества
- Агент не пишет «финал» сразу
- Формирует draft_fields + missing_fields + evidence

## Workflow: draft → confirmed → final

| Этап | API | Описание |
|------|-----|----------|
| draft | `POST /api/agent/draft` | AI генерирует черновик |
| confirmed | `POST /api/agent/confirm` | Пользователь подтверждает поля |
| final | `POST /api/agent/export` | Экспорт DOCX |

**Правило:** export только после confirm. Audit: `confirmed_at/by`, `finalized_at/by`.

Подробно: [AI_AGENT_WORKFLOW_EVIDENCE.md](./AI_AGENT_WORKFLOW_EVIDENCE.md).
