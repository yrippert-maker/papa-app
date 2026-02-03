# Release Guide — v0.1.2.1

Patch release after v0.1.2. NextAuth hardening, AuthZ verification, rate-limit.

## 1. Release gate

```bash
npm test
npm run lint
npm run build
npm run smoke:auth
npm run bundle:regulatory
```

## 2. Versioning

- `package.json` version: `0.1.2.1`
- Release notes: `docs/RELEASE_NOTES_v0.1.2.1.md`

## 3. Git commands

```bash
git add package.json docs/RELEASE_NOTES_v0.1.2.1.md docs/GITHUB_RELEASE_NOTES_v0.1.2.1.md docs/RELEASE_GUIDE_v0.1.2.1.md
git commit -m "chore: v0.1.2.1 release"
git tag -a v0.1.2.1 -m "Release v0.1.2.1: NextAuth hardening, AuthZ evidence"
git show v0.1.2.1 --no-patch
```

## 4. Push

```bash
git push origin main
git push origin v0.1.2.1
```

## 5. GitHub Release

```bash
./scripts/create-release.sh OWNER/REPO v0.1.2.1
```

Or manually: Create release → Tag v0.1.2.1 → Body from `docs/GITHUB_RELEASE_NOTES_v0.1.2.1.md`.
