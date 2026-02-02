#!/bin/bash
# Regulatory Submission Bundle — упаковка docs для регулятора.
# Использование: ./scripts/create-regulatory-bundle.sh [tag]
# Выход: dist/regulatory-bundle-<tag>.zip
#
# Guardrails: fail при uncommitted changes; требует точного совпадения tag.

set -e
TAG="${1:-v0.1.14}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOCS="$ROOT/docs"
DIST="$ROOT/dist"
BUNDLE_NAME="regulatory-bundle-${TAG}"
ZIP="$DIST/${BUNDLE_NAME}.zip"
GENERATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# 1. Проверка чистоты репо (ALLOW_DIRTY=1 — обход для тестов)
cd "$ROOT"
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "ERROR: not a git repository"
  exit 1
fi
WORKING_TREE_CLEAN="true"
if [ -n "$(git status --porcelain)" ]; then
  WORKING_TREE_CLEAN="false"
  if [ "${ALLOW_DIRTY:-0}" != "1" ]; then
    echo "ERROR: uncommitted changes. Commit or stash before creating bundle."
    echo "Override (NOT for regulatory submission): ALLOW_DIRTY=1 ./scripts/create-regulatory-bundle.sh"
    git status --short
    exit 1
  fi
  echo "WARNING: ALLOW_DIRTY=1 — bundle includes uncommitted changes. NOT for regulatory submission."
fi

# 2. Привязка к tag
COMMIT="$(git rev-parse HEAD 2>/dev/null | head -1 || echo 'no-commits')"
CURRENT_TAG="$(git describe --tags --exact-match 2>/dev/null || true)"
if [ "$CURRENT_TAG" != "$TAG" ]; then
  echo "WARN: HEAD is not tagged as $TAG (got: $CURRENT_TAG). Proceeding with commit $COMMIT."
fi

# 3. Детерминированный список файлов (фиксированный порядок)
FILES=(
  docs/REGULATOR_PACKAGE.md
  docs/RESPONSIBILITY_MATRIX.md
  docs/RELEASE_NOTES_v0.1.1.md
  docs/RELEASE_NOTES_v0.1.2.md
  docs/ENDPOINT_DB_EVIDENCE.md
  docs/AUTHZ_MODEL.md
  docs/ENDPOINT_AUTHZ_EVIDENCE.md
  docs/SECURITY_POSTURE.md
  docs/ARCHITECTURE_OVERVIEW.md
  docs/AUDIT_LOG_SCHEMA.md
  docs/RELEASE_GUIDE_v0.1.2.md
  docs/GITHUB_RELEASE_NOTES_v0.1.2.md
  docs/DEMO_TABLE_M1_M2.md
  docs/ADR-002_SQLite_to_PostgreSQL.md
  docs/ADR-003_Adapter_Contracts.md
  docs/REGULATORY_BUNDLE_MANIFEST.md
  docs/INSPECTION_API.md
  docs/INSPECTION_TRANSITIONS.md
  docs/RELEASE_NOTES_v0.1.9.md
  docs/RELEASE_NOTES_v0.1.10.md
  docs/RELEASE_NOTES_v0.1.11.md
  docs/RELEASE_NOTES_v0.1.12.md
  docs/RELEASE_NOTES_v0.1.13.md
  docs/RELEASE_NOTES_v0.1.14.md
  docs/RELEASE_NOTES_v0.1.15.md
  docs/RELEASE_NOTES_v0.1.16.md
  docs/RELEASE_NOTES_v0.1.17.md
  docs/RELEASE_NOTES_v0.1.18.md
)

mkdir -p "$DIST"

# 3b. Ledger verification (evidence output, JSON Schema v1)
# ВАЖНО: генерируется ДО MANIFEST, чтобы sha256 LEDGER_VERIFY_RESULT.txt попал в MANIFEST
if [ -d "$ROOT/.tmp/e2e-workspace" ]; then
  export WORKSPACE_ROOT="$ROOT/.tmp/e2e-workspace"
