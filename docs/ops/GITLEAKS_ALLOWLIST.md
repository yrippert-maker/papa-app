# Gitleaks — allowlist для false positives

Gitleaks использует default config. При false positives (например `__fixtures__/`, `env.example`) можно добавить allowlist.

**Ограничение:** custom config **полностью заменяет** default (нет merge). Поэтому либо:
- используем default и живём с редкими false positives, либо
- делаем dump default config и добавляем свои paths.

## Как добавить allowlist

1. Экспорт default config:
   ```bash
   gitleaks detect -s ./empty --no-git -v 2>/dev/null | head -1 || true
   # или скачать с https://github.com/gitleaks/gitleaks/blob/master/config/gitleaks.toml
   ```

2. Добавить в `[allowlist].paths`:
   ```toml
   paths = [
     '''__fixtures__/''',
     '''env\.example$''',
     '''terraform/cloudfront-waf/terraform\.tfvars\.example$''',
   ]
   ```

3. Сохранить как `.gitleaks.toml` в корне репо.

4. В workflow указать `GITLEAKS_CONFIG: .gitleaks.toml` (если action поддерживает).

**Важно:** не исключать `.env` или `.env.local` — они в .gitignore и не должны коммититься.
