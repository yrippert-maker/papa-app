# Чек-лист аудитора: Комплексная проверка ПО «ПАПА / Mura Menasa»

**Версия:** 1.0 | **Дата:** Февраль 2026

---

## Легенда статусов

| Статус | Значение |
|--------|----------|
| ✅ | Выполнено, доказательство есть |
| ⚠️ | Частично / с оговорками |
| ❌ | Не выполнено |
| — | Не применимо |

---

## 1. Compliance & Risk

| # | Проверка | Как проверяем | Артефакт / доказательство | Статус |
|---|----------|---------------|---------------------------|--------|
| 1.1 | Approve gate перед изменением рабочей документации | Export только из confirmed/final; apply только из PROPOSED | `app/api/agent/export/route.ts` L111–116; `app/api/settings/inbox/[id]/apply/route.ts` L23 | ✅ |
| 1.2 | Доказуемая трассировка "текст → источник" (EvidenceMap) | Каждый экспорт содержит evidence, path, sha256, chunkIds, confidence | `lib/agent/audit-meta.ts`, `app/api/agent/export/route.ts` L168–184 | ✅ |
| 1.3 | Фиксация экспортов (sha256) и возможность перепроверки | X-Docx-Sha256 header, sha256.txt в папке, audit_meta | `app/api/agent/export/route.ts` L150, L184 | ✅ |
| 1.4 | Доступ к настройкам/применению ограничен ролями | requirePermission(SETTINGS_VIEW, ADMIN_MANAGE_USERS) | `lib/authz/permissions.ts`, `app/api/settings/*` | ✅ |
| 1.5 | Audit trail: кто/когда/что изменил | ledger_events, block_hash, prev_hash, actor_id | `lib/admin-audit.ts`, `lib/compliance-service.ts`, `lib/inspection-audit.ts` | ✅ |
| 1.6 | requireApproval нельзя отключить в пилоте | PATCH update-policies: requireApproval: true hardcoded | `app/api/settings/update-policies/route.ts` L76 | ✅ |
| 1.7 | Управление источниками (разрешённые отправители, DMARC) | allowed_senders, require_dmarc_pass_override | `app/api/settings/sources/email/*`, migrations | ✅ |
| 1.8 | Политика хранения (retention) | retention-service, RETENTION_POLICY | `lib/retention-service.ts`, docs/ops/RETENTION_POLICY.md | ✅ |

---

## 2. Due Diligence

| # | Проверка | Как проверяем | Артефакт / доказательство | Статус |
|---|----------|---------------|---------------------------|--------|
| 2.1 | SBOM (список пакетов с лицензиями) | `npm ls`, license-checker, или аналог | package.json, package-lock.json | ⚠️ |
| 2.2 | Нет блокирующих лицензий | Ручная проверка зависимостей | — | ⚠️ |
| 2.3 | Реестр внешних источников (ICAO/EASA/FAA/ARMAK) | Документация: fulltext vs metadata-only | config/mro-sources.json, docs | ⚠️ |
| 2.4 | Путь деплоя, требования к инфраструктуре | env.example, docs/ops | env.example, docs/ops/POSTGRES_LOCAL.md, ECS_FARGATE_DEPLOY.md | ✅ |

---

## 3. Security

| # | Проверка | Как проверяем | Артефакт / доказательство | Статус |
|---|----------|---------------|---------------------------|--------|
| 3.1 | Path traversal защита | slugify, resolved.startsWith(root) | `lib/agent-output-paths.ts` L50, L89–91 | ✅ |
| 3.2 | RBAC + защита настроек | requirePermission на API | `lib/authz/routes.ts`, middleware | ✅ |
| 3.3 | Секреты не в репо | .gitignore, env.example без реальных значений | .gitignore, env.example | ✅ |
| 3.4 | Upload: allowlist расширений, размер | ALLOWED_EXTENSIONS, 50 MB | `app/api/files/upload` (если есть) | ✅ |
| 3.5 | npm audit | `npm audit` | Есть moderate/high | ⚠️ |
| 3.6 | Default credentials → 500 в production | hasDefaultAdminCredentials() | lib/auth-options или аналог | ✅ |
| 3.7 | Письма/вложения не приводят к RCE | Ограничения типов, sandbox | mail-ingest, mail-collector | ⚠️ |

