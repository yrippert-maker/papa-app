# Post-Release Checklist — v0.1.2

*Через 24–48 часов после push/release.*

## A) Репозиторий и теги

- [ ] GitHub показывает тег `v0.1.2` и он указывает на commit `7f9cef4`
- [ ] Release notes на GitHub совпадают с `docs/GITHUB_RELEASE_NOTES_v0.1.2.md`
- [ ] В `main` нет незапушенных локальных коммитов (локально: `git status` чистый)

## B) CI / сборка

- [ ] Последний CI-run на `main` зелёный (tests/lint/build)
- [ ] Артефакт сборки воспроизводим на чистом checkout:

  ```bash
  npm ci
  npm test
  npm run lint
  npm run build
  npm run bundle:regulatory
  ```

## C) Regulatory bundle integrity

- [ ] `dist/regulatory-bundle-v0.1.2.zip` генерируется без ручных правок
- [ ] `MANIFEST.txt`:
  - `working_tree_clean=true` при submission сборке
  - `sha256_manifest` корректен
  - все файлы перечислены ровно один раз
- [ ] `BUNDLE_FINGERPRINT.md` корректно ссылается на:
  - verification protocol
  - `LEDGER_VERIFY_RESULT.txt` интерпретацию (executed=true AND ledger_ok=true)

## D) AuthZ enforcement sanity (поведенческий smoke)

На тестовом окружении/локально (как минимум):

- [ ] неавторизованный запрос к защищённому endpoint ⇒ `401`
- [ ] авторизованный без permission ⇒ `403`
- [ ] auditor может:
  - `GET /api/ledger/verify` — `200` или `409` при проблеме целостности
- [ ] auditor не может:
  - `POST /api/admin/users` — `403`
  - `POST /api/files/upload` — `403`
- [ ] admin может `GET /api/admin/users` — `200`

## E) Ledger evidence sanity

- [ ] `LEDGER_VERIFY_RESULT.txt`:
  - `schema_version=1`
  - при наличии БД: `executed=true`, `ledger_ok=true`, scope заполнен
  - при отсутствии БД: `skipped=true`, `ledger_ok=null`, `bundle_ok=true`
