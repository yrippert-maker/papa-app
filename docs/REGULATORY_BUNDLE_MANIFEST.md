# Regulatory Submission Bundle — Manifest

**Версия:** v0.1.1  
**Назначение:** пакет документов для передачи регулятору/аудитору.

---

## Содержимое (20 файлов)

Все файлы из списка ниже + MANIFEST.txt + BUNDLE_FINGERPRINT.md + LEDGER_VERIFY_RESULT.txt + AUTHZ_VERIFY_RESULT.txt. Итого **20 файлов** в zip.

| # | Файл | Описание |
|---|------|----------|
| 1 | docs/REGULATOR_PACKAGE.md | Единая точка входа; ответы на типовые вопросы; SQLite Safe Mode |
| 2 | docs/RESPONSIBILITY_MATRIX.md | Роли, действия, запреты, юридическая ответственность, аудит |
| 3 | docs/RELEASE_NOTES_v0.1.1.md | Release notes v0.1.1 |
| 4 | docs/RELEASE_NOTES_v0.1.2.md | Release notes v0.1.2; RBAC hardening |
| 5 | docs/ENDPOINT_DB_EVIDENCE.md | Endpoint→DB mode→роль→evidence |
| 6 | docs/AUTHZ_MODEL.md | Нормативная модель RBAC, роли, permissions |
| 7 | docs/ENDPOINT_AUTHZ_EVIDENCE.md | Endpoint→Permission→Roles→Evidence |
| 8 | docs/SECURITY_POSTURE.md | Безопасность, чеклист production |
| 9 | docs/ARCHITECTURE_OVERVIEW.md | Архитектура системы |
| 10 | docs/AUDIT_LOG_SCHEMA.md | Схема audit log (SQLite/WAL) |
| 11 | docs/RELEASE_GUIDE_v0.1.2.md | Release gate v0.1.2, tag, push |
| 12 | docs/GITHUB_RELEASE_NOTES_v0.1.2.md | Шаблон для GitHub Release v0.1.2 |
| 13 | docs/DEMO_TABLE_M1_M2.md | Acceptance criteria M1/M2 |
| 14 | docs/ADR-002_SQLite_to_PostgreSQL.md | ADR: миграция SQLite→Postgres |
| 15 | docs/ADR-003_Adapter_Contracts.md | ADR: контракты адаптеров |
| 16 | docs/REGULATORY_BUNDLE_MANIFEST.md | Этот файл |
| 17 | MANIFEST.txt | Машиночитаемый манифест (path, size, sha256) |
| 18 | BUNDLE_FINGERPRINT.md | Точка входа: tag, commit, verify |
| 19 | LEDGER_VERIFY_RESULT.txt | Evidence: результат проверки hash-chain ledger (JSON Schema v1, генерируется при сборке) |
| 20 | AUTHZ_VERIFY_RESULT.txt | Evidence: результат проверки route registry и permissions (JSON Schema v1, генерируется при сборке) |

**Правило включения:** в zip попадают ровно эти 20 файлов (включая AUTHZ_VERIFY_RESULT.txt с v0.1.3).

---

### AUTHZ_VERIFY_RESULT.txt — Schema v1 (normative semantics)

The file `AUTHZ_VERIFY_RESULT.txt` contains a single UTF-8 encoded JSON object
serialized in canonical JSON form (sorted keys, no whitespace).

#### Versioning

- `schema_version` MUST be present and equal to `1` for this format.
- Any incompatible change MUST increment `schema_version`.

#### Execution semantics

- `bundle_ok` indicates whether the regulatory bundle was successfully generated.
- `authz_verification.executed` indicates whether AuthZ verification logic was executed.
- `authz_verification.skipped` indicates that verification was not executed.
- `authz_verification.authz_ok` has the following meaning:
  - `true`  — verification executed and AuthZ (route registry, permissions) confirmed.
  - `false` — verification executed and AuthZ violation or verification error detected.
  - `null`  — verification not executed (`skipped = true`).

#### Invariants (MUST)

