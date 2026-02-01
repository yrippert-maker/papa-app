# Release Guide — v0.1.2

This guide describes the steps required to release version v0.1.2.

## 1. Release Gate

Run all checks on a clean working tree:

```bash
npm test
npm run lint
npm run build
npm run bundle:regulatory
```

All commands MUST succeed.

## 2. Versioning

- Ensure `package.json` version is set to `0.1.2`.
- Ensure release notes files exist:
  - `docs/RELEASE_NOTES_v0.1.2.md`
  - `docs/GITHUB_RELEASE_NOTES_v0.1.2.md`

## 3. Git Commands

```bash
git status
git add .
git commit -m "chore: v0.1.2 release — RBAC hardening, deny-by-default authz"
git tag -a v0.1.2 -m "Release v0.1.2: RBAC hardening and authorization evidence"
git show v0.1.2 --no-patch
```

## 4. Push

```bash
git push origin main
git push origin v0.1.2
```

## 5. GitHub Release

Create a GitHub release using:

- **Tag:** v0.1.2
- **Title:** v0.1.2 — RBAC Hardening
- **Body:** contents of `docs/GITHUB_RELEASE_NOTES_v0.1.2.md`

If available:

```bash
./scripts/create-release.sh OWNER/REPO v0.1.2
```

## 6. Post-release

Fill in the following fields in `docs/RELEASE_NOTES_v0.1.2.md`:

- Release commit SHA
- (Optional) CI run identifier

Confirm that:

- the regulatory bundle is reproducible,
- bundle contents match `docs/REGULATORY_BUNDLE_MANIFEST.md`,
- `working_tree_clean = true` for submission builds.
