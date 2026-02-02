# Runbook: Evidence Verification

## Симптомы

- Alert `EvidenceVerifyErrors` сработал
- Пользователи сообщают о невалидных evidence
- Метрика `papa_evidence_verify_total{result!="ok"}` растёт

---

## Диагностика

### 1. Проверить метрики

```bash
curl -s http://localhost:3000/api/metrics | grep evidence_verify
```

Разбор по типу ошибки:
```
papa_evidence_verify_total{result="ok"} 150
papa_evidence_verify_total{result="key_revoked"} 3
papa_evidence_verify_total{result="key_not_found"} 1
papa_evidence_verify_total{result="signature_invalid"} 2
papa_evidence_verify_total{result="content_invalid"} 0
```

### 2. Типы ошибок

| Код | Значение | Severity |
|-----|----------|----------|
| `ok` | Верификация успешна | — |
| `content_invalid` | Hash не совпадает | High |
| `key_revoked` | Ключ отозван | Info/Security |
| `key_not_found` | Ключ не найден | Medium |
| `signature_invalid` | Подпись не совпадает | High |
| `rate_limited` | Превышен rate limit | Info |
| `unauthorized` | Нет прав | Info |

---

## Разбор ошибок

### KEY_REVOKED

**Что это:** Ключ, которым подписан evidence, был отозван.

**Возможные причины:**
1. Клиент проверяет старый evidence (нормально)
2. Кто-то пытается использовать отозванный ключ (подозрительно)

**Действия:**
1. Проверить `key_id` из запроса
2. Найти причину отзыва:
   ```bash
   cat $WORKSPACE_ROOT/00_SYSTEM/keys/archived/{key_id}/revoked.json
   ```
3. Если частые запросы с одним key_id — возможная атака

**Не требует действий если:**
- Единичные запросы
- Старые evidence (до ротации ключей)

---

### KEY_NOT_FOUND

**Что это:** Ключ с указанным `key_id` не найден ни в active, ни в archived.

**Возможные причины:**
1. Evidence от другой системы / environment
2. Ключ был удалён (нарушение retention policy)
3. Некорректный `key_id`

**Действия:**
1. Проверить существующие ключи:
   ```bash
   ls $WORKSPACE_ROOT/00_SYSTEM/keys/active/
   ls $WORKSPACE_ROOT/00_SYSTEM/keys/archived/
   ```
2. Сравнить `key_id` из запроса с доступными
3. Если ключ от другого env — сообщить клиенту

**⚠️ Если ключ был удалён:**
- Это нарушение retention policy
- Восстановить из backup
- Создать incident report

---

### SIGNATURE_INVALID

**Что это:** Подпись не совпадает с export_hash.

**Возможные причины:**
1. Evidence был изменён после подписания (tampering)
2. Неверный public key
3. Ошибка при копировании/передаче файлов

**Действия:**
1. Запросить оригинальный evidence bundle у клиента
2. Проверить целостность ZIP:
   ```bash
   unzip -t evidence.zip
   ```
3. Сравнить hashes:
   ```bash
   # Из export.json
   cat export.json | jq '.export_hash'
   
   # Пересчитать (требует скрипт)
   ```

**Если множественные запросы:**
- Возможная атака
- Проверить source IPs
- Рассмотреть временный ban

---

### CONTENT_INVALID

**Что это:** Пересчитанный hash не совпадает с `export_hash` в файле.

**Что это значит:**
- `export.json` был изменён после генерации
- Или ошибка при генерации (баг)

**Действия:**
1. Если единичный случай — проблема на стороне клиента
2. Если массовые — проверить код генерации evidence

---

## Traffic Anomaly

### Симптомы
- Alert `EvidenceVerifyTrafficAnomaly`
- Rate > 2 req/s sustained

### Диагностика

```bash
# Проверить source IPs (требует access log)
grep "evidence/verify" /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -rn | head
```

### Действия

1. **Если один IP:** Возможный бот/scraper
   - Временный ban через nginx/firewall
   - Снизить rate limit

2. **Если множество IPs:** Возможный DDoS
   - Включить WAF rules
   - Эскалация на security team

---

## Key Rotation

### Когда ротировать

- По расписанию (рекомендация: ежеквартально)
- При смене персонала с доступом к keys
- При подозрении на компрометацию

### Как ротировать

```typescript
import { rotateKeys } from '@/lib/evidence-signing';

const { keyId, publicKey } = rotateKeys();
console.log('New key:', keyId);
```

Или через CLI (если есть):
```bash
npm run keys:rotate
```

### После ротации

- [ ] Новый ключ в active/
- [ ] Старый ключ в archived/{old_key_id}/
- [ ] Verify работает для старых и новых evidence

---

## Key Revocation

### Когда отзывать

- Ключ скомпрометирован
- Несанкционированный доступ к private key
- Требование security audit

### Как отозвать

```typescript
import { revokeKey } from '@/lib/evidence-signing';

// Сначала ротировать
rotateKeys();

// Затем отозвать старый
revokeKey(oldKeyId, 'compromised - security incident #123');
```

### ⚠️ ВАЖНО

- **Нельзя отозвать активный ключ** — сначала `rotateKeys()`
- После отзыва все evidence с этим ключом будут выдавать `KEY_REVOKED`
- Это нормальное поведение, не баг

---

## Атака vs Ошибка клиента

### Признаки атаки

| Паттерн | Вероятность атаки |
|---------|-------------------|
| Один IP, высокий rate | High |
| Много разных signature | High (fuzzing) |
| Один и тот же revoked key | Medium |
| Разные key_ids, все не найдены | Medium (enumeration) |

### Признаки ошибки клиента

| Паттерн | Вероятность |
|---------|-------------|
| Единичный запрос | High |
| Клиент сообщает о проблеме | High |
| Старый evidence (>1 года) | High |

---

## Эскалация

| Ситуация | Эскалация |
|----------|-----------|
| Единичные ошибки | Нет |
| KEY_REVOKED spike | Security team |
| SIGNATURE_INVALID spike | Security + Dev |
| KEY_NOT_FOUND (удалённый ключ) | Dev + Incident |
| Traffic anomaly | Security + Ops |

---

## См. также

- [EVIDENCE_SIGNING.md](./EVIDENCE_SIGNING.md) — техническое описание
- [ALERTS_COMPLIANCE.md](./ALERTS_COMPLIANCE.md) — алерты
- [RETENTION_POLICY.md](./RETENTION_POLICY.md) — политика хранения
