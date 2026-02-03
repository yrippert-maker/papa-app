# Release Guide — v0.1.4

## Pre-release checklist

- [ ] `git status` — clean
- [ ] `npm test` — all pass
- [ ] `npm run lint` — clean
- [ ] `npm run build` — success
- [ ] `npm run bundle:regulatory` — success, 20 files

## Release commands

```bash
git status
npm test
npm run lint
npm run build
npm run bundle:regulatory

git add -A
git commit -m "chore: release v0.1.4 — AuthZ UI, TMC.VIEW/AI_INBOX.VIEW, StatePanel, clickable badges"
git tag -a v0.1.4 -m "Release v0.1.4"

git push origin main
git push origin v0.1.4

./scripts/create-release.sh yrippert-maker/papa-app v0.1.4
```

## Submission-grade bundle

**Normative:** A submission-grade bundle MUST be built from a **clean checkout at the release tag**. Do NOT use `ALLOW_DIRTY`.

```bash
git checkout v0.1.4
npm ci
npm run build
npm run migrate
npm run bundle:regulatory
```

- `npm run build` — ensures consistent environment before bundle.
- `npm run migrate` — applies migrations; run on test/empty DB or target environment.
- For ledger/authz verification results in bundle: ensure expected DB exists, or accept “skipped” (documented).
