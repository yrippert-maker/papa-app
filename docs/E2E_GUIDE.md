# E2E Smoke — руководство

## Порты

- **dev:** `3000` (`npm run dev`)
- **e2e:** `3100` по умолчанию (настраивается через `E2E_PORT`)

E2E запускает свой сервер и требует, чтобы порт был свободен. Остановите `npm run dev` перед `npm run test:e2e` или задайте другой порт.

## Запуск

```bash
npm run e2e
# или
npm run test:e2e
```

## Настройка порта

```bash
E2E_PORT=3200 npm run test:e2e
```

## Если порт занят (EADDRINUSE)

### Освободить порт 3000 (dev)

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
kill -TERM <PID>
```

### Освободить порт 3100 (e2e default)

```bash
lsof -nP -iTCP:3100 -sTCP:LISTEN
kill -TERM <PID>
```

### Проверка

```bash
lsof -nP -iTCP:3100 -sTCP:LISTEN || echo "port 3100 is free"
```
