# Evidence Map UI — Evidence (v1.1)

## Назначение

EvidenceMap — навигационный инструмент доверия: «покажи, откуда это взялось». Аудитор видит: утверждение → документ → фрагмент.

## Реализация

### Backend

- **GET /api/agent/doc/:docId** — метаданные документа (path, sha256, chunks с snippet)
- **GET /api/agent/doc/:docId?download=1** — стрим файла
- **enrichEvidence** — добавляет snippet (первые 300 символов первого чанка)
- **search** — возвращает chunkId, sha256

### UI

- Клик по источнику → раскрытие фрагмента (snippet)
- Ссылка «Открыть документ» → `/api/agent/doc/:docId?download=1`
- Hover → подсветка (transition-colors)

### EvidenceItem

```ts
{
  docId, path, sha256, chunkIds, snippet?
}
```

## Критерий готовности

- Любое поле в draft можно объяснить через источник
- Аудитор видит: утверждение → документ → фрагмент
