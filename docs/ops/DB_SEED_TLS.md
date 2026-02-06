# TLS для seed (Supabase / managed Postgres)

При `prisma db seed` против облачной БД (Supabase, RDS и т.п.) возможна ошибка:

```
Error opening a TLS connection: self-signed certificate in certificate chain
```

## Варианты решения (от лучшего к fallback)

### A) Безопасный: доверить корневой CA

Если у провайдера есть CA bundle (Supabase обычно использует публичные корни):

```bash
export NODE_EXTRA_CA_CERTS=/path/to/ca.pem
npm run db:seed
```

Не трогать `NODE_TLS_REJECT_UNAUTHORIZED`.

### B) Компромисс: `ssl: { rejectUnauthorized: false }` только для pg

В `prisma/seed.ts` — `rejectUnauthorized: false` локализует риск только на pg, не на весь Node-процесс.  
Срабатывает **только** при явном `SEED_TLS_INSECURE=1` (не по URL: `sslmode=require` не триггер — он лишь включает TLS).

### C) Fallback: `db:seed:supabase`

```bash
npm run db:seed:supabase
```

> ⚠️ **Warning:** `NODE_TLS_REJECT_UNAUTHORIZED=0` отключает проверку TLS-сертификатов **для всего Node-процесса** (все HTTPS, все TLS-соединения), а не только для Postgres. В CI/проде — **запрещено** (seed падает). Только для локального/одноразового seed.

## Проверка

```bash
./node_modules/.bin/prisma db execute --stdin <<'SQL'
SELECT email, "createdAt" FROM "User" WHERE email = 'admin@company.com';
SQL
```

Или Prisma Studio: `npx prisma studio`.
