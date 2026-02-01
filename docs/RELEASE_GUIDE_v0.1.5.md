# Release Guide — v0.1.5

## Pre-release checklist

- [ ] `git status` — clean
- [ ] `npm test` — all pass
- [ ] `npm run lint` — clean
- [ ] `npm run build` — success
- [ ] `npm run bundle:regulatory` — success (20 files)

## Release commands

```bash
git status
npm test
npm run lint
npm run build
npm run bundle:regulatory

git add -A
git commit -m "chore: release v0.1.5 — Ledger Verify UI, evidence-grade API, cover letters"
git tag -a v0.1.5 -m "Release v0.1.5"

git push origin main
git push origin v0.1.5

./scripts/create-release.sh yrippert-maker/papa-app v0.1.5
```

## Submission-grade bundle

**Normative:** A submission-grade bundle MUST be built from a **clean checkout at the release tag**. Do NOT use `ALLOW_DIRTY`.

```bash
git checkout v0.1.5
npm ci
npm run build
npm run migrate
npm run bundle:regulatory
```

## Must-check (final review)

- **A) Skipped semantics:** 403 / skipped → UI shows "Доступ запрещён" (warning), never OK
- **B) Rate limit:** API returns 429, Retry-After header; UI shows "Rate limit — попробуйте позже"
- **C) Docs:** API response format documented; bundle offline evidence unchanged
