# Security Baseline Plan — papa-app

**Стек:** Next.js + Node + Electron | **Хостинг:** AWS ECS Fargate + ALB + RDS | **CI:** GitHub Actions

---

## ✅ Применённые патчи (Пакет A)

| Файл | Изменение |
|------|-----------|
| `next.config.mjs` | Security headers (HSTS, X-Frame-Options, CSP, Permissions-Policy) |
| `electron/main.js` | webPreferences: nodeIntegration=false, contextIsolation=true, sandbox=true, setWindowOpenHandler(deny), will-navigate + will-redirect guard (только 127.0.0.1/localhost:3001) |
| `Dockerfile` | ARG для build, non-root user (nextjs), chown |
| `.github/workflows/security-ai-weekly.yml` | npm audit + Trivy + Snyk → weekly issue **только при HIGH/CRITICAL** |

---

## Sanity-check (30–60 мин)

- [ ] **Headers/CSP**: web-prod — HSTS только по HTTPS; CSP не ломает чанки
- [ ] **Electron**: `window.open` → deny; `will-navigate` + `will-redirect` блокируют внешние URL
- [ ] **Docker**: `docker run --rm papa-app id` → uid=1001(nextjs)
- [ ] **security-ai-weekly**: issue создаётся; Trivy сканит deployable image
- [ ] **GitHub**: branch protection (PR, status checks, 1–2 approvals); prod = manual approval

---

## Ответы на 4 вопроса (для точного плана)

| # | Вопрос | Ответ по papa-app |
|---|--------|------------------|
| 1 | CloudFront уже есть? | **Нет** — сейчас Internet → ALB → ECS. CloudFront не настроен. |
| 2 | API: auth, websocket, file upload? | **Да** `/api/auth/*` (NextAuth), **нет** websocket, **да** `/api/files/upload` |
| 3 | Next.js: SSR, heavy endpoints? | **Да** SSR (App Router), heavy: `/api/agent/search`, `/api/agent/export`, `/api/compliance/audit-pack`, `/api/documents/*` |
| 4 | Electron: внешние URL в webview? | **Нет** — только `http://127.0.0.1:3001` (локальный Next.js) |

---

## 1. Workflow `security-ai-weekly.yml` (структура)

```yaml
name: Security AI Weekly

on:
  schedule:
    - cron: '0 9 * * 1'  # Понедельник 09:00 UTC
  workflow_dispatch:

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install
        run: npm ci

      - name: Audit deps (npm)
        run: npm audit --audit-level=high
        continue-on-error: true

      - name: Check lockfile vs CVE
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        continue-on-error: true

      - name: Trivy image scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'node:20-alpine'
          format: 'sarif'
          output: 'trivy-results.sarif'
        continue-on-error: true

      - name: Generate Security Report
        id: report
        run: |
          echo "## Security Weekly Report" >> $GITHUB_STEP_SUMMARY
          echo "- $(date -I)" >> $GITHUB_STEP_SUMMARY
          echo "- Node: $(node -v)" >> $GITHUB_STEP_SUMMARY
          npm audit --json 2>/dev/null | jq -r '.metadata.vulnerabilities | "### Vulnerabilities: critical=\(.critical) high=\(.high) moderate=\(.moderate)"' >> $GITHUB_STEP_SUMMARY || true

      - name: Create Issue (if vulnerabilities)
        if: failure() || success()
        uses: peter-evans/create-issue-from-file@v4
        with:
          title: "Security Weekly Report — $(date +%Y-%m-%d)"
          content-filepath: ${{ github.workspace }}/.github/SECURITY_REPORT_TEMPLATE.md
          labels: security, automated
        continue-on-error: true
```

**Вариант с PR (Dependabot-style):** отдельный workflow или скрипт, который:
- парсит `npm audit`, GHSA, CVE
- генерирует `package.json` diff
- создаёт PR через `peter-evans/create-pull-request`
- **мердж только вручную** + required reviews

---

## 2. AWS WAF — baseline для Next.js API

### Managed Rules (включить в WAF)

| Rule Set | Действие | Назначение |
|----------|----------|------------|
| AWSManagedRulesCommonRuleSet | Block | OWASP Core, injection, XSS |
| AWSManagedRulesKnownBadInputsRuleSet | Block | Bad inputs, path traversal |
| AWSManagedRulesSQLiRuleSet | Block | SQL injection |
| AWSManagedRulesLinuxRuleSet | Count → Block | Linux-specific attacks |

### Rate-based rules (примеры)

| Path pattern | Limit | Действие |
|--------------|-------|----------|
| `/api/auth/*` | 100 req/5min per IP | Block |
| `/api/agent/search` | 60 req/min per IP | Block |
| `/api/agent/export` | 20 req/min per IP | Block |
| `/api/files/upload` | 30 req/min per IP | Block |
| `/api/*` (default) | 300 req/5min per IP | Block |

### Дополнительно

- **Body size:** max 10 MB (для upload)
- **Methods:** разрешить GET, POST, PUT, PATCH, DELETE; блокировать TRACE, CONNECT
- **Geo:** при необходимости — блокировать нецелевые регионы

---

## 3. Security headers — Next.js baseline

Добавить в `next.config.mjs`:

```js
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // Next.js требует unsafe-eval в dev
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'self'",
    ].join('; '),
  },
];

const nextConfig = {
  // ... existing config
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
```

**Примечание:** CSP с `'unsafe-inline'`/`'unsafe-eval'` — временный baseline. Для production лучше nonce/hash.

---

## 4. Electron hardening checklist

Текущее состояние в `electron/main.js`:
- `loadURL`: только `http://127.0.0.1:3001` ✅
- `preload` + `contextBridge` ✅
- `nodeIntegration` / `contextIsolation` — не заданы явно (дефолты Electron 12+)

### Рекомендуемые явные настройки

```js
webPreferences: {
  preload: path.join(__dirname, "preload.js"),
  nodeIntegration: false,      // явно
  contextIsolation: true,      // явно (нужно для contextBridge)
  sandbox: true,               // если не ломает preload
  webSecurity: true,
  allowRunningInsecureContent: false,
}
```

### IPC allowlist (уже есть)

- `config:read`, `config:write`, `app:restart` — только эти каналы через `contextBridge` ✅

### Checklist (без поломок)

- [ ] `nodeIntegration: false`
- [ ] `contextIsolation: true`
- [ ] `sandbox: true` (проверить, что preload работает)
- [ ] Нет `remote`
- [ ] Подпись артефактов (code signing)
- [ ] `autoUpdater` с проверкой подписи (уже есть)

---

## 5. Пакет A — 1–2 дня

1. CloudFront + WAF managed rules + rate-based rules
2. Закрыть origin (ALB только от CloudFront)
3. CodeQL + Dependabot + gitleaks + Trivy в CI
4. `security-ai-weekly.yml` → issue/PR

## 6. Пакет B — 3–7 дней

1. Shield Advanced (по необходимости)
2. Bot Control
3. DAST на staging (OWASP ZAP)
4. SBOM + policy checks
5. Electron hardening + явные `webPreferences`
