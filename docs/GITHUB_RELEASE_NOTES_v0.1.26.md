# Release v0.1.26 — Policy Drift Detection

## Overview
v0.1.26 добавляет `policy_version` и `policy_hash` в JSON output для детекта дрейфа политики в CI.

---

## Key Changes

### JSON Output

```json
{
  "timestamp": "2026-02-02T...",
  "policy_version": "1.0.0",
  "policy_hash": "25c2707addd49c29",
  "mode": "dry-run",
  ...
}
```

### CI Drift Detection

```bash
# Save baseline
npm run retention:json > baseline.json
BASELINE_HASH=$(jq -r .policy_hash baseline.json)

# Check for drift
npm run retention:json > current.json
CURRENT_HASH=$(jq -r .policy_hash current.json)

if [ "$BASELINE_HASH" != "$CURRENT_HASH" ]; then
  echo "Policy drift detected!"
  exit 1
fi
```

### Implementation

| Component | Changes |
|-----------|---------|
| `lib/retention-service.ts` | Added `computePolicyHash()`, `policy_version`, `policy_hash` to report |
| `scripts/retention-enforce.mjs` | Added `POLICY` object, `computePolicyHash()`, fields in JSON |
| API `/api/compliance/retention` | Returns `policy_version` and `policy_hash` |

### Hash Algorithm
- SHA-256 of canonical JSON (sorted keys)
- Truncated to 16 hex chars for readability
- Deterministic: same policy = same hash

---

## Tests
- Total: **215 tests passed**
- Build: OK

---

## Release Artifacts
- `dist/regulatory-bundle-v0.1.26.zip`
- SHA-256: **36d536dc891e309229c5a1c123f9cb8643718a44eedd52796cd712703e7b5b56**
