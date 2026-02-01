# Release Notes v0.1.1

**Дата:** 2026-02-01  
**Контрольная точка:** US-7 + US-8 — пагинация и SQLite Safe Mode.

### Runtime fingerprint

**Release tag:** v0.1.1  
**Release commit (git SHA):** <fill-after-push>  
**Build/CI run ID (optional):** <fill-if-applicable>

#### Host / OS
- **OS:** <e.g., Ubuntu 22.04.3 LTS / macOS 14.2 / Windows Server 2022>
- **Kernel (Linux) / Build (macOS/Windows):** <e.g., 5.15.0-91-generic / 23C64>
- **Architecture:** <x86_64 / arm64>
- **Container (if used):** <none | docker image + tag + digest>

#### Runtime
- **Node.js:** <e.g., v20.11.1> (verify: `node -v`)
- **npm:** <e.g., 10.2.4> (verify: `npm -v`)
- **OpenSSL (Node):** <e.g., OpenSSL 3.0.13> (verify: `node -p "process.versions.openssl"`)
- **Timezone:** <e.g., Europe/Zurich> (verify: `node -e "console.log(Intl.DateTimeFormat().resolvedOptions().timeZone)"`)

#### SQLite
- **SQLite engine version:** <e.g., 3.45.1>  
  - verify (CLI, if available): `sqlite3 --version`
  - verify (in-app, preferred): `node -e "const Database = require('better-sqlite3'); const db = new Database(':memory:'); console.log(db.prepare('SELECT sqlite_version()').pluck().get()); db.close();"`
- **SQLite driver/binding:** better-sqlite3 <e.g., 12.6.2>  
  - verify: `npm ls better-sqlite3`
- **Dependency lockfile:** package-lock.json (present, committed)

#### App configuration (relevant)
- **DB mode defaults:** [docs/ENDPOINT_DB_EVIDENCE.md](ENDPOINT_DB_EVIDENCE.md)
- **SQLite safety PRAGMA baseline:** `foreign_keys=ON; recursive_triggers=OFF; trusted_schema=OFF; busy_timeout=5000; journal_mode=WAL (readwrite)`
- **Retry policy (SQLITE_BUSY):** exponential backoff + jitter (verify: unit tests / logs)

#### Verification commands (executed)
- `npm test`
- `npm run test:e2e`
- [docs/RELEASE_GUIDE_v0.1.1.md](RELEASE_GUIDE_v0.1.1.md) — smoke checklist

All evidence documents referenced in this release were generated and verified under the runtime fingerprint described above.

> **Quick capture (optional):**
> ```bash
> node -v && npm -v
> node -p "process.versions"
> node -e "console.log(Intl.DateTimeFormat().resolvedOptions().timeZone)"
> sqlite3 --version  # если CLI установлен
> node -e "const Database = require('better-sqlite3'); const db = new Database(':memory:'); console.log('sqlite', db.prepare('SELECT sqlite_version()').pluck().get()); db.close();"
> ```

---

## 1. Highlights

- **US-7 Пагинация:** cursor/offset, limit cap 100, offset cap 10 000, UI «Загрузить ещё» на `/admin/users`
- **US-8 SQLite Safe Mode:** единый DB-слой, read-only vs readwrite, PRAGMA baseline, withRetry на SQLITE_BUSY
- **Evidence-пакет:** endpoint→db mode→роль→тесты — см. [docs/ENDPOINT_DB_EVIDENCE.md](ENDPOINT_DB_EVIDENCE.md)

---

## 2. Security / Safety (US-8 summary)

| Мера | Реализация |
|------|------------|
| Read-only для read-endpoints | `getDbReadOnly()` — физически не может выполнять INSERT/UPDATE/DELETE |
| Write только human-authorized | `getDb()` + `withRetry` — admin, ledger append, file upload |
| PRAGMA baseline | `foreign_keys=ON`, `recursive_triggers=OFF`, `trusted_schema=OFF`, `busy_timeout=5000`, `journal_mode=WAL` |
| load_extension | Запрещён (unit-тест) |
| DoS caps | `MAX_LIMIT=100`, `MAX_OFFSET=10000` |

**Operational constraint:** DB write доступен только через явно авторизованные маршруты (requirePermission). AI-агент не имеет прямого доступа на запись; любой write — результат действия человека.

---

## 3. Data access model

| Режим | Endpoints | Технология |
|-------|-----------|------------|
| **readonly** | workspace/status, admin/users GET, tmc/*, files/list, authz, auth-options | `getDbReadOnly()` |
| **readwrite** | admin/users POST/PATCH, ledger/append, files/upload, workspace/init | `getDb()` + `withRetry` |

Подробная таблица: [docs/ENDPOINT_DB_EVIDENCE.md](ENDPOINT_DB_EVIDENCE.md).

---

## 4. Breaking changes

- **Нет.** API обратно совместим.
- Ответы списков содержат `nextCursor`, `hasMore` — клиенты, игнорирующие их, продолжают работать.

---

## 5. How to verify

```bash
npm test                    # Unit
npm run test:e2e            # E2E (build, migrate, seed, smoke)
npm run build               # Сборка
npm run check:db-imports    # Нет прямых импортов better-sqlite3 вне lib/db
```

**Локальный smoke:**
- `/admin/users` — «Загрузить ещё» при >20 пользователях
- `/tmc/registry`, `/tmc/lots` — пагинация (limit/offset)
- `/workspace` — files/list с limit
