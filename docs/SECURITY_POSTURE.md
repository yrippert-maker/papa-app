# Security Posture Update

## Закрыто (implemented)

- **S1 Path Traversal** — проверка путей, блокировка `..`, sanitized logging
- **S2 Аутентификация** — NextAuth Credentials, middleware на все API и страницы
- **S4 Ledger** — zod-валидация, allowlist событий
- **S5 Upload** — ограничение размера 50 MB, allowlist расширений, блокировка double extension
- **A1 Workspace** — без хардкода, fail-fast при production + default credentials
- **Tests / CI** — unit-тесты, GitHub Actions
- **Security hygiene** — баннер при default credentials, логирование блокировок

## Остаётся (planned)

- **S3 npm audit** — устраняется при миграции на Next.js ≥16
- RBAC (роли) — опционально
- Rate limiting — опционально

## Условия для production

1. Задать `AUTH_USER` и `AUTH_PASSWORD` в env
2. Задать `NEXTAUTH_SECRET` (описание в env.example)
3. Задать `WORKSPACE_ROOT`
4. При `NODE_ENV=production` и default credentials — сервер возвращает 500 на `/api/workspace/status`

---

## Security regression checklist (перед релизом)

- [ ] **default admin** — `admin@local` с паролем `admin` заменён; `hasDefaultAdminCredentials()` в production → 500 (E2E_MODE отключает для e2e в CI)
- [ ] **E2E_MODE** — НЕ устанавливать в production; middleware возвращает 503 при `NODE_ENV=production` + `E2E_MODE=1` + `CI!=true` (e2e использует `CI=true`)
- [ ] **npm audit** — выполнить `npm audit`, зафиксировать статус; известные уязвимости — в roadmap (Next.js ≥16)
- [ ] **Upload allowlist** — расширения в `ALLOWED_EXTENSIONS`, опасные в `DANGEROUS_EXTENSIONS` (api/files/upload)
- [ ] **Middleware matcher** — защищены `/api/*` (кроме `api/auth`), `/login` и static assets исключены
- [ ] **Path traversal** — `listWorkspace` использует `resolveWorkspacePath`, API отклоняет `..` в `dir`
- [ ] **Ledger validation** — allowlist `FILE_REGISTERED`, payload проверяется через zod
- [ ] **Fail-fast** — при `NODE_ENV=production` и default credentials status возвращает 500
- [ ] **E2E smoke** — `npm run test:e2e` проходит (401/307 без auth, auditor 200/403, admin 200). Cookie jar, workspace: `.tmp/e2e-workspace`.
