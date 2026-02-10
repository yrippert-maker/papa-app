# CloudFront + WAF + Origin Lock — One-Pager (Ops)

Чеклист для внедрения и проверки CloudFront + WAF перед ALB → ECS.

---

## 1. Перед внедрением (5 мин)

- [ ] Домен есть или будет
- [ ] ALB публичный (станет origin-only)
- [ ] **ALB listener 443** с валидным cert (CloudFront → ALB только HTTPS)
- [ ] ACM cert в **us-east-1** (если custom domain)
- [ ] Приложение не трогаем

---

## 2. Terraform (15 мин)

```bash
cd terraform/cloudfront-waf
cp terraform.tfvars.example terraform.tfvars
# Заполнить: alb_dns_name, alb_arn, alb_region, origin_verify_secret
terraform init && terraform plan && terraform apply
```

- [ ] `origin_verify_secret` — `openssl rand -hex 32`
- [ ] `alb_region` = регион ALB
- [ ] При custom domain: `domain_name`, `acm_certificate_arn` (us-east-1)

---

## 3. Route53 (если custom domain)

- [ ] A-record (alias) → CloudFront domain name
- [ ] Zone ID CloudFront: `Z2FDTNDATAQYW2`

---

## 4. Проверка (10 мин)

### Origin lock

```bash
# Должен быть 403
curl -I https://YOUR-ALB-DNS.elb.amazonaws.com

# Должен пройти (с секретом)
curl -H "X-Origin-Verify: YOUR_SECRET" -I https://YOUR-ALB-DNS.elb.amazonaws.com
```

### CloudFront

```bash
curl -I https://YOUR-DOMAIN.com
# или
curl -I https://xxxxx.cloudfront.net
```

### Rate limit (опционально)

```bash
for i in {1..150}; do curl -s -o /dev/null -w "%{http_code}\n" https://YOUR-DOMAIN/api/auth/signin; done
# Должен начать возвращать 403
```

---

## 5. WAF Logs (желательно сразу)

- [ ] `enable_waf_logging = true` в tfvars (создаёт bucket) или `waf_log_bucket = "aws-waf-logs-xxx"`
- [ ] **Проверка, что пишется:** через 1–2 ч после деплоя:
  ```bash
  aws s3 ls s3://BUCKET_NAME/waf/AWSLogs/ --recursive | tail -20
  # или по prefix: aws s3 ls s3://BUCKET_NAME/waf/
  ```
- [ ] Через 24 ч: Top rules by blocks → подстрой лимиты

---

## 6. Алерты (рекомендуется)

- [ ] `alarm_email = "security@your-domain.com"` в tfvars
- [ ] **Подтвердить** подписку по ссылке в письме от AWS
- [ ] CloudWatch: WAF blocks, ALB 5XX, ALB latency → email

---

## Что получаем

| До | После |
|----|-------|
| ALB в интернете | Трафик только через CloudFront |
| Нет DDoS-защиты | L3–L7 mitigation |
| Нет rate limits | Ограничения по эндпоинтам |
| Приложение без изменений | Приложение без изменений |

---

## Опционально: жёсткая защита ALB

- [ ] `alb_security_group_id = "sg-xxx"` в tfvars
- [ ] **Удалить вручную** правило 0.0.0.0/0:443 из SG ALB
- [ ] Inbound только от CloudFront prefix list

## Upload 50MB (без WAF SizeConstraint)

- WAF body inspection max 64KB → SizeConstraint не включаем
- Защита: rate limit `/api/files/upload` (20/5min), общий `/api/*` (2000/5min)
- ALB: idle timeout достаточный для крупных upload (рекоменд. ≥ 120s)
- App: Content-Type allowlist, 401/403 до чтения тела

## Контакты / Runbook

- Terraform: `terraform/cloudfront-waf/`
- Настройка rate limits: [WAF_RATE_LIMITS_TUNING.md](./WAF_RATE_LIMITS_TUNING.md)
- ECS deploy: [ECS_FARGATE_DEPLOY.md](./ECS_FARGATE_DEPLOY.md)
- Alarms: [ALERTS_CLOUDWATCH.md](./ALERTS_CLOUDWATCH.md)
