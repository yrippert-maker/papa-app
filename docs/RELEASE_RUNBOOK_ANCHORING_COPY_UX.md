# Release Runbook — Anchoring Copy UX

Полный план: тег, релиз, тикет, CI-gate, артефакты, post-deploy QA, follow-up.  
Коммит: `9bd140c` (уже в `origin/main`).

---

## 1) Тег и публикация

### Вариант A (рекомендуется)

```bash
git fetch origin
git checkout main
git pull --ff-only
git tag governance-copy-ux 9bd140c
git push origin governance-copy-ux
```

### Вариант B (датированный)

```bash
git tag governance-anchoring-copy-ux-2026-02-02 9bd140c
git push origin governance-anchoring-copy-ux-2026-02-02
```

### GitHub/GitLab Release

Создай release на тег и вставь Release Notes из раздела 3.

---

## 2) CI gate: verify_audit

Job уже добавлен в `.github/workflows/ci.yml`:

- Запуск: `main` и push тегов
- Шаги: prepare workspace → build → migrate → auditor-pack:create → STRICT_VERIFY=1 independent-verify
- Артефакт: `verify-output` (лог verify для аудиторов)

**Проверка:** migrate идёт в ephemeral workspace (`.tmp/verify-workspace`), изоляция от prod.

---

## 3) Release Notes (готовый текст)

**Title:** Anchoring Governance – Copy UX + Audit Guard

**Added**

- IssuesPanel: client-side diagnostics with filters (Critical only, Hide gaps, Search, Showing X of Y).
- Unified copy actions (txHash / anchorId / issue link) with consistent feedback (✓ / ⚠︎), 1.5s lock, clipboard fallback.
- Reusable CopyChip component to eliminate duplicated copy logic.
- prestart-check.mjs guard: blocks `next start` without build artifacts.

**Improved**

- Severity-aware highlight on successful copy: critical → amber, major → emerald, copy error → rose.
- Accessibility: `aria-live="polite"` announcements for copy success/failure.
- Docs: Copy UX contract + QA checklist + merge announcement templates.

**Notes**

- Optional “full-card highlight on Copy link” intentionally disabled (UX preference) — tracked via TODO.

---

## 4) Закрытие тикета (Jira/Linear)

**Comment:**

Delivered unified Copy UX in Anchoring Issues panel (tx/anchor/link) with consistent feedback (✓/⚠︎), 1.5s lock, clipboard fallback, a11y (`aria-live`). Refactored to CopyChip (+ unit tests). Added prestart-check.mjs to prevent `next start` without build artifacts. Docs updated: Copy UX contract + QA checklist + PR summary + merge announcement templates. Reference: commit `9bd140c`, tag `governance-copy-ux`.

**QA:** follow `docs/QA_CHECKLIST_ISSUES_PANEL.md`.

---

## 5) Коммуникация

### GitHub/GitLab Merge Comment

**Summary:** Unified Copy UX for anchoring issues (tx/anchor/link) via CopyChip. Added prestart guard to block start without build artifacts.

**QA:** Run `docs/QA_CHECKLIST_ISSUES_PANEL.md`. `npm run lint`, `npm run build` ✅. CopyChip unit tests ✅.

### Slack

🧩 Anchoring Governance: обновили IssuesPanel — добавили Copy tx/anchor/link с единым UX (✓/⚠︎, 1.5s lock, подсветка), вынесли в CopyChip + добавили prestart-guard (не даст стартануть без build). QA чек-лист в `docs/QA_CHECKLIST_ISSUES_PANEL.md`.

---

## 6) Post-deploy QA (короткий)

1. `/governance/anchoring` открывается без ошибок
2. `View issues (30d)` грузит issues, `Reload` работает
3. Фильтры: Critical only, Hide gaps, Search, Showing X of Y, Reset
4. Copy: tx → ✓ + подсветка; anchor → ✓ + подсветка; link → ✓; искусственно ошибку → ⚠︎ + rose
5. Guard: `rm -rf .next && npm run start` → блокируется; `npm run build && npm run start` → ok

Полный чек-лист: `docs/QA_CHECKLIST_ISSUES_PANEL.md`.

---

## 7) Follow-up issue

**Title:** Enable full-card highlight on “Copy link” (UX decision)

**Description:** IssuesPanel has optional full-card highlight for Copy link. Currently disabled by default. Decide UX and enable if desired.

**Acceptance:** When enabled, card gets severity-based highlight for 1.5s on Copy link (ok/error). No changes to API.

---

## 8) Командный лист для релиз-инженера

```bash
# 1) tag
git fetch origin
git checkout main
git pull --ff-only
git tag governance-copy-ux 9bd140c
git push origin governance-copy-ux

# 2) verify locally (optional)
npm ci
npm run lint
npm run build
WORKSPACE_ROOT=.tmp/verify-local npm run migrate
WORKSPACE_ROOT=.tmp/verify-local npm run auditor-pack:create -- --output dist
PACK=$(ls -td dist/auditor-pack-* 2>/dev/null | head -1)
STRICT_VERIFY=1 node scripts/independent-verify.mjs --audit-pack "$PACK"

# 3) deploy (по вашему пайплайну)
# 4) post-deploy QA: docs/QA_CHECKLIST_ISSUES_PANEL.md
```

---

## 9) Merge/Release gate (финальный чек-лист)

Перед тем как считать релиз завершённым:

- [ ] CI на `main` прошёл, включая `verify_audit`
- [ ] Артефакт `verify-output` прикрепился
- [ ] prestart-check: `rm -rf .next && npm run start` → fail; `npm run build && npm run start` → ok
- [ ] C1 smoke по `docs/OPS_AUDIT_CHECKLIST_ANCHORING.md` на stage/prod

---

## Ссылки

| Ресурс | Путь |
|--------|------|
| QA Checklist | `docs/QA_CHECKLIST_ISSUES_PANEL.md` |
| Ops/Audit Checklist | `docs/OPS_AUDIT_CHECKLIST_ANCHORING.md` |
| Merge Announcement | `docs/MERGE_ANNOUNCEMENT_ANCHORING_COPY_UX.md` |
| Ticket Closure | `docs/TICKET_CLOSURE_ANCHORING_COPY_UX.md` |
| Changelog | `docs/CHANGELOG_ANCHORING_2026-02_STEPS.md` |
