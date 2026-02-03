# Release Guide — v0.1.2.2

Patch release: E2E stability, workspace status health.

## 1. Release gate

```bash
npm test
npm run lint
npm run build
npm run e2e
```

## 2. Git commands

```bash
git add -A
git commit -m "chore: v0.1.2.2 release"
git tag -a v0.1.2.2 -m "Release v0.1.2.2: E2E stability, workspace status health"
git show v0.1.2.2 --no-patch
```

## 3. Push

```bash
git push origin main
git push origin v0.1.2.2
```

## 4. GitHub Release

```bash
./scripts/create-release.sh yrippert-maker/papa-app v0.1.2.2
```