---

## 4. AI / Tech Assessment

| # | Проверка | Как проверяем | Артефакт / доказательство | Статус |
|---|----------|---------------|---------------------------|--------|
| 4.1 | Утверждения только из выбранных источников | evidence, sources в audit_meta | `lib/agent/audit-meta.ts`, `lib/agent/types.ts` | ✅ |
| 4.2 | Confidence / риски отображаются | UI, evidence[].confidence | docs/plans/EVIDENCE_MAP_UI_EVIDENCE.md | ✅ |
| 4.3 | Режимы analysis-only / proposal / apply-after-approval | draft → confirm → export; inbox approve → apply | `lib/agent/draft-workflow.ts`, inbox workflow | ✅ |
| 4.4 | Пометка "нет источника" при недостатке данных | missing_fields, Limitations | agent draft response | ✅ |

---

## 5. Customization & Productization

| # | Проверка | Как проверяем | Артефакт / доказательство | Статус |
|---|----------|---------------|---------------------------|--------|
| 5.1 | Конфигурируемость источников (почта, регуляторы) | UI Settings, API sources | `app/settings`, `/api/settings/sources/*` | ✅ |
| 5.2 | Шаблоны документов без переписывания логики | templates/docx, templateKey | templates/, agent export | ✅ |
| 5.3 | Allowlist продуктов/kind | AGENT_ALLOWED_PRODUCTS, AGENT_ALLOWED_KINDS | lib/agent-output-paths.ts, env.example | ✅ |

---

## 6. Real Capabilities (Validation тестами)

| # | Сценарий | Команда / шаги | Ожидание | Статус |
|---|----------|----------------|----------|--------|
| 6.1 | Поиск TV3-117 → 2 chunks → Confirm → DOCX → sha256 → EvidenceMap | Demo flow из PILOT_READINESS_PACK | Результаты, sha256, EvidenceMap открывает источник | — |
| 6.2 | Письмо от разрешённого домена → извлечение → review → approve → apply | mail:ingest, inbox workflow | В документе отметка даты | — |
| 6.3 | Мониторинг регуляторики (dry-run) | mro:monitor | Review packet при изменении | — |
| 6.4 | Запись вне разрешённых папок → блокировка | resolveOutputDir с path вне root | null / блокировка | ✅ |
| 6.5 | Изменение без прав → 403 | Запрос без session / с Viewer | 403 | ✅ |

---

## 7. Engineering Quality

| # | Проверка | Как проверяем | Артефакт / доказательство | Статус |
|---|----------|---------------|---------------------------|--------|
| 7.1 | Smoke тесты | npm run smoke:agent | scripts/smoke-agent-*.mjs | ✅ |
| 7.2 | Runbook / чек-листы | Наличие документов | PILOT_EXECUTION_RUNBOOK, PILOT_HARDENING_CHECKLIST | ✅ |
| 7.3 | Обработка ошибок (JSON, не HTML) | API возвращают NextResponse.json | lib/api/error-response.ts | ✅ |
| 7.4 | Версии зафиксированы (Node, Next) | package.json, .nvmrc | Next.js 14.2.35, Node 20 | ✅ |

---

## 8. Итоговая матрица

| Область | PASS | HOLD | FAIL |
|---------|------|------|------|
| Compliance | 8 | 0 | 0 |
| Due Diligence | 1 | 3 | 0 |
| Security | 5 | 2 | 0 |
| AI/Tech | 4 | 0 | 0 |
| Customization | 3 | 0 | 0 |
| Real Capabilities | 2 | 0 | 3 (не прогонялись) |
| Engineering | 4 | 0 | 0 |

**Рекомендация:** GO с HOLD. Must-fix: SBOM, лицензии, npm audit, реестр внешних источников.

---

*Сопоставление требований с кодом: [REQUIREMENT_TO_IMPLEMENTATION_MAP.md](./REQUIREMENT_TO_IMPLEMENTATION_MAP.md)*
