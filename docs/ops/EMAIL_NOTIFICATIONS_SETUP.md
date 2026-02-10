# E-mail уведомления — чеклист настройки

Единый канал: AWS инциденты + GitHub security findings.

## Вариант A: Email напрямую (SNS → email)

```hcl
alarm_email = "security@your-domain.com"
# enable_lambda_formatter = false (по умолч.)
```

Подтверди **2 письма** от AWS.

## Вариант B: Lambda formatter + SES (единый формат)

```hcl
enable_lambda_formatter = true
ses_from_email = "security@your-domain.com"  # verified в SES
alert_to_emails = ["security@your-domain.com"]
ses_region = "eu-west-1"
```

**Перед apply:**
```bash
./scripts/build-lambda-formatter.sh
```

SES: verify From и To (в sandbox — только verified recipients).

## 1. Terraform

```bash
cd terraform/cloudfront-waf
cp terraform.tfvars.example terraform.tfvars
# Заполнить переменные
terraform apply
```

## 2. Подтвердить email (только при варианте A)

При `alarm_email` без Lambda formatter придёт **2 письма** от AWS. Подтверди оба.

## 3. GitHub Secrets

Settings → Secrets and variables → Actions:

| Secret | Значение |
|--------|----------|
| `AWS_GITHUB_SNS_PUBLISH_ROLE_ARN` | Terraform output `github_sns_publish_role_arn` |
| `AWS_SNS_TOPIC_HIGH_ARN` | Terraform output `alarm_sns_topic_high_arn` |
| `AWS_SNS_TOPIC_CRITICAL_ARN` | Terraform output `alarm_sns_topic_critical_arn` |

## 4. GitHub Variables (опционально)

| Variable | Значение |
|----------|----------|
| `AWS_SNS_REGION` | Регион SNS (по умолч. us-east-1) |

## 5. Проверка

1. **CloudWatch:** alarms видны в консоли
2. **GitHub:** `workflow_dispatch` на security-ai-weekly (при наличии findings → письмо)
3. **Inbox:** приходят CloudWatch alarm emails и GitHub findings emails

## См. также

- [ALERTS_CLOUDWATCH.md](./ALERTS_CLOUDWATCH.md)
- [CLOUDFRONT_WAF_ONEPAGER.md](./CLOUDFRONT_WAF_ONEPAGER.md)
