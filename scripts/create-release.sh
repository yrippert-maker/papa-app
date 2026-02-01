#!/bin/bash
# Создание GitHub Release.
# Использование: ./scripts/create-release.sh owner/repo [tag]
# Примеры: ./scripts/create-release.sh owner/repo v0.1.2

REPO="${1:?Usage: $0 owner/repo [tag]}"
TAG="${2:-v0.1.2}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

case "$TAG" in
  v0.1.2.1)
    NOTES_FILE="$SCRIPT_DIR/../docs/GITHUB_RELEASE_NOTES_v0.1.2.1.md"
    TITLE="Release $TAG — NextAuth hardening, AuthZ evidence"
    ;;
  v0.1.2)
    NOTES_FILE="$SCRIPT_DIR/../docs/GITHUB_RELEASE_NOTES_v0.1.2.md"
    TITLE="Release $TAG — RBAC hardening, deny-by-default authz"
    ;;
  v0.1.1)
    NOTES_FILE="$SCRIPT_DIR/../docs/GITHUB_RELEASE_NOTES_v0.1.1.md"
    TITLE="Release $TAG — US-7 Pagination, US-8 SQLite Safe Mode"
    ;;
  *)
    NOTES_FILE=""
    TITLE="Release $TAG"
    ;;
esac

if [ -n "$NOTES_FILE" ] && [ -f "$NOTES_FILE" ]; then
  gh release create "$TAG" \
    --repo "$REPO" \
    --title "$TITLE" \
    --notes-file "$NOTES_FILE"
else
  # fallback для v0.1.0 или если файл не найден
  gh release create "$TAG" \
    --repo "$REPO" \
    --title "Release $TAG — P1: RBAC + Users + Admin UI" \
    --notes "## $TAG — P1: RBAC + Users + Admin UI

### Features
- Multi-user auth, RBAC, Admin Users UI, Audit, Migrations

### Docs
- [docs/SECURITY_POSTURE.md](docs/SECURITY_POSTURE.md)
- [docs/ARCHITECTURE_OVERVIEW.md](docs/ARCHITECTURE_OVERVIEW.md)"
fi
echo "Created: https://github.com/$REPO/releases/tag/$TAG"
