# Compliance Inbox — Accept → Proposal → Apply

Режим с двойным подтверждением: **Accept** фиксирует изменение и создаёт Patch Proposal; **Apply** вносит правки в DOCX (только по кнопке).

## State Machine

| Состояние    | Описание                                      |
|-------------|-----------------------------------------------|
| **NEW**     | Найдено мониторингом                          |
| **ACCEPTED**| —                                            |
| **PROPOSED**| Принято, создан patch proposal                |
| **APPLIED** | Патч применён в документы                     |
| **REJECTED**| Отклонено                                    |

## API

### Monitoring

- `POST /api/compliance/monitor/run` — запустить сбор (пока: test event)
- `GET /api/compliance/monitor/status` — последний run, кол-во новых

### Inbox

- `GET /api/compliance/inbox` — список изменений (?status=NEW&limit=50)
- `GET /api/compliance/inbox/:id` — детали + proposal (если есть)

### Decisions

- `POST /api/compliance/inbox/:id/accept` — принять → создать proposal  
  Body: `{ "comment": "...", "targets": [...] }`
- `POST /api/compliance/inbox/:id/reject` — отклонить  
  Body: `{ "comment": "..." }`

### Apply

- `POST /api/compliance/proposals/:id/apply` — применить proposal (единственная точка редактирования DOCX)

## Конфиг

- `config/ai-agent/document-map.json` — editable DOCX (QMS, ТОиР, СУБП)
- `apply_policy.mode`: `manual_apply_only`

## Скрипты

- `npm run docs:index` — строит inventory + section map по DOCX
- `npm run monitor:run` — создаёт test change event

## Ежемесячный scheduler

Документы локальные → GitHub Actions не подходит. Варианты:

1. **launchd** (macOS): раз в месяц вызывать  
   `curl -X POST http://localhost:3000/api/compliance/monitor/run`
2. **Tauri** (если приложение регулярно открывается): scheduler внутри приложения

## Схема БД

- `compliance_change_event` — изменения
- `compliance_patch_proposal` — предложения патчей
- `compliance_decision_log` — лог решений (accept/reject)
- `compliance_revision` — ревизии (до/после)

## Примечание

Редактирование DOCX: текущая реализация создаёт revision-записи с `before_sha256`. Реальное внесение правок в DOCX требует библиотеки (docx, mammoth и т.п.) — следующий шаг.