- If `skipped = true`:
  - `executed = false`
  - `authz_ok = null`
  - `skip_reason` MUST be present.
- If `executed = true`:
  - `skipped = false`
  - `authz_ok` MUST be either `true` or `false`
  - `scope` MUST be present (route_registry_file, route_count, unique_routes, permissions_valid).

#### Interpretation

- A regulatory bundle MAY be considered valid if `bundle_ok = true`, regardless of AuthZ verification being skipped.
- AuthZ (deny-by-default, route registry integrity) is considered confirmed ONLY if:
  - `executed = true` AND `authz_ok = true`.

---

### LEDGER_VERIFY_RESULT.txt — Schema v1 (normative semantics)

The file `LEDGER_VERIFY_RESULT.txt` contains a single UTF-8 encoded JSON object
serialized in canonical JSON form (sorted keys, no whitespace).

#### Versioning
- `schema_version` MUST be present and equal to `1` for this format.
- Any incompatible change MUST increment `schema_version`.

#### Execution semantics
- `bundle_ok` indicates whether the regulatory bundle was successfully generated.
- `ledger_verification.executed` indicates whether ledger verification logic was executed.
- `ledger_verification.skipped` indicates that verification was not executed due to an objective condition
  (e.g. no database available).
- `ledger_verification.ledger_ok` has the following meaning:
  - `true`  — verification executed and ledger integrity confirmed.
  - `false` — verification executed and ledger integrity violation or verification error detected.
  - `null`  — verification not executed (`skipped = true`).

The following invariants MUST hold:
- If `skipped = true`:
  - `executed = false`
  - `ledger_ok = null`
  - `skip_reason` MUST be present.
- If `executed = true`:
  - `skipped = false`
  - `ledger_ok` MUST be either `true` or `false`
  - `scope` MUST be present.

#### Verification scope and database provenance
- When verification is executed, the result MUST include:
  - `db.db_mode = "readonly"`
  - `scope.table = "ledger_events"`
  - `scope.order_by` defining the verification order
  - `scope.event_count` indicating the number of verified events
- `db.db_path_used` MUST reflect the actual database file used, or be `null` if no database was found.

#### Interpretation
- A regulatory bundle MAY be considered valid if `bundle_ok = true`,
  regardless of ledger verification being skipped.
- Ledger integrity is considered confirmed ONLY if:
  - `executed = true` AND `ledger_ok = true`.

Any violation of the above rules MUST be treated as an invalid verification result.

---

### MANIFEST.txt — Normative format and semantics

The file `MANIFEST.txt` provides a tamper-evident inventory of all files included
in the regulatory submission bundle.

#### Encoding and structure
- `MANIFEST.txt` MUST be UTF-8 encoded.
- Each field in the header MUST appear on its own line.
- A single empty line MUST separate the header from the file list.
- The file list MUST be ordered deterministically.

#### Header fields (MUST)
The header MUST contain the following fields, each on a separate line:
- `bundle` — bundle file name (e.g. `regulatory-bundle-v0.1.1.zip`)
- `tag` — release tag (e.g. `v0.1.1`)
- `commit` — git commit SHA used to generate the bundle
- `generated_at_utc` — ISO 8601 UTC timestamp with `Z` suffix
- `generator` — bundle generation script identifier
- `working_tree_clean` — `true` if no uncommitted changes were present at generation time, otherwise `false`

#### File list
- The file list MUST start with a comment line:
  `# path  size_bytes  sha256  generated_at_utc`
- Each subsequent line MUST contain:
  - `path` — relative path inside the bundle
  - `size_bytes` — file size in bytes
  - `sha256` — lower-case hexadecimal SHA-256 of the file contents
  - `generated_at_utc` — ISO 8601 UTC timestamp with `Z` suffix

#### Manifest integrity
- The final section MUST include:
  - a comment line stating that `sha256_manifest` is computed over the manifest content
    up to (excluding) the `sha256_manifest` line.
  - `sha256_manifest` — lower-case hexadecimal SHA-256 computed over all prior bytes
    of `MANIFEST.txt`.

