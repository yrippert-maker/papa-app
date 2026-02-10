# Postgres (Local) — запуск для разработки

## 1) Запуск Postgres + pgvector

```bash
docker compose up -d postgres
```

Проверка:

```bash
docker ps | grep papa-postgres
docker logs papa-postgres --tail 50
```

## 2) ENV

Скопируйте env.example → .env.local и проверьте:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/papa?schema=public
```

## 3) Миграции

```bash
npm run db:migrate
```

## 4) Остановка

```bash
docker compose down
```

## Notes

* Данные сохраняются в docker volume `papa_pg_data`.
* pgvector включён через `CREATE EXTENSION IF NOT EXISTS vector;` в миграциях (002_agent_pgvector.sql).
