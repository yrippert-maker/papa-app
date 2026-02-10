# AI Agent — Workflow Evidence (Enterprise-Safe)

Документ фиксирует контролируемый workflow генерации документов и audit trail для compliance/аудита.

## State Machine

```
draft → confirmed → final
```

| Статус | Описание | Допустимые переходы |
|--------|----------|---------------------|
| **draft** | Черновик сгенерирован AI, поля редактируются | → confirmed |
| **confirmed** | Пользователь подтвердил поля | → final |
| **final** | DOCX экспортирован | — |

## Правила

1. **Export только после confirm** — кнопка «Скачать DOCX» активна только после нажатия «Подтвердить».
2. **Server-side enforcement** — API `/api/agent/export` возвращает 400, если `status !== 'confirmed'` (при наличии БД).
3. **AI generates drafts; humans confirm** — только подтверждённые пользователем выходы финализируются.

## Audit Fields

| Поле | Таблица | Назначение |
|------|---------|------------|
| `confirmed_at` | agent_generated_documents | Время подтверждения |
| `confirmed_by` | agent_generated_documents | Кто подтвердил (user id/email) |
| `finalized_at` | agent_generated_documents | Время экспорта |
| `finalized_by` | agent_generated_documents | Кто экспортировал |
| `audit_meta` | agent_generated_documents | workflow_schema_version, agent_version, template_version |
| `output_sha256` | agent_generated_documents | sha256 DOCX — integrity evidence |

Цепочка ответственности: draft (AI) → confirmed (human) → final (human export).

### audit_meta (DD: «какая версия логики сделала финал»)

```json
{
  "workflow_schema_version": "1.0",
  "agent_version": "abc1234",
  "template_version": "1.0"
}
```

- `agent_version`: git commit (AGENT_VERSION env или VERCEL_GIT_COMMIT_SHA)
- `template_version`: версия шаблона DOCX (при версионировании)
- `embeddings`: provider, model, dim — для DD semantic search

### Embeddings (v1.1)

| Параметр | Значение |
|----------|----------|
| `AGENT_EMBEDDINGS_PROVIDER` | openai \| ollama \| stub |
| openai | text-embedding-3-small, 1536 dim, OPENAI_API_KEY |
| ollama | nomic-embed-text, OLLAMA_BASE_URL (default localhost:11434) |
| stub | sha256-заглушка, fallback при ошибке провайдера |

Режим fallback: при ошибке openai/ollama автоматически используется stub.

## Edge Cases

### Идемпотентность

- **confirm** повторно при `status=confirmed` → возвращает успех без изменений.
- **export** повторно при `status=final` → разрешён (регенерация DOCX из тех же полей).

### Concurrency

- **confirm**: `UPDATE ... WHERE id=? AND status='draft'` — блокирует гонки при двойном клике.
- **export**: `UPDATE ... WHERE id=? AND status='confirmed'` — только первый export переводит в final.

## Fallback без БД

При отсутствии `DATABASE_URL`:

- confirm — no-op на сервере, статус хранится в клиенте.
- export — принимает `draftFields` в теле запроса.
- Audit-поля не записываются (режим «client-only»).

## AuthZ

- `POST /api/agent/confirm` — требует `FILES.LIST`.
- `POST /api/agent/export` — требует `FILES.LIST`.
- UI-ограничения (disabled-кнопки) — не безопасность; enforcement на сервере.

## Чеклист сборки (зависимости)

При ошибках `Module not found: pizzip|docxtemplater|pgvector|openai`:

1. Установить зависимости: `npm install` (overrides в package.json устраняют конфликт openai/zod)
2. Проверить: `npm ls pizzip docxtemplater pgvector openai`
3. `next.config.mjs`: `serverComponentsExternalPackages` исключает эти пакеты из бандла (Next 14)

Пакеты должны быть только в server-side коде (API routes, lib/agent). Не импортировать в UI-компоненты.

## См. также

- [AI_AGENT_MVP_SPEC.md](./AI_AGENT_MVP_SPEC.md) — общая спецификация.
- `lib/agent/draft-workflow.ts` — реализация state machine.