#### Invariants (MUST)
- All files present in the bundle MUST appear exactly once in the file list.
- The `sha256` value of each file MUST match its actual contents.
- `sha256_manifest` MUST match the computed hash of the manifest content as specified.
- If `working_tree_clean = false`, the bundle MUST NOT be used for regulatory submission.

#### Interpretation
- `MANIFEST.txt` is authoritative for bundle contents and integrity verification.
- Any mismatch between listed and actual files, sizes, or hashes MUST be treated
  as evidence of tampering or invalid bundle generation.

---

### BUNDLE_FINGERPRINT.md — Normative purpose and semantics

The file `BUNDLE_FINGERPRINT.md` serves as the authoritative cover sheet for the
regulatory submission bundle and provides a human-readable entry point for verification.

#### Purpose
- `BUNDLE_FINGERPRINT.md` MUST summarize the identity, provenance, and verification
  procedure of the regulatory bundle.
- It MUST NOT replace `MANIFEST.txt` or `LEDGER_VERIFY_RESULT.txt`, but MUST reference them.

#### Required contents (MUST)
`BUNDLE_FINGERPRINT.md` MUST include the following information:

1. **Release identification**
   - Release tag (e.g. `v0.1.1`)
   - Git commit SHA
   - Bundle generation timestamp (`generated_at_utc`, ISO 8601 UTC with `Z` suffix)

2. **Runtime reference**
   - A reference (link or section pointer) to the Runtime fingerprint
     describing the execution environment used for this release.

3. **Verification protocol**
   - A deterministic, ordered list of verification steps, including at minimum:
     1. Verification of the bundle archive integrity (if applicable).
     2. Verification of file integrity using `MANIFEST.txt`.
     3. Identification of `REGULATOR_PACKAGE.md` as the primary entry document.
     4. Reference to `LEDGER_VERIFY_RESULT.txt` as evidence of ledger integrity verification.

4. **Ledger verification disclosure**
   - An explicit statement that the bundle includes `LEDGER_VERIFY_RESULT.txt`.
   - A clarification that ledger integrity is considered confirmed only if
     `ledger_verification.executed = true` and `ledger_verification.ledger_ok = true`
     in that file.

#### Constraints (MUST)
- `BUNDLE_FINGERPRINT.md` MUST be informational and MUST NOT introduce new evidence
  or normative requirements beyond those defined in referenced documents.
- All identifiers (tag, commit) MUST match those in `MANIFEST.txt`
  and `LEDGER_VERIFY_RESULT.txt`.

#### Interpretation
- `BUNDLE_FINGERPRINT.md` is intended to be the first document opened by a reviewer.
- Any inconsistency between `BUNDLE_FINGERPRINT.md` and other bundle artifacts
  MUST be resolved in favor of `MANIFEST.txt` and `LEDGER_VERIFY_RESULT.txt`,
  which are authoritative for integrity and verification results.

---

## Порядок чтения (рекомендуемый)

1. REGULATOR_PACKAGE.md
2. RESPONSIBILITY_MATRIX.md
3. RELEASE_NOTES_v0.1.1.md (Runtime fingerprint)
4. ENDPOINT_DB_EVIDENCE.md
5. SECURITY_POSTURE.md

---

## Verification protocol (для регулятора)

1. Проверить sha256 zip (если опубликован отдельно): `shasum -a 256 regulatory-bundle-v0.1.1.zip`
2. Распаковать
3. Проверить sha256 каждого файла по MANIFEST.txt (path, size, sha256)
4. Открыть BUNDLE_FINGERPRINT.md → REGULATOR_PACKAGE.md как точку входа
5. LEDGER_VERIFY_RESULT.txt — evidence проверки целостности hash-chain (генерируется при сборке bundle)

---

## Создание bundle

```bash
./scripts/create-regulatory-bundle.sh [tag]
```

- Требует чистый git (no uncommitted changes)
- Выход: `dist/regulatory-bundle-<tag>.zip`
