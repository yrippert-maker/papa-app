#!/bin/bash
# Создание labels для papa-app (запустить после первого push)
# Использование: ./scripts/create-github-labels.sh [owner/repo]

REPO="${1:?Usage: $0 owner/repo}"

gh label create "P1" --description "Priority 1 backlog" --color "1d76db" --repo "$REPO"
gh label create "enhancement" --description "New feature or request" --color "a2eeef" --repo "$REPO"
gh label create "documentation" --description "Docs, ADR, guides" --color "0075ca" --repo "$REPO"
gh label create "optional" --description "Optional / nice-to-have" --color "c2e0c6" --repo "$REPO"
gh label create "security" --description "Security-related" --color "ee0701" --repo "$REPO"
gh label create "bug" --description "Something isn't working" --color "d73a4a" --repo "$REPO"

echo "Labels created: https://github.com/$REPO/labels"
