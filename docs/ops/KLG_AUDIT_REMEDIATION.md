# Выполнение рекомендаций аудита KLG ASUTK (8 февраля 2026)

## Выполнено

### SEC-001: API-ключ OpenAI в .env.local
- **Статус:** ✅ .gitignore уже содержит `.env*.local` — файл не попадёт в репозиторий
- **Рекомендация:** Ротировать ключ через platform.openai.com, если он когда-либо был скомпрометирован

### SEC-002: Dev-токен / Dev admin
- **Статус:** ✅ Выполнено
- Добавлена переменная `ENABLE_DEV_AUTH=false` для production
- В `lib/auth-options.ts`: dev-admin разрешён только при `ENABLE_DEV_AUTH !== "false"`
- В `middleware.ts`: SKIP_AUTH_FOR_ROOT проверяет `ENABLE_DEV_AUTH`
- В `env.production.example` и `env.example` добавлена документация

### SEC-004: API routes без аутентификации
- **Статус:** ✅ Проект papa-app: каждый API route использует `getServerSession` + `requirePermission`
- Публичные пути (health, metrics, anchoring/health) — по замыслу без auth, ограничиваются на proxy/ingress

## Не применимо к papa-app

| ID | Проблема | Причина |
|----|----------|---------|
| SEC-003 | SQL Injection в risingwave.py | Файл отсутствует в проекте |
| ARC-002 | main.py не подключает все роутеры | Нет FastAPI backend |
| SEC-005 | CORS Allow-Origin: * | aero-flight-compass не в papa-app |
| ARC-003 | Избыточный стек (RisingWave и др.) | papa-app использует PostgreSQL/SQLite |

## Рекомендации на эту неделю

1. **Production:** Установить `ENABLE_DEV_AUTH=false` в Railway/Vercel/ Electron config
2. **OpenAI:** Ротировать ключ, если .env.local когда-либо попадал в Git
3. **Мониторинг:** health/metrics — ограничить доступ на ALB/CloudFront (IP allowlist или basic auth)
