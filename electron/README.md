# Electron (ПАПА desktop)

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run electron:dev` | Dev: окно + `next dev` |
| `npm run electron:prep` | Собрать bundle (standalone + static + public) в `electron/bundle` |
| `npm run electron:prod` | Локальный прогон «как в релизе» (build + prep + Electron с prod-сервером) |
| `npm run electron:build` | Сборка установщиков: build + prep + electron-builder → `dist/` |

## Оптимизация сборки

- **app.asar:** только `electron/main.js`, `electron/preload.js`, `package.json` — без лишних файлов.
- **extraResources:** копируется только `electron/bundle/standalone` → `papa-bundle/standalone` (без корневого package.json и env).
- **prep.js:** в bundle только standalone (сервер + `.next/static` + `public`); после копирования удаляются все `*.map`.
- **compression:** `maximum` (корень конфига).
- **Next:** `productionBrowserSourceMaps: false` в next.config — меньше размер .next.

## Env из userData

Env хранится в **userData/config.env**, не в resources. При первом запуске создаётся файл из шаблона `env.production.example`:

- **macOS:** `~/Library/Application Support/ПАПА/config.env`
- **Windows:** `%AppData%\ПАПА\config.env`

Пользователь или админ заполняет `NEXTAUTH_SECRET`, пароль и т.д., перезапускает приложение — без пересборки.

## Что в bundle (после prep)

```
electron/bundle/
└── standalone/         # Next.js standalone (server.js, .next, node_modules)
    ├── .next/static/
    └── public/         # если есть
```

Env — в userData/config.env. В extraResources попадает только `standalone/` → `papa-bundle/standalone`.

Папка `electron/bundle` в `.gitignore` — не коммитить.

## Проверка размера после сборки (итерация 0)

После `npm run electron:build`:

- **macOS:** `du -sh dist/mac/*.app/Contents/Resources/*`
- **Windows (PowerShell):** `Get-ChildItem dist\win-unpacked -Recurse | Measure-Object -Property Length -Sum`
- Размер `dist/*.dmg` и `dist/*Setup*.exe` — итоговый размер установщиков.

**Топ папок в standalone (что раздувает bundle):**
```bash
du -sh electron/bundle/standalone/* 2>/dev/null | sort -hr | head -20
du -sh electron/bundle/standalone/node_modules/* 2>/dev/null | sort -hr | head -20
```

## Очистка лишнего в prep (после копирования standalone)

В `prep.js` после копирования standalone удаляются папки/файлы, попавшие по trace, но не нужные в runtime: `Новая папка`, docs, data, dist, scripts, apps, services, __tests__, __fixtures__, migrations, config, schemas, contracts, types, electron, 00_SYSTEM, package-lock.json, tsconfig.tsbuildinfo, env.example, verify-summary.json, а также файлы .zip, .docx, .pdf, ~$*. Это даёт заметное уменьшение размера bundle (примерно с ~362 MB до ~330 MB).
