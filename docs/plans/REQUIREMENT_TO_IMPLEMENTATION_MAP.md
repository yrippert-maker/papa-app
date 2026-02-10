# Матрица соответствия: Требование → Реализация

**ТЗ:** Комплексная проверка ПО для собственника  
**Версия:** 1.0 | Февраль 2026

---

## 1. Compliance (ТЗ §3.1)

| Требование | Реализация | Файлы / сущности |
|------------|------------|-------------------|
| Audit trail: кто/когда/что изменил | ledger_events (event_type, payload_json, prev_hash, block_hash, actor_id, created_at) | `lib/admin-audit.ts`, `lib/compliance-service.ts`, `lib/inspection-audit.ts`, `lib/governance-policy-service.ts` |
| Approve gate перед изменением | draft → confirmed → final; export только из confirmed/final | `lib/agent/draft-workflow.ts`, `app/api/agent/export/route.ts` L111–116, `app/api/agent/confirm/route.ts` |
| Доказуемая трассировка "текст → источник" | EvidenceMap: evidence[], path, sha256, chunkIds, confidence | `lib/agent/audit-meta.ts`, `lib/agent/types.ts`, `app/api/agent/export/route.ts` L168–184 |
| Фиксация экспортов (sha256) | output_sha256, X-Docx-Sha256, sha256.txt в папке | `app/api/agent/export/route.ts` L150, L184 |
| Доступ к настройкам ограничен ролями | requirePermission(SETTINGS_VIEW, ADMIN_MANAGE_USERS) | `lib/authz/permissions.ts`, `lib/authz/routes.ts`, `app/api/settings/*` |
| requireApproval нельзя отключить | update-policies PATCH: requireApproval: true | `app/api/settings/update-policies/route.ts` L76 |
| Разрешённые отправители, DMARC | allowed_senders, require_dmarc_pass_override | `app/api/settings/sources/email/*`, migrations 014, 007 |
| Политика хранения | retention-service, RETENTION_POLICY | `lib/retention-service.ts`, docs/ops/RETENTION_POLICY.md |

---

## 2. Due Diligence (ТЗ §3.2)

| Требование | Реализация | Файлы / сущности |
|------------|------------|-------------------|
| SBOM | package.json, package-lock.json | Корень проекта |
| Лицензии зависимостей | Требуется: license-checker, npm ls | — |
| Внешние источники (ICAO/EASA/ARMAK) | config/mro-sources.json, config/inbox-sources.json | config/ |
| fulltext vs metadata-only | Требуется документирование | — |

---

## 3. Security (ТЗ §3.8)

| Требование | Реализация | Файлы / сущности |
|------------|------------|-------------------|
| Path traversal защита | slugify(), resolved.startsWith(root) | `lib/agent-output-paths.ts` L50, L89–91, L139–141 |
| RBAC | Permissions, requirePermission, rbac_role | `lib/authz/permissions.ts`, `lib/authz.ts`, migrations |
| Секреты в ENV | env.example без реальных значений, .gitignore | env.example, .gitignore |
| Upload allowlist | ALLOWED_EXTENSIONS, DANGEROUS_EXTENSIONS, 50 MB | docs/SECURITY_POSTURE.md, api/files/upload |
| Default credentials → 500 | hasDefaultAdminCredentials() в production | lib/auth-options, workspace status |
| SAST / dependency scan | npm audit | Известные уязвимости в roadmap |

---

## 4. AI / Tech (ТЗ §3.4, §3.5)

| Требование | Реализация | Файлы / сущности |
|------------|------------|-------------------|
| Только на основе выбранных документов | evidence[], sources в draft/export | `lib/agent/draft-workflow.ts`, `lib/agent/audit-meta.ts` |
| Confidence / риски | evidence[].confidence, missing_fields | `lib/agent/types.ts`, UI |
| EvidenceMap | path, sha256, chunkIds → оригинальный документ | `lib/agent/audit-meta.ts`, export evidencemap.json |
| workflow_schema_version, agent_version | audit_meta в confirm/export | `lib/agent/audit-meta.ts` |
| Режимы analysis / proposal / apply | draft → confirm → export; inbox approve → apply | `app/api/agent/*`, `app/api/settings/inbox/*` |

