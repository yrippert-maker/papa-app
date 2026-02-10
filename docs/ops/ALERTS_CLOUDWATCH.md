# CloudWatch Alarms — severity routing + единый email канал

CRITICAL → мгновенно, HIGH → отдельный topic. AWS alarms + GitHub findings в один inbox.

## Terraform (опционально)

В `terraform/cloudfront-waf/` задать:

```hcl
# Вариант A: создать SNS + email (рекомендуется)
alarm_email = "security@your-domain.com"

# Вариант B: существующие topics
# alarm_sns_topic_critical_arn = "arn:aws:sns:us-east-1:ACCOUNT:papa-app-security-critical"
# alarm_sns_topic_high_arn     = "arn:aws:sns:us-east-1:ACCOUNT:papa-app-security-high"

# GitHub → SNS (единый канал)
github_repo = "org/papa-app"
```

**Важно:** при `alarm_email` — подтверди **оба** письма (critical + high).

## Создаваемые алерты (HIGH / CRITICAL)

| Alarm | Метрика | HIGH | CRITICAL |
|-------|---------|------|----------|
| WAF blocked | BlockedRequests | > 500 / 5 min | > 2000 |
| ALB 5XX | HTTPCode_Target_5XX_Count | > 10 | > 50 |
| ALB latency | TargetResponseTime p95 | > 2 s | > 5 s |
| ECS CPU | CPUUtilization | > 85% | > 95% |
| ECS Memory | MemoryUtilization | > 85% | > 95% |
| Formatter DLQ | ApproximateNumberOfMessagesVisible | > 0 | — |

**Baseline tuning:** первые 7 дней — собирать метрики. Потом подстроить пороги (WAF: P99×2, latency: P95×1.5–2). См. WAF_RATE_LIMITS_TUNING.md.

## SNS → уведомления

- **Email:** создаётся при `alarm_email` (2 topics)
- **Slack/Telegram:** подпиши topics через Lambda

## GitHub → SNS (единый email канал)

GitHub Actions (`security-ai-weekly`) публикует findings в SNS при HIGH/CRITICAL.

**Secrets в GitHub:**
- `AWS_GITHUB_SNS_PUBLISH_ROLE_ARN` — output `github_sns_publish_role_arn`
- `AWS_SNS_TOPIC_HIGH_ARN` — output `alarm_sns_topic_high_arn`
- `AWS_SNS_TOPIC_CRITICAL_ARN` — output `alarm_sns_topic_critical_arn`

**Variables:** `AWS_SNS_REGION` = регион SNS (по умолч. us-east-1)

## См. также

- [CLOUDFRONT_WAF_ONEPAGER.md](./CLOUDFRONT_WAF_ONEPAGER.md)
- [ALERTS_COMPLIANCE.md](./ALERTS_COMPLIANCE.md)
