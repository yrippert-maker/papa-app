# Electron + PostgreSQL: чистый build и диагностика bundle

## Чистый PG build (одним блоком)

Финальное подтверждение «AWS исчез / не исчез» возможно только по трём строкам вывода ниже. Выполните на своей машине (подставьте свой `DATABASE_URL`):

**Важно:** и `build`, и `electron:prep` должны получать одни и те же env (в `cmd1 && cmd2` вторая команда не наследует env первой). Передайте переменные обеим командам:

```bash
rm -rf electron/bundle

DATABASE_URL="postgresql://user:pass@localhost:5432/db" S3_HEALTH_ENABLED=0 GCS_HEALTH_ENABLED=0 npm run build && \
DATABASE_URL="postgresql://user:pass@localhost:5432/db" S3_HEALTH_ENABLED=0 GCS_HEALTH_ENABLED=0 npm run electron:prep

du -sh electron/bundle/standalone

find electron/bundle/standalone -maxdepth 6 -path "*better-sqlite3*" | head -20

find electron/bundle/standalone -maxdepth 6 -path "*@aws-sdk*" | head -20

find electron/bundle/standalone -maxdepth 6 -path "*@google-cloud*" | head -20
```

После сборки **`electron:prep`** выполняет **post-trace pruning** (если при сборке переданы те же env):

- при **`DATABASE_URL`** заданном — из standalone удаляются `node_modules/better-sqlite3` и следы sqlite-слоя;
- при **`S3_HEALTH_ENABLED!=1`** — удаляются `node_modules/@aws-sdk` и `node_modules/@smithy`;
- при **`GCS_HEALTH_ENABLED!=1`** — удаляются `node_modules/@google-cloud` и `node_modules/googleapis`.

В конце prep выполняется **policy assert**: если при заданных env в bundle всё ещё есть `better-sqlite3`, `@aws-sdk`, `@google-cloud` или `googleapis`, скрипт логирует ошибку и завершается с кодом 1.

### Как интерпретировать результат

- **Если обе find-команды пустые** → тема SQLite/AWS в PG desktop **закрыта**, можно переходить к «косметике» размера (caniuse-lite, asar/compression, локали, шрифты).
- Если что-то осталось — проверить, что сборка и prep запускались с теми же env (`DATABASE_URL`, `S3_HEALTH_ENABLED=0`, `GCS_HEALTH_ENABLED=0`).

### Что прислать

Ровно 3 строки:

1. Вывод `du -sh electron/bundle/standalone`
2. Вывод `find …better-sqlite3…` (или «пусто»)
3. Вывод `find …@aws-sdk…` (или «пусто», или 1–2 пути)

По ним будет дан следующий конкретный пакет оптимизаций (или один точечный фикс, если AWS всё ещё тянется).

## Стабилизация electron:prod

В `electron/main.js`:

- **wait-on** timeout: 180 s (`timeout: 180_000`).
- Логи шагов: `starting server…`, `waiting for URL…`, `window created…`.
- Лог выхода сервера: `serverProcess.on("exit", ...)`.
- При `stdio: "inherit"` stderr сервера уже идёт в консоль; при смене на pipe — логировать `serverProcess.stderr.on("data", ...)`.

Сервер в prod слушает **PORT=3001** (передаётся в `env` при spawn); URL — `http://127.0.0.1:3001`.

---

## S3 / GCS health в desktop (управление через config.env)

- **`/api/system/health`** не импортирует storage-health и не тянет AWS/GCS; возвращает базовый статус `ok` и сообщения про S3 и GCS (доступны по флагам или «disabled»).
- Проверки разделены по провайдерам:
  - **`GET /api/system/health/s3`** — только AWS (импортирует `lib/system/health/s3-health.ts`); при **`S3_HEALTH_ENABLED=0`** из bundle удаляются `@aws-sdk` и `@smithy`.
  - **`GET /api/system/health/gcs`** — только GCS (импортирует `lib/system/health/gcs-health.ts`); при **`GCS_HEALTH_ENABLED=0`** из bundle удаляются `@google-cloud` и `googleapis`.
- В desktop по умолчанию оба флага **0**; при prep с ними из bundle не попадают ни AWS, ни GCS (и chunk 1445 / googleapis не трассируется). Policy assert запрещает и `@google-cloud`, и `googleapis`.
- Когда оба флага выключены, основной **`GET /api/system/health`** возвращает **`status: "degraded"`** (и 200), чтобы мониторинг отличал «health интеграций выключен» от «всё идеально».
- Чтобы включить проверки: в `userData/config.env` выставить `S3_HEALTH_ENABLED=1` и/или `GCS_HEALTH_ENABLED=1`, перезапустить приложение; вызывать соответствующий роут при необходимости.

