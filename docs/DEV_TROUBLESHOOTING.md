# Dev Troubleshooting

## ENOENT `.next/server/middleware-manifest.json`

**Симптом:** Next.js падает с ошибкой `ENOENT` при чтении `/.next/server/middleware-manifest.json`.

**Причина:** Битая или частично удалённая папка `.next` (например, после ручной очистки без пересборки).

**Решение:**
```bash
rm -rf .next
npm run dev
```

**Prod:** Всегда сначала `npm run build`, затем `npm run start`. Скрипт `prestart` блокирует `start` без build-артефактов.

**Почему:** Next генерирует `middleware-manifest.json` при сборке. Если `.next` удалена или повреждена, файл отсутствует.
