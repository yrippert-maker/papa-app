# Локальный запуск

## Dev-скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev:stable` | Next на 3001 с очисткой кэша (rimraf) |
| `npm run dev:web` | Next на 3001 без очистки |
| `npm run dev:quick` | То же, алиас |
| `npm run dev:full` | Next + Electron (Electron стартует после готовности Next) |

Порт **3001** зафиксирован через `cross-env PORT=3001`.

## Если видишь ERR_CONNECTION_REFUSED

Проверь, что сервер слушает порт:

```bash
lsof -nP -iTCP:3001 -sTCP:LISTEN
```

Если пусто — сервер не запущен. Запусти `npm run dev:stable` и дождись `✓ Ready`.

## CI smoke-check

| Workflow | Описание | Артефакты при failure |
|----------|----------|------------------------|
| `smoke-next` | `dev:quick` + `/api/health` | summary.txt, smoke-next.log |
| `smoke-prod` | `next build` + `next start` + health | summary.txt, smoke-prod.log |
| `smoke-docker` | Docker image build + run + health | container.log, inspect.json, summary.txt |
| `smoke-electron` | Playwright + Electron API | error.txt, page.html, screenshot.png |

Рекомендуемый порядок: smoke-next → prod:smoke → docker:smoke → electron:smoke. См. [REQUIRED_CHECKS.md](REQUIRED_CHECKS.md) — какие checks делать required для main.

### Electron smoke: при падении

Артефакты в `/tmp/electron-smoke/` загружаются в GitHub Actions при failure:
- `error.txt` — stacktrace
- `console-errors.txt` — console.error + pageerror
- `url.txt` / `meta.txt` — URL окна
- `page.html` — DOM
- `screenshot.png` — скрин UI

При флаках "Missing X server" — добавить xvfb в workflow (см. комментарий в smoke-electron.yml).

## См. также

- [README.md](../../README.md) — быстрый старт
- [QUICKSTART_CURSOR.md](../QUICKSTART_CURSOR.md) — запуск из Cursor