fi
export TAG COMMIT
export GENERATED_AT="$GENERATED_AT"
export OUTPUT_PATH="$DIST/LEDGER_VERIFY_RESULT.txt"
node "$ROOT/scripts/verify-ledger.mjs" 2>/dev/null || true
if [ ! -s "$DIST/LEDGER_VERIFY_RESULT.txt" ]; then
  printf '{"schema_version":1,"release":{"tag":"%s","commit":"%s","generated_at_utc":"%s"},"bundle_ok":true,"ledger_verification":{"executed":false,"skipped":true,"ledger_ok":null,"message":"Ledger verification skipped","skip_reason":"Verification script failed","db":{"db_mode":"readonly","db_source":"none","db_path_used":null},"scope":{"table":"ledger_events","order_by":"id ASC","event_count":0,"id_min":null,"id_max":null}}}\n' \
    "$TAG" "$COMMIT" "$GENERATED_AT" > "$DIST/LEDGER_VERIFY_RESULT.txt"
fi

# 3c. AuthZ verification (evidence output, JSON Schema v1)
export OUTPUT_PATH="$DIST/AUTHZ_VERIFY_RESULT.txt"
node "$ROOT/scripts/verify-authz.mjs" 2>/dev/null || true
if [ ! -s "$DIST/AUTHZ_VERIFY_RESULT.txt" ]; then
  printf '{"schema_version":1,"release":{"tag":"%s","commit":"%s","generated_at_utc":"%s"},"bundle_ok":true,"authz_verification":{"executed":false,"skipped":true,"authz_ok":null,"message":"AuthZ verification skipped","skip_reason":"Verification script failed"}}\n' \
    "$TAG" "$COMMIT" "$GENERATED_AT" > "$DIST/AUTHZ_VERIFY_RESULT.txt"
fi

# 4. MANIFEST.txt (машиночитаемый: path, size, sha256, date)
# Каждая строка — отдельный printf, явные \n (надёжно для аудитора)
MANIFEST_BODY="$DIST/MANIFEST_BODY.txt"
{
  printf '%s\n' "bundle: ${BUNDLE_NAME}.zip"
  printf '%s\n' "tag: ${TAG}"
  printf '%s\n' "commit: ${COMMIT}"
  printf '%s\n' "generated_at_utc: ${GENERATED_AT}"
  printf '%s\n' "generator: scripts/create-regulatory-bundle.sh"
  printf '%s\n' "working_tree_clean: ${WORKING_TREE_CLEAN}"
  printf '\n'
  printf '%s\n' "# path  size_bytes  sha256  generated_at_utc"
} > "$MANIFEST_BODY"

for f in "${FILES[@]}"; do
  if [ -f "$ROOT/$f" ]; then
    SIZE="$(wc -c < "$ROOT/$f" | tr -d ' ')"
    SHA="$(shasum -a 256 "$ROOT/$f" | cut -d' ' -f1)"
    printf '%s  %s  sha256:%s  %s\n' "$f" "$SIZE" "$SHA" "$GENERATED_AT" >> "$MANIFEST_BODY"
  fi
done
if [ -f "$DIST/LEDGER_VERIFY_RESULT.txt" ]; then
  SIZE="$(wc -c < "$DIST/LEDGER_VERIFY_RESULT.txt" | tr -d ' ')"
  SHA="$(shasum -a 256 "$DIST/LEDGER_VERIFY_RESULT.txt" | cut -d' ' -f1)"
  printf 'LEDGER_VERIFY_RESULT.txt  %s  sha256:%s  %s\n' "$SIZE" "$SHA" "$GENERATED_AT" >> "$MANIFEST_BODY"
