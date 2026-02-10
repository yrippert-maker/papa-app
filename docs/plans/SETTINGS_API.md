# SETTINGS API — OpenAPI-style (MVP)

**Base path:** `/api/settings`  
**Auth:** сессия обязательна; доступ по ролям (Owner/Admin — всё; Operator/Reviewer — read-only где указано).

---

## 1) Управление доступом (Users & Roles)

| Method | Path | Доступ | Описание |
|--------|------|--------|----------|
| GET | `/api/settings/users` | Owner/Admin | Список пользователей |
| POST | `/api/settings/users` | Owner/Admin | Создать пользователя |
| PATCH | `/api/settings/users/{id}` | Owner/Admin | Изменить роль/active (id = `u_<numeric>`) |
| DELETE | `/api/settings/users/{id}` | Owner/Admin | Удалить (запрещено удалять последнего Owner) |

**GET response:**
```json
[
  { "id": "u_1", "email": "admin@local", "role": "Owner", "active": true, "lastLoginAt": null }
]
```

**POST body:** `{ "email": "operator@company.com", "role": "Operator" }`  
**PATCH body:** `{ "role": "Reviewer", "active": true }`  

Роли в API: **Owner**, **Admin**, **Operator**, **Reviewer**, **Viewer** (маппинг на внутренние role_code: OWNER, ADMIN, MANAGER, ENGINEER, AUDITOR).

---

## 2) Источники писем (Allowlist)

| Method | Path | Доступ | Описание |
|--------|------|--------|----------|
| GET | `/api/settings/sources/email` | Owner/Admin (Operator read-only) | Список правил |
| POST | `/api/settings/sources/email` | Owner/Admin | Добавить правило |
| PATCH | `/api/settings/sources/email/{id}` | Owner/Admin | Изменить (частично) |
| DELETE | `/api/settings/sources/email/{id}` | Owner/Admin | Удалить |

**POST body (camelCase):**
```json
{
  "type": "domain",
  "value": "mak.ru",
  "label": "ARMAK",
  "enabled": true,
  "requireDmarcPass": true,
  "autoCollect": true,
  "autoAnalyze": true,
  "requireApproval": true
}
```

---

## 3) Регуляторные источники (ICAO/EASA/FAA/ARMAK)

| Method | Path | Доступ | Описание |
|--------|------|--------|----------|
| GET | `/api/settings/sources/regulatory` | Owner/Admin | Список |
| POST | `/api/settings/sources/regulatory` | Owner/Admin | Добавить |
| PATCH | `/api/settings/sources/regulatory/{id}` | Owner/Admin | Изменить |
| DELETE | `/api/settings/sources/regulatory/{id}` | Owner/Admin | Удалить |

**POST body:**
```json
{
  "authority": "ARMAK",
  "docId": "AP-145",
  "url": "https://armak-iac.org/...",
  "enabled": true,
  "downloadMode": "fulltext",
  "monitoring": "monthly"
}
```

---

## 4) Режимы обновлений (Global policies, singleton)

| Method | Path | Доступ | Описание |
|--------|------|--------|----------|
| GET | `/api/settings/update-policies` | Owner/Admin | Текущие политики (nested) |
| PATCH | `/api/settings/update-policies` | Owner/Admin | Обновить (requireApproval нельзя выключить в пилоте) |

**GET response:**
```json
{
  "email": { "mode": "scheduled", "intervalMin": 60, "requireDmarcPass": true },
  "regulatory": { "mode": "scheduled", "schedule": { "type": "monthly", "day": 1, "hour": 9 } },
  "processing": {
    "autoCollect": true,
    "autoAnalyze": true,
    "requireApproval": true,
    "autoApplyAfterApproval": false
  },
  "audit": { "enabled": true, "retainRawDays": 365 }
}
```

---

## 5) Inbox / Review workflow

| Method | Path | Доступ | Описание |
|--------|------|--------|----------|
| GET | `/api/settings/inbox` | Owner/Admin, Operator read-only | Список. Фильтры: `status=NEW|ANALYZED|APPROVED|REJECTED`, `source=ARMAK` |
| POST | `/api/settings/inbox/{id}/analyze` | Operator/Admin | Формирует Review Packet |
| POST | `/api/settings/inbox/{id}/approve` | Reviewer/Operator/Admin | Approve (accept → proposal) |
| POST | `/api/settings/inbox/{id}/reject` | Reviewer/Operator/Admin | Reject |
| POST | `/api/settings/inbox/{id}/apply` | Operator/Admin | Применить патч (новая версия, sha256, EvidenceMap) |

---

## 6) Артефакты и размещение

Сервер строит путь сам (агент не передаёт абсолютные пути):

```
AGENT_OUTPUT_ROOT/
  <SOURCE>/<YYYY-MM>/
    review_packet/
    approved_patch/
      <doc_slug>/
        document_vYYYY-MM-DD.docx
        evidencemap.json
        sha256.txt
        ...
```

Попытка записи вне `AGENT_OUTPUT_ROOT` → 400.

---

## 7) Desktop-уведомления (macOS)

| Method | Path | Доступ | Описание |
|--------|------|--------|----------|
| POST | `/api/settings/notifications/desktop` | SETTINGS.VIEW | Показать уведомление (osascript) |

**Body:** `{ "title": "ARMAK update", "body": "AP-145 changed. Review packet ready." }`

---

## 8) Роли и права (минимум)

- **Owner:** всё
- **Admin:** всё, кроме передачи ownership
- **Operator:** analyze / apply
- **Reviewer:** approve / reject
- **Viewer:** read-only

---

## 9) Smoke-checks

- `smoke:agent:perms` — ACL ok
- `smoke:agent:index` — FTS ok
- `smoke:agent:outputs` — запись только в `AGENT_OUTPUT_ROOT`