---

## Диагностика размера (косметика)

После PG build и `electron:prep` — где жир:

**macOS/Linux:**

```bash
du -sh electron/bundle/standalone
du -sh electron/bundle/standalone/node_modules
du -sh electron/bundle/standalone/node_modules/* 2>/dev/null | sort -h | tail -n 30
du -sh electron/bundle/standalone/public 2>/dev/null
du -sh electron/bundle/standalone/.next 2>/dev/null
```

**Типичный target list:** `caniuse-lite`, `next`, `@prisma`, `react`/`react-dom`, локали, шрифты в `public`. По топ-30 и размеру `public` составляется точечный план: что резать (локали/шрифты/пакеты), что не трогать, ожидаемый выигрыш в MB.

### Косметика как политика (зафиксировано)

- **browserslist** в `package.json`: `defaults`, `not ie <= 11`, `not op_mini all` — стабилизирует сборку, снижает шанс лишнего через postcss/browserslist.
- **electron-builder**: `asar: true`, `compression: maximum`, `removePackageScripts: true`, `npmRebuild: false` (если в app.asar нет нативных `.node`).
- **caniuse-lite** вручную не резать (риск vs выигрыш ~2.4 MB при ~481 MB total).
- **Ожидаемый эффект** от косметики: 0–20 MB, редко больше. Основной вес в `.next` (~400 MB); существенное уменьшение потребует другого класса оптимизаций (server bundles, traced files, vendor).

### Проверка после правок (короткий чек)

1. Сборка + prep (env передать обеим командам):
   ```bash
   rm -rf electron/bundle
   DATABASE_URL="postgresql://user:pass@localhost:5432/db" S3_HEALTH_ENABLED=0 GCS_HEALTH_ENABLED=0 npm run build && \
   DATABASE_URL="postgresql://user:pass@localhost:5432/db" S3_HEALTH_ENABLED=0 GCS_HEALTH_ENABLED=0 npm run electron:prep
   ```
2. Убедиться, что policy asserts зелёные (prep не падает).
3. Прогон prod: `npm run electron:prod`.
4. При необходимости — установщик: `npm run electron:build`.

**Оговорка:** `npmRebuild: false` в electron-builder безопасно, если в app.asar нет нативных модулей (`*.node`). При появлении нативного модуля в app — вернуть `npmRebuild: true`.

---

## Size-report и атрибуция по NFT traces

После чистого PG build можно получить отчёт по размеру `standalone/.next` и «кто притащил» большие файлы (через `.nft.json` traces):

```bash
node scripts/next-size-report.mjs > .next-size-report.txt
```

В отчёте: **Top dirs**, **Top files** под `standalone/.next`, **Attribution** (какой `*.nft.json` ссылается на топ-10 файлов). По блокам Top dirs (10–20 строк) и Top files (10–30 строк) можно определить 1–3 «виновника» и точечно переносить тяжёлые импорты / исключать медиа из trace.

### .next/cache в standalone

В **prep.js** после копирования static выполняется удаление **`standalone/.next/cache`** (build cache, не runtime). Это часто даёт десятки/сотни MB. В конце prep добавлен **policy assert**: если `standalone/.next/cache` всё ещё присутствует, prep падает с кодом 1. Дополнительно можно запускать `npm run next-cache-check` после prep (например в CI).

### Регрессия размера .next

После всех шагов prep логирует **итоговый размер** `standalone/.next` (в MB) и падает с кодом 1, если размер превышает **50 MB** (регрессия — например cache снова попал в standalone).

---

## Анализ server chunks (хирургия после cache)

После удаления cache основной вес в **.next/server** (~9.8 MB). Крупные артефакты:

- **chunks/1445.js** (~737 KB) — по attribution его тянет **system/health/s3/route.js.nft.json** (trace: storage-health → prisma, @aws-crypto, googleapis). Начало chunk: ResourceStream, GOOGLE_CLOUD_PROJECT, callbackify/promisify — то есть **Google Cloud / googleapis** клиент. Причина: health/s3 при build-time trace подтягивает storage-health, который может использовать GCS → в chunk попадает весь стек googleapis.
- **middleware.js** (~158 KB) — Next.js + next-auth (getToken, NextResponse, edge runtime); тяжёлых кастомных импортов в начале нет.

**Стратегия по 1445:** не трогать nft.json; уменьшить **список файлов в trace** — т.е. убрать тяжёлые импорты из маршрутов, которые тянут storage-health. Health/s3 уже вынесен в отдельный роут и при S3_HEALTH_ENABLED!=1 @aws-sdk prune; если GCS не используется в desktop, можно аналогично вынести GCS/storage-health в optional или не вызывать health/s3 в desktop. Либо оставить как есть (737 KB — приемлемо).
