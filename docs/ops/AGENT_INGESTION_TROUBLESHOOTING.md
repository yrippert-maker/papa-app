# Agent ingestion troubleshooting

## Быстрая диагностика

### 1) Проверить, есть ли документ в реестре

```sql
SELECT id, filename, path, sha256
FROM agent_docs
WHERE filename ILIKE '%TB3-117%' OR path ILIKE '%TB3-117%';
```

### 2) Проверить, есть ли чанки (индекс)

```sql
SELECT COUNT(*) AS chunks
FROM agent_doc_chunks
WHERE doc_id = '<DOC_UUID>';
```

### 3) Проверить очередь ingestion

```sql
SELECT status, attempts, last_error, created_at, updated_at
FROM agent_ingest_jobs
WHERE doc_id = '<DOC_UUID>'
ORDER BY created_at DESC
LIMIT 5;
```

## Самовосстановление

### Поставить в очередь индексации (ручной enqueue)

API:

* POST /api/agent/ingest
  body: { "docId": "<DOC_UUID>" }

Или напрямую в БД (если нужно):

```sql
INSERT INTO agent_ingest_jobs (doc_id) VALUES ('<DOC_UUID>'::uuid);
```

Примечание: partial unique index не позволит создать дубликат активного job (queued/running).

## Типовые ошибки (last_error prefix)

* [EXTRACT_EMPTY] — не удалось получить текст (файл пустой/неподдерживаемый/ошибка извлечения)
* [READ_FAIL] — не удалось прочитать файл с диска
* [EMBED_FAIL] — сбой модели эмбеддингов
* [VECTOR_DIM_MISMATCH] — неверная размерность эмбеддинга (ожидается 768)

В проекте используется `vector(768)`; размерность зависит от выбранной embedding-модели и должна совпадать с DDL.

## Запуск воркера (dev)

```bash
npm run agent:ingest:worker
```