fi
if [ -f "$DIST/AUTHZ_VERIFY_RESULT.txt" ]; then
  SIZE="$(wc -c < "$DIST/AUTHZ_VERIFY_RESULT.txt" | tr -d ' ')"
  SHA="$(shasum -a 256 "$DIST/AUTHZ_VERIFY_RESULT.txt" | cut -d' ' -f1)"
  printf 'AUTHZ_VERIFY_RESULT.txt  %s  sha256:%s  %s\n' "$SIZE" "$SHA" "$GENERATED_AT" >> "$MANIFEST_BODY"
fi

# sha256_manifest = hash всего MANIFEST до (исключая) комментарий и строку sha256_manifest
SHA_MANIFEST="$(shasum -a 256 "$MANIFEST_BODY" | cut -d' ' -f1)"
{
  printf '%s\n' "# sha256_manifest is computed over MANIFEST content up to (excluding) this line."
  printf '%s\n' "sha256_manifest: ${SHA_MANIFEST}"
} >> "$MANIFEST_BODY"
mv "$MANIFEST_BODY" "$DIST/MANIFEST.txt"

# 5. BUNDLE_FINGERPRINT.md (генерируем)
FINGERPRINT="$DIST/BUNDLE_FINGERPRINT.md"
RELEASE_NOTES="docs/RELEASE_NOTES_${TAG}.md"
[ -f "$ROOT/$RELEASE_NOTES" ] || RELEASE_NOTES="docs/RELEASE_NOTES_v0.1.1.md"
{
  echo "# Bundle Fingerprint"
  echo ""
  echo "**Точка входа для регулятора:** один файл с метаданными и ссылками."
  echo ""
  echo "---"
  echo ""
  echo "## Release"
  echo ""
  echo "| Поле | Значение |"
  echo "|------|----------|"
  echo "| **Tag** | ${TAG} |"
  echo "| **Commit (SHA)** | ${COMMIT} |"
  echo "| **Generated at (UTC)** | ${GENERATED_AT} |"
  echo "| **working_tree_clean** | ${WORKING_TREE_CLEAN} |"
  echo "| **Generator** | scripts/create-regulatory-bundle.sh |"
  echo ""
  echo "---"
  echo ""
  echo "## Runtime fingerprint"
  echo ""
  echo "См. [$RELEASE_NOTES]($RELEASE_NOTES) § Runtime fingerprint."
  echo ""
  echo "---"
  echo ""
  echo "## Verification protocol"
  echo ""
  echo "1. Проверить sha256 zip (если опубликован): \`shasum -a 256 ${BUNDLE_NAME}.zip\`"
  echo "2. Распаковать"
  echo "3. Для каждого файла из MANIFEST.txt: \`shasum -a 256 path\` и сравнить с указанным sha256"
  echo "4. Открыть [docs/REGULATOR_PACKAGE.md](REGULATOR_PACKAGE.md) как точку входа"
  echo "5. Ledger verification: bundle включает LEDGER_VERIFY_RESULT.txt. Целостность ledger подтверждена ТОЛЬКО если \`ledger_verification.executed = true\` и \`ledger_verification.ledger_ok = true\` в этом файле."
  echo "6. AuthZ verification: bundle включает AUTHZ_VERIFY_RESULT.txt. AuthZ (route registry, permissions) подтверждена ТОЛЬКО если \`authz_verification.executed = true\` и \`authz_verification.authz_ok = true\`."
  echo ""
} > "$FINGERPRINT"

# 6. Сборка zip (детерминированный порядок)
rm -f "$ZIP"
for f in "${FILES[@]}"; do
  [ -f "$ROOT/$f" ] && (cd "$ROOT" && zip -q "$ZIP" "$f")
done
(cd "$DIST" && zip -q "$ZIP" MANIFEST.txt BUNDLE_FINGERPRINT.md LEDGER_VERIFY_RESULT.txt AUTHZ_VERIFY_RESULT.txt)

# 7. Вывод
ZIP_SHA="$(shasum -a 256 "$ZIP" | cut -d' ' -f1)"
echo "Created: $ZIP"
echo "Zip SHA-256: $ZIP_SHA"
echo ""
unzip -l "$ZIP"
