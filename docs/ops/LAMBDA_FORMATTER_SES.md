# Lambda formatter + SES — единый формат писем

CloudWatch alarms и GitHub findings приходят в одном формате, с нормальными темами и ссылками.

## Архитектура

```
CloudWatch Alarm ─┐
                  ├─> SNS (critical/high) ──> SQS ──> Lambda formatter ──> SES ──> Email
GitHub Actions  ──┘                                    │
                                                       └─> DLQ (при 3 failures) ──> Alarm
```

- SNS → SQS → Lambda (не SNS → Lambda напрямую)
- SQS redrive: после 3 неудачных попыток → DLQ
- Alarm на DLQ: при сообщениях → письмо в critical topic
- Lambda парсит SNS/SQS event, форматирует, отправляет через SES

## SES prerequisites

1. SES в нужном регионе (`ses_region`, по умолч. eu-west-1)
2. Verify **From** (ses_from_email)
3. В sandbox — verify **все** `alert_to_emails` (или вывести SES из sandbox)
4. SNS, SQS, Lambda — в одном регионе (проще ops)

## Terraform

```hcl
enable_lambda_formatter = true
ses_from_email         = "security@your-domain.com"
alert_to_emails        = ["security@your-domain.com", "ops@your-domain.com"]
ses_region             = "eu-west-1"
```

**Перед apply:**
```bash
./scripts/build-lambda-formatter.sh
```

## Формат писем

**CloudWatch:** Name, State, Time, Region, Reason, Console link.

**GitHub:** Severity, Repository, Workflow run URL, Issue URL, Next actions.

## GitHub Actions

Публикует JSON: `{repo, run_url, issue_url, severity}`. Lambda извлекает поля для красивого письма.

## Тестирование

1. **Lambda:** консоль → Test с mock SNS event
2. **GitHub:** workflow_dispatch → SNS publish
3. **CloudWatch:** временно занизь threshold WAF
4. **DLQ:** сломай `ses_from_email` → сообщение в DLQ → alarm → письмо

## Операционный чеклист (5 проверок)

1. WAF logs пишутся в S3
2. CloudWatch alarm: занизь WAF Blocked → письмо
3. GitHub findings → SNS → email (workflow_dispatch)
4. Lambda formatter: письмо форматированное
5. DLQ: сломай SES → сообщение в DLQ → alarm

## См. также

- [EMAIL_NOTIFICATIONS_SETUP.md](./EMAIL_NOTIFICATIONS_SETUP.md)
- [ALERTS_CLOUDWATCH.md](./ALERTS_CLOUDWATCH.md)
