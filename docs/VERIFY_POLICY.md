# Verify Policy — Environment Variables

Environment variables that control `independent-verify.mjs` behavior.

## Core

| Variable | Values | Description |
|----------|--------|-------------|
| `STRICT_VERIFY` | `1`, `true` | Require ANCHORING_STATUS.json; fail on FAIL assessment; require pack signature when public key is configured |
| `REQUIRE_ANCHORING_ISSUES` | `1`, `true` | Require ANCHORING_ISSUES.json |
| `REQUIRE_PACK_SIGNATURE` | `1`, `true` | **Prod/stage:** Require pack_hash.json + pack_signature.json + valid signature; fail if missing or invalid. **Dev/local:** omit to allow unsigned packs |
| `VERIFY_FAIL_SEVERITY` | Comma-separated | Fail when any issue has this severity (e.g. `critical`) |
| `VERIFY_FAIL_TYPES` | Comma-separated | Fail when any issue has this type (e.g. `RECEIPT_INTEGRITY_MISMATCH,RECEIPT_MISSING_FOR_CONFIRMED,ANCHOR_FAILED`) |

## Pack Signature

| Variable | Description |
|----------|-------------|
| `PACK_SIGN_PUBLIC_KEY_PEM` | PEM-encoded Ed25519 public key for pack signature verification |
| `PACK_SIGN_PUBLIC_KEY_PATH` | Path to file containing the public key PEM |
| `PACK_SIGN_PUBLIC_KEYS_PEM` | Multiple PEM blocks (concatenated) for key rotation; verify accepts any matching key |
| `PACK_SIGN_KEY_ID` | (pack-sign only) Optional key identifier written to pack_signature.json (e.g. `ed25519:2026-02`) for audit trail |

When `REQUIRE_PACK_SIGNATURE=1` or `STRICT_VERIFY=1` with a public key configured, `pack_hash.json` and `pack_signature.json` are required and must be valid.

## Policy file (optional)

When present, `independent-verify` reads fail severity/types from a policy file instead of env:

- **In pack:** `<audit-pack>/anchoring.verify-policy.json`
- **In repo:** `config/anchoring.verify-policy.json`

Schema: `{ "failSeverity": ["critical"], "failTypes": ["RECEIPT_INTEGRITY_MISMATCH", ...], "warnTypes": ["GAP_IN_PERIODS"] }`. Env `VERIFY_FAIL_*` overrides when set.

## Output

| Variable | Description |
|----------|-------------|
| `VERIFY_SUMMARY_PATH` | Write machine-readable JSON summary to this path |

## Recommended Defaults

### Prod / stage (CI, audit-monitor)

```
STRICT_VERIFY=1
REQUIRE_ANCHORING_ISSUES=1
REQUIRE_PACK_SIGNATURE=1
VERIFY_FAIL_SEVERITY=critical
VERIFY_FAIL_TYPES=RECEIPT_INTEGRITY_MISMATCH,RECEIPT_MISSING_FOR_CONFIRMED,ANCHOR_FAILED
VERIFY_SUMMARY_PATH=verify-summary.json
PACK_SIGN_PUBLIC_KEY_PEM=...
```

### Dev / local (permissive)

```
# No env — permissive mode, no hard-fail on issues, signature optional
```

### Local (strict, no signature)

```
STRICT_VERIFY=1
REQUIRE_ANCHORING_ISSUES=1
# Omit REQUIRE_PACK_SIGNATURE and PACK_SIGN_* to skip signature check
```