---

## 5. Customization (ТЗ §3.3)

| Требование | Реализация | Файлы / сущности |
|------------|------------|-------------------|
| Конфигурируемость источников | Settings UI, /api/settings/sources/email, regulatory | `app/settings`, `app/api/settings/sources/*` |
| Шаблоны документов | templates/docx (letter, act, techcard) | templates/docx/ |
| Allowlist продуктов/kind | AGENT_ALLOWED_PRODUCTS, AGENT_ALLOWED_KINDS | `lib/agent-output-paths.ts`, env.example |
| Маршрутизация папок | normalizeOutputRoute, resolveOutputDir | `lib/agent-output-paths.ts` |

---

## 6. Real Capabilities (ТЗ §3.6)

| Сценарий | Реализация | Команды / эндпоинты |
|----------|------------|---------------------|
| Поиск → chunks → Confirm → DOCX → sha256 → EvidenceMap | Agent search, draft, confirm, export | `/api/agent/search`, `/api/agent/draft`, `/api/agent/confirm`, `/api/agent/export` |
| Письмо → извлечение → review → approve → apply | compliance-inbox-service, mail:ingest | `/api/settings/inbox/*`, scripts/mail-ingest.mjs |
| Мониторинг регуляторики | mro-monitor | scripts/mro-monitor.mjs |
| Запись вне папок → блокировка | resolveOutputDir, assertEtalonsWriteAllowed | `lib/agent-output-paths.ts` |
| Изменение без прав → 403 | requirePermission | lib/authz, middleware |

---

## 7. Engineering Quality (ТЗ §3.7)

| Требование | Реализация | Файлы / сущности |
|------------|------------|-------------------|
| Smoke тесты | smoke:agent (perms, index, outputs) | scripts/smoke-agent-*.mjs |
| Runbook / чек-листы | PILOT_EXECUTION_RUNBOOK, PILOT_HARDENING_CHECKLIST | docs/plans/ |
| Обработка ошибок (JSON) | badRequest, forbidden, NextResponse.json | `lib/api/error-response.ts` |
| Версии зафиксированы | Next.js 14.2.35, Node 20 | package.json |

---

## 8. Ключевые таблицы / сущности (модель данных)

| Сущность | Назначение |
|----------|------------|
| ledger_events | Audit trail: event_type, payload_json, prev_hash, block_hash, actor_id |
| users | Пользователи, role_code, is_active |
| rbac_role, rbac_permission | Роли и права |
| allowed_senders | Разрешённые email-отправители |
| regulatory_sources | Источники регуляторики |
| agent_generated_documents | Черновики агента (Postgres): status, evidence, audit_meta |
| doc_metadata, doc_chunks | Индекс документов (SQLite FTS5 / pgvector) |
| settings_update_policies | Политики обновлений (email, regulatory, processing, audit) |

---

## 9. Внешние сервисы

| Сервис | Назначение | ENV |
|--------|------------|-----|
| OpenAI | Эмбеддинги (pgvector) | OPENAI_API_KEY |
| Ollama | Офлайн эмбеддинги | OLLAMA_BASE_URL |
| IMAP | Почта | MAIL_* |
| Blockchain (Polygon) | Anchoring | ANCHORING_* |
| S3/GCS | Ledger bucket (опционально) | LEDGER_BUCKET |

---

*Связанные документы: [OWNER_EXECUTIVE_BRIEF.md](./OWNER_EXECUTIVE_BRIEF.md), [AUDITOR_CHECKLIST.md](./AUDITOR_CHECKLIST.md)*
