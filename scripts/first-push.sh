#!/bin/bash
# Первый push в GitHub. Однократный запуск для fresh repo.
# Использование: ./scripts/first-push.sh YOUR_GITHUB_USERNAME

if [ -z "$1" ]; then
  echo "Usage: $0 <github-username>"
  exit 1
fi

USER="$1"
REPO="papa-app"

cd "$(dirname "$0")/.."

# Защита от повторного запуска
if git remote get-url origin 2>/dev/null; then
  echo "Error: origin remote already exists. Aborting."
  exit 1
fi

if git rev-parse --verify HEAD >/dev/null 2>&1; then
  echo "Error: Repository already has commits. Aborting."
  exit 1
fi

# 1. Заменить YOUR_USERNAME в README
sed -i '' "s/YOUR_USERNAME/$USER/g" README.md
grep -q "YOUR_USERNAME" README.md 2>/dev/null && echo "WARN: YOUR_USERNAME still found" || echo "OK: README updated"

# 2. Remote
git remote add origin "https://github.com/$USER/$REPO.git"
echo "OK: remote added"

# 3. Add, commit
git add .
git status --short
git commit -m "Initial import: security fixes, RBAC P1 minimum, tests and CI"
git branch -M main

echo ""
echo "Next: git push -u origin main"
echo "(If password asked: use PAT or git remote set-url origin git@github.com:$USER/$REPO.git)"
