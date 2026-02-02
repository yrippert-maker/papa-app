# Ticket Closure — Anchoring Copy UX

## Comment (Jira / Linear)

Shipped: unified copy UX in Anchoring Issues panel (tx/anchor/link), CopyChip abstraction, prestart guard.

Docs: Copy UX contract (CHANGELOG) + QA checklist + merge announcement templates.

Tests: CopyChip unit tests added; tsc clean; target tests fixed.

Ref: commit `9bd140c` (tag `governance-copy-ux`).

**QA:** run `docs/QA_CHECKLIST_ISSUES_PANEL.md`.

---

## Tag Commands

```bash
git fetch origin
git checkout main
git pull
git tag governance-copy-ux 9bd140c
git push origin governance-copy-ux
```

Semver-ish:

```bash
git tag governance-anchoring-ux-2026-02-02 9bd140c
git push origin governance-anchoring-ux-2026-02-02
```
