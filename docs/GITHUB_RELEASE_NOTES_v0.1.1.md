## Release v0.1.1 — US-7 Pagination, US-8 SQLite Safe Mode

### Highlights

- **US-7 Pagination:** cursor/offset, limit cap 100, offset cap 10 000, UI "Загрузить ещё" on `/admin/users`
- **US-8 SQLite Safe Mode:** unified DB layer, read-only vs readwrite, PRAGMA baseline, withRetry on SQLITE_BUSY
- **Evidence package:** [docs/ENDPOINT_DB_EVIDENCE.md](docs/ENDPOINT_DB_EVIDENCE.md)

### Security / Safety (US-8)

| Measure | Implementation |
|---------|----------------|
| Read-only for read-endpoints | `getDbReadOnly()` — cannot execute INSERT/UPDATE/DELETE |
| Write only human-authorized | `getDb()` + `withRetry` — admin, ledger append, file upload |
| PRAGMA baseline | `foreign_keys=ON`, `recursive_triggers=OFF`, `trusted_schema=OFF`, `busy_timeout=5000`, `journal_mode=WAL` |
| load_extension | Forbidden (unit test) |
| DoS caps | `MAX_LIMIT=100`, `MAX_OFFSET=10000` |

**Operational constraint:** DB write available only through human-authorized routes. AI has no direct write access.

### Data Access Model

| Mode | Endpoints |
|------|-----------|
| **readonly** | workspace/status, admin/users GET, tmc/*, files/list |
| **readwrite** | admin/users POST/PATCH, ledger/append, files/upload, workspace/init |

### Breaking Changes

None. API backward compatible.

### How to Verify

```bash
npm test
npm run test:e2e
npm run build
```

### Docs

- [docs/RELEASE_NOTES_v0.1.1.md](docs/RELEASE_NOTES_v0.1.1.md) — full release notes
- [docs/ENDPOINT_DB_EVIDENCE.md](docs/ENDPOINT_DB_EVIDENCE.md) — endpoint→db mode→evidence
- [docs/REGULATOR_PACKAGE.md](docs/REGULATOR_PACKAGE.md) — regulator package
