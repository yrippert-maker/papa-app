# Пакет для регулятора и руководства

**Назначение:** единая точка входа для аудиторов, регуляторов и руководства.

---

## Ключевые документы

| Документ | Назначение |
|----------|------------|
| [CERTIFICATION_BRIEF.md](CERTIFICATION_BRIEF.md) | Краткий обзор системы и контуров сертификации |
| [RESPONSIBILITY_MATRIX.md](RESPONSIBILITY_MATRIX.md) | Роли, разрешения, запреты, юридическая ответственность, аудит |
| [MASTER_TZ_AI_CERTIFICATION_v1.0.md](MASTER_TZ_AI_CERTIFICATION_v1.0.md) | Базовое ТЗ (baseline v1.0) |
| [SECURITY_POSTURE.md](SECURITY_POSTURE.md) | Безопасность, чеклист production |

---

## Ответы на типовые вопросы

**Кто несёт ответственность за решения?**  
Оператор и пользователь. Система — инструмент. AI не является субъектом ответственности.

**Есть ли человеческий контроль над AI?**  
Да. Human-in-the-loop: AI read-only; автоматические действия без подтверждения человека запрещены.

**Как верифицируется неизменяемость данных?**  
Hash-chain в ledger; аудит событий с привязкой к пользователю.

**Какой стандарт применим?**  
Определяется организацией. Документы подготовлены для адаптации под внутренний, авиационный (MRO), ISO.

---

## SQLite Safe Mode (US-8)

**Что включено:**
- **PRAGMA baseline:** `foreign_keys=ON`, `recursive_triggers=OFF`, `trusted_schema=OFF`, `busy_timeout=5000`, `journal_mode=WAL` (readwrite)
- **Read-only соединения:** все read-endpoints (списки, пагинация, проверки) используют `getDbReadOnly()`
- **Write — только авторизованные:** admin, ledger append, file upload — через `getDb()` с `withRetry` на SQLITE_BUSY
- **load_extension:** запрещён (тест AC3)
- **Offset cap:** max 10 000 для анти-DoS
- **Limit cap:** max 100 (US-7)

**Где реализовано:**
- `lib/db/sqlite.ts` — единая точка открытия соединений, PRAGMA, `withRetry`
- `lib/db.ts` — `getDb()` (readwrite), `getDbReadOnly()` (readonly)
- `lib/pagination.ts` — MAX_OFFSET

**Тесты:**
- Unit: PRAGMA baseline, load_extension forbidden, withRetry на SQLITE_BUSY, offset cap
- E2E: регрессия read/write endpoints

**Гарантия non-autonomy / least privilege:** AI-facing доступ (когда будет) — только через `getDbReadOnly()`, физически не может выполнять INSERT/UPDATE/DELETE.

**Evidence map:** тесты, подтверждающие AC, перечислены в [ENDPOINT_DB_EVIDENCE.md](ENDPOINT_DB_EVIDENCE.md) (таблица Endpoint→DB Mode→Evidence).

**Operational constraint:** DB write доступен только через human-authorized routes. Все write-операции — результат явного действия пользователя; AI не имеет прямого доступа на запись. См. [ENDPOINT_DB_EVIDENCE.md](ENDPOINT_DB_EVIDENCE.md).

**Runtime fingerprint:** шаблон для аудита/сертификации (OS, Node, SQLite, PRAGMA) — [RELEASE_NOTES_v0.1.1.md](RELEASE_NOTES_v0.1.1.md) § Runtime fingerprint. Все evidence-документы в данном релизе сгенерированы и верифицированы под указанным runtime fingerprint.

**Regulatory submission bundle:** `npm run bundle:regulatory` → `dist/regulatory-bundle-v0.1.1.zip`. Список: [REGULATORY_BUNDLE_MANIFEST.md](REGULATORY_BUNDLE_MANIFEST.md). Verification protocol: распаковать → проверить sha256 по MANIFEST.txt → открыть BUNDLE_FINGERPRINT.md.

---

## Access Control & Authorization (v0.1.2)

**Модель:** RBAC, permission-first. Endpoint'ы проверяют permission, а не роль напрямую.

**Документы:**
- [AUTHZ_MODEL.md](AUTHZ_MODEL.md) — нормативная модель ролей и permissions
- [ENDPOINT_AUTHZ_EVIDENCE.md](ENDPOINT_AUTHZ_EVIDENCE.md) — Endpoint → Permission → Roles → Evidence

**Принципы:**
- Deny-by-default: endpoint без явной проверки permission — недоступен
- Least privilege: роли получают минимально необходимый набор permissions
- 401 — не аутентифицирован; 403 — аутентифицирован, но нет permission

**Evidence:** unit-тесты (authz), E2E (auditor 403 на admin/write), route registry (deny-by-default). Bundle включает `AUTHZ_VERIFY_RESULT.txt` — результат проверки route registry и permissions; AuthZ подтверждена, если `authz_verification.executed = true` и `authz_verification.authz_ok = true`.

---

## Контакт

Вопросы по документам — владелец проекта / главный инженер.
