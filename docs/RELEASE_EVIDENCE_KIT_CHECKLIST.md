# Release Checklist — Evidence Kit v1.0

**Tag:** `evidence-kit-v1.0`  
**Цель:** зафиксировать Evidence Kit с контрольными суммами и verification snippet.

---

## 1. Подготовка артефактов

```bash
# Чистое дерево (рекомендуется)
git status   # no uncommitted changes

# Сборка Evidence Kit Public Bundle
npm run evidence-kit:public -- --tag evidence-kit-v1.0
```

**Результат:** `dist/evidence-kit-public-v1.0/` содержит:
- demo-pack.zip + demo-pack.zip.sha256
- regulatory-bundle-evidence-kit-v1.0.zip + .sha256
- README.md, evidence-kit-report-*.md

---

## 2. Артефакты для GitHub Release (обязательно)

| Файл | Источник | Примечание |
|------|----------|------------|
| Papa-App-Demo-Compliance-Package.zip | `dist/demo/demo-pack.zip` или `dist/evidence-kit-public-v1.0/demo-pack.zip` | Можно переименовать для ясности |
| Papa-App-Demo-Compliance-Package.zip.sha256 | `dist/demo/demo-pack.zip.sha256` или `dist/evidence-kit-public-v1.0/demo-pack.zip.sha256` | |
| regulatory-bundle-evidence-kit-v1.0.zip | `dist/regulatory-bundle-evidence-kit-v1.0.zip` или `dist/evidence-kit-public-v1.0/` | |
| regulatory-bundle-evidence-kit-v1.0.zip.sha256 | рядом с ZIP | |

---

## 3. Создание тега и релиза

```bash
# Тег
git tag evidence-kit-v1.0
git push origin evidence-kit-v1.0

# GitHub Release (вручную или gh)
gh release create evidence-kit-v1.0 \
  -t "Evidence Kit v1.0" \
  -F docs/GITHUB_RELEASE_NOTES_EVIDENCE_KIT_V1.0.md \
  dist/evidence-kit-public-v1.0/demo-pack.zip \
  dist/evidence-kit-public-v1.0/demo-pack.zip.sha256 \
  dist/evidence-kit-public-v1.0/regulatory-bundle-evidence-kit-v1.0.zip \
  dist/evidence-kit-public-v1.0/regulatory-bundle-evidence-kit-v1.0.zip.sha256
```

---

## 4. Verification snippet (вставить в описание релиза)

```bash
# Проверка Evidence Kit v1.0 — 3 шага
sha256sum -c demo-pack.zip.sha256
sha256sum -c regulatory-bundle-evidence-kit-v1.0.zip.sha256
unzip -o demo-pack.zip && sha256sum -c 99_HASHES/checksums.sha256
```

*Если demo pack приложен как `Papa-App-Demo-Compliance-Package.zip`, замените `demo-pack` на это имя.*

---

## 5. Release notes — обязательные разделы

- [ ] Что входит (demo package, regulatory bundle, UI routing evidence, AuthZ evidence)
- [ ] Как проверить (3 команды sha256/self-check)
- [ ] Что является authoritative evidence
- [ ] Verification snippet (3–5 строк copy-paste)
- [ ] Контрольные суммы приложены

---

## 6. Связанные документы

- [GITHUB_RELEASE_NOTES_EVIDENCE_KIT_V1.0.md](GITHUB_RELEASE_NOTES_EVIDENCE_KIT_V1.0.md) — текст для Release notes
- [PACKAGE_SCHEMA.md](PACKAGE_SCHEMA.md) — структура пакетов
- [EVIDENCE_KIT_PUBLIC_BUNDLE.md](EVIDENCE_KIT_PUBLIC_BUNDLE.md) — сборка Public Bundle
