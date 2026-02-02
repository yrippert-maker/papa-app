#!/bin/bash
# Создание GitHub Release.
# Использование: ./scripts/create-release.sh owner/repo [tag]
# Примеры: ./scripts/create-release.sh owner/repo v0.1.2

REPO="${1:?Usage: $0 owner/repo [tag]}"
TAG="${2:-v0.1.2}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

case "$TAG" in
  v0.1.7)
    NOTES_FILE="$SCRIPT_DIR/../docs/GITHUB_RELEASE_NOTES_v0.1.7.md"
    TITLE="Release $TAG — Operational polish for Verify Aggregator"
    ;;
  v0.1.6)
    NOTES_FILE="$SCRIPT_DIR/../docs/GITHUB_RELEASE_NOTES_v0.1.6.md"
    TITLE="Release $TAG — Verify aggregator + UI single-call, test coverage"
    ;;
  v0.1.5)
    NOTES_FILE="$SCRIPT_DIR/../docs/GITHUB_RELEASE_NOTES_v0.1.5.md"
    TITLE="Release $TAG — Ledger Verify UI, evidence-grade API, cover letters"
    ;;
  v0.1.4)
    NOTES_FILE="$SCRIPT_DIR/../docs/GITHUB_RELEASE_NOTES_v0.1.4.md"
    TITLE="Release $TAG — AuthZ UI, TMC.VIEW/AI_INBOX.VIEW, StatePanel, clickable badges"
    ;;
  v0.1.3)
    NOTES_FILE="$SCRIPT_DIR/../docs/GITHUB_RELEASE_NOTES_v0.1.3.md"
    TITLE="Release $TAG — AuthZ verification evidence, UI RBAC hardening"
    ;;
  v0.1.2.2)
    NOTES_FILE="$SCRIPT_DIR/../docs/GITHUB_RELEASE_NOTES_v0.1.2.2.md"
    TITLE="Release $TAG — E2E stability, workspace status health"
    ;;
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

run_gh_release() {
  if [ -n "$NOTES_FILE" ] && [ -f "$NOTES_FILE" ]; then
    gh release create "$TAG" --repo "$REPO" --title "$TITLE" --notes-file "$NOTES_FILE"
  else
    gh release create "$TAG" --repo "$REPO" --title "Release $TAG" --notes "## $TAG"
  fi
}

if command -v gh >/dev/null 2>&1; then
  if run_gh_release; then
    echo "Created: https://github.com/$REPO/releases/tag/$TAG"
    exit 0
  fi
fi

echo "---"
echo "gh not installed or release create failed. Create release manually:"
echo "  GitHub → Repo $REPO → Releases → Draft a new release"
echo "  Tag: $TAG (existing)"
echo "  Title: $TITLE"
if [ -n "$NOTES_FILE" ] && [ -f "$NOTES_FILE" ]; then
  echo "  Body: contents of $NOTES_FILE"
fi
echo "  https://github.com/$REPO/releases/new?tag=$TAG"
echo "---"
exit 1
