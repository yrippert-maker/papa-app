# Compliance Alerts

## Обзор

Примеры Prometheus алертов для compliance-контуров. Интегрируются с Alertmanager или аналогами.

---

## 1. Dead-Letter Growth

**Симптом:** Появились записи в dead-letter файле.

```yaml
- alert: LedgerDeadLetterGrowth
  expr: increase(papa_ledger_dead_letter_events_total[15m]) > 0
  for: 0m
  labels:
    severity: warning
    component: ledger
  annotations:
    summary: "Dead-letter events detected"
    description: "{{ $value }} new dead-letter events in last 15 minutes"
    runbook: "https://docs/ops/RUNBOOK_LEDGER_DEAD_LETTER.md"
```

**Severity:** `warning`

**Действия:**
1. Проверить статус DB: `npm run db:status` или dashboard
2. Проверить логи ledger append
3. Запустить `npm run replay:dead-letter -- --dry-run`
4. Если dry-run OK: `npm run replay:dead-letter`

---

## 2. Dead-Letter Replay Failed

**Симптом:** Replay не смог обработать события.

```yaml
- alert: LedgerDeadLetterReplayFailed
  expr: increase(papa_ledger_dead_letter_replay_total{result="failed"}[1h]) > 0
  for: 0m
  labels:
    severity: critical
    component: ledger
  annotations:
    summary: "Dead-letter replay failed"
    description: "{{ $value }} replay failures in last hour"
    runbook: "https://docs/ops/RUNBOOK_LEDGER_DEAD_LETTER.md#replay-failures"
```

**Severity:** `critical`

**Действия:**
1. Проверить причину в логах replay
2. Проверить доступность API
3. Ручной анализ dead-letter записей

---

## 3. Evidence Verify Error Spike

**Симптом:** Рост ошибок верификации evidence.

```yaml
- alert: EvidenceVerifyErrors
  expr: rate(papa_evidence_verify_total{result!="ok"}[5m]) > 0
  for: 5m
  labels:
    severity: warning
    component: evidence
  annotations:
    summary: "Evidence verification errors detected"
    description: "Verify errors: {{ $labels.result }}"
    runbook: "https://docs/ops/RUNBOOK_EVIDENCE_VERIFY.md"
```

### По типу ошибки

```yaml
# KEY_REVOKED — security event, не ошибка системы
- alert: EvidenceVerifyKeyRevoked
  expr: increase(papa_evidence_verify_total{result="key_revoked"}[1h]) > 5
  labels:
    severity: info
    type: security
  annotations:
    summary: "Evidence verified with revoked key"
    description: "Someone trying to verify evidence signed with revoked key"

# SIGNATURE_INVALID — возможная атака или повреждение
- alert: EvidenceVerifySignatureInvalid
  expr: rate(papa_evidence_verify_total{result="signature_invalid"}[5m]) > 0.1
  labels:
    severity: warning
    type: security
  annotations:
    summary: "Invalid signature attempts"
    description: "Possible tampering or corruption"

# KEY_NOT_FOUND — ключ не найден (старый или несуществующий)
- alert: EvidenceVerifyKeyNotFound
  expr: increase(papa_evidence_verify_total{result="key_not_found"}[1h]) > 10
  labels:
    severity: warning
  annotations:
    summary: "Evidence verification with unknown key"
```

---

## 4. Evidence Verify Traffic Anomaly

**Симптом:** Аномальный рост запросов на верификацию (возможный abuse).

```yaml
- alert: EvidenceVerifyTrafficAnomaly
  expr: rate(papa_evidence_verify_total[1m]) > 2
  for: 5m
  labels:
    severity: warning
    type: abuse
  annotations:
    summary: "Abnormal evidence verify traffic"
    description: "{{ $value }} req/s - possible abuse or bot"
    runbook: "https://docs/ops/RUNBOOK_EVIDENCE_VERIFY.md#traffic-anomaly"
```

**Действия:**
1. Проверить source IPs в логах
2. При необходимости — временный ban
3. Рассмотреть снижение rate limit

---

## 5. Rate Limit Triggered

**Симптом:** Клиенты получают 429.

```yaml
- alert: EvidenceVerifyRateLimited
  expr: increase(papa_evidence_verify_total{result="rate_limited"}[5m]) > 10
  labels:
    severity: info
  annotations:
    summary: "Rate limiting active on evidence verify"
    description: "{{ $value }} rate-limited requests in 5 minutes"
```

**Severity:** `info` (ожидаемое поведение при abuse)

---

## 6. Retention Enforcement Alerts

**Симптом:** `npm run retention:check` вернул exit code 2 (violations found).

### Bash/Cron Integration

```bash
#!/bin/bash
# /etc/cron.daily/papa-retention-check

cd /app

# Run retention check and capture output
OUTPUT=$(npm run retention:json 2>&1)
EXIT_CODE=$?

# Log output
echo "$OUTPUT" >> /var/log/papa-retention.log

# Alert on violations (exit code 2)
if [ $EXIT_CODE -eq 2 ]; then
  # Send alert via webhook/email/slack
  curl -X POST "$ALERT_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"alert\": \"RetentionViolation\",
      \"severity\": \"warning\",
      \"exit_code\": $EXIT_CODE,
      \"timestamp\": \"$(date -Iseconds)\",
      \"report\": $OUTPUT
    }"
fi

# Alert on errors (exit code 1)
if [ $EXIT_CODE -eq 1 ]; then
  curl -X POST "$ALERT_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"alert\": \"RetentionError\",
      \"severity\": \"critical\",
      \"exit_code\": $EXIT_CODE,
      \"timestamp\": \"$(date -Iseconds)\"
    }"
fi
```

### CI/GitHub Actions

```yaml
# .github/workflows/retention-check.yml
name: Retention Check
on:
  schedule:
    - cron: '0 6 * * *'  # Daily at 6 AM
  workflow_dispatch:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - name: Retention Check
        id: retention
        continue-on-error: true
        run: |
          npm run retention:json > retention-report.json
          echo "exit_code=$?" >> $GITHUB_OUTPUT
      
      - name: Upload Report
        uses: actions/upload-artifact@v4
        with:
          name: retention-report
          path: retention-report.json
      
      - name: Alert on Violation
        if: steps.retention.outputs.exit_code == '2'
        run: |
          echo "::warning::Retention violations found!"
          cat retention-report.json
      
      - name: Fail on Error
        if: steps.retention.outputs.exit_code == '1'
        run: exit 1
```

### Exit Codes Reference

| Exit Code | Meaning | Severity | Action |
|-----------|---------|----------|--------|
| 0 | OK | — | None |
| 1 | Error | critical | Investigate immediately |
| 2 | Violations found | warning | Run `npm run retention:run` |

---

## 7. Prometheus Targets

### Метрики

| Metric | Type | Labels |
|--------|------|--------|
| `papa_ledger_dead_letter_events_total` | counter | — |
| `papa_ledger_dead_letter_replay_total` | counter | `mode`, `result` |
| `papa_evidence_verify_total` | counter | `result` |

### Scrape config

```yaml
scrape_configs:
  - job_name: 'papa-app'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics'
    scrape_interval: 15s
```

---

## См. также

- [RUNBOOK_LEDGER_DEAD_LETTER.md](./RUNBOOK_LEDGER_DEAD_LETTER.md)
- [RUNBOOK_EVIDENCE_VERIFY.md](./RUNBOOK_EVIDENCE_VERIFY.md)
- [RETENTION_POLICY.md](./RETENTION_POLICY.md)
