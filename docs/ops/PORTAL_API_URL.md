# Настройка PORTAL_API_URL

**Проблема:** Раздел «Документы → Mura Menasa» показывает ошибку `PORTAL_API_URL not configured`.

**Причина:** Переменная окружения `PORTAL_API_URL` не задана.

## Решение

### 1. Railway Dashboard

1. Перейти на https://railway.app/dashboard
2. Найти проект (papa-app-production)
3. Открыть сервис (web service)
4. Вкладка **Variables** → **New Variable**
5. Добавить:

```
PORTAL_API_URL=https://papa-app-production.up.railway.app
```

Или, если Portal API — отдельный сервис:

```
PORTAL_API_URL=https://papa-portal-production.up.railway.app
```

6. Railway автоматически перезапустит приложение
7. Дождаться завершения deploy (1–3 мин)

### 2. Локальная разработка

```bash
# В .env.local:
PORTAL_API_URL=http://localhost:8790
```

Запустить Portal API отдельно:

```bash
npm run portal:api:dev
```

### 3. Альтернатива: Railway CLI

```bash
railway login
railway variables set PORTAL_API_URL=https://papa-app-production.up.railway.app
```

## Загрузка документов Mura Menasa

После настройки PORTAL_API_URL необходимо загрузить 4 документа в Document Store:

| ID | Документ | Издание | Файл |
|----|----------|---------|------|
| MM-01 | Руководство по качеству (Quality Manual) | Изд. 4 | RK_MMF_Izd4_final_corrected_v2.docx |
| MM-02 | Руководство по процедурам ТОиР (MOPM) | Изд. 3 | Руководство_по_Процедурам_ТОиР_MMF_изд_3.docx |
| MM-03 | Руководство по СУБП (SMS Manual) | Изд. 1 | Руководство_по_СУБП_MMF_изд_1.docx |
| MM-04 | Реестр рисков (Safety Risk Register) | 12-2025 | Реестр_рисков_MMF_12-2025.docx |

Загрузка через API Portal или админ-панель (если есть). См. `services/auditor-portal-api` для endpoints `/v1/docs/*`.

## Проверка

```bash
# Список документов
curl -s "https://papa-app-production.up.railway.app/api/docs/list" | jq .

# Проверка health
curl -s "https://papa-app-production.up.railway.app/api/health" | jq .
```

Открыть `/documents/mura-menasa/handbook` — ошибка должна исчезнуть.

## Troubleshooting

| Проблема | Решение |
|----------|---------|
| Порт 503 после настройки | Убедиться, что redeploy завершён; очистить кэш браузера (Ctrl+Shift+R) |
| API возвращает 404 | Проверить URL; Portal API должен иметь `/v1/docs/get`, `/v1/docs/list`, `/v1/docs/versions` |
| Документы не отображаются | Убедиться, что store = `mura-menasa/handbook` и документы загружены в S3 |
