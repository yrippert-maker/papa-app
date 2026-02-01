# Release Guide — v0.1.3

## Pre-release checklist

- [ ] `git status` — clean (or ALLOW_DIRTY for local test)
- [ ] `npm test` — all pass
- [ ] `npm run lint` — clean
- [ ] `npm run build` — success
- [ ] `npm run bundle:regulatory` — success, 20 files in zip

## Release commands (run sequentially)

```bash
git status
npm test
npm run lint
npm run build
npm run bundle:regulatory

git add -A
git commit -m "chore: release v0.1.3 — AuthZ verification evidence, UI RBAC hardening"
git tag -a v0.1.3 -m "Release v0.1.3"

git push origin main
git push origin v0.1.3

./scripts/create-release.sh yrippert-maker/papa-app v0.1.3
```

## Bundle from clean checkout (submission-grade)

After creating the tag:

```bash
git checkout v0.1.3
npm ci
npm run bundle:regulatory
```
