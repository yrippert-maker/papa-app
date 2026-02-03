# Release v0.1.27 — Policy Hash Baseline & Drift Detection

## Overview
v0.1.27 добавляет repo-backed baseline для policy hash, обеспечивая детекцию дрейфа политики в CI.

---

## Key Changes

### 1. Baseline File

**`docs/ops/POLICY_HASH_BASELINE.json`**

```json
{
  "policy_version": "1.0.0",
  "policy_hash": "25c2707addd49c29",
  "generated_at": "2026-02-02T00:00:00Z",
  "algorithm": "sha256(canonical json), truncated 16 hex"
}
```

- Хранится в репозитории
- Обновляется **только** через явный PR
- CI сравнивает текущий hash с baseline

### 2. CLI Commands

```bash
# Check against baseline
npm run retention:baseline:check
# Exit 0 = OK, Exit 2 = Drift

# Update baseline (requires clean git tree)
npm run retention:baseline:update
```

### 3. Script

**`scripts/retention-check-baseline.mjs`**

| Exit Code | Meaning |
|-----------|---------|
| 0 | Hash matches baseline |
| 1 | Error (file not found, dirty git) |
| 2 | Drift detected |

### 4. CI Integration

```yaml
- name: Policy Drift Check
  run: npm run retention:baseline:check
```

### Workflow

1. Изменить `RETENTION_POLICY_MANIFEST.md`
2. Запустить `npm run retention:baseline:update`
3. Закоммитить оба файла в одном PR
4. CI проверит, что baseline обновлен

---

## Files

| File | Purpose |
|------|---------|
| `docs/ops/POLICY_HASH_BASELINE.json` | Repo-backed baseline |
| `scripts/retention-check-baseline.mjs` | CLI script |
| `__tests__/scripts/retention-baseline.test.ts` | Tests |

---

## Tests
- Total: **220 tests passed** (+5 new)
- Build: OK

---

## Release Artifacts
- `dist/regulatory-bundle-v0.1.27.zip`
- SHA-256: **a5a14ae4b75a19af95dd11e401fda50d27141a580cfd2a174d4a9e8dc595cc8d**
