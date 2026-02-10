# ЭЦП с биометрией — подписание по отпечатку пальца

## Назначение

Подписание производственных документов (акты АВК/АВыхК, техкарты) с использованием биометрической аутентификации (отпечаток пальца) в соответствии с регуляторными требованиями (EASA Part-145, АП-145, MOPM Mura Menasa).

## Варианты реализации

### 1. WebAuthn (рекомендуется)

- **Платформа:** браузер + Touch ID / Windows Hello / Android Fingerprint
- **Механизм:** `navigator.credentials.get()` с `userVerification: "required"` — пользователь подтверждает отпечатком
- **Подпись:** challenge = hash документа → authenticator подписывает → сервер верифицирует по публичному ключу
- **Требования:** HTTPS, регистрация credential (passkey) ранее

### 2. Внешний КриптоПро CSP / Рутокен

- **Платформа:** USB-токен или смарт-карта с поддержкой биометрии
- **Механизм:** ActiveX/WebCrypto + плагин КриптоПро
- **Применимость:** производственная среда с жёсткими требованиями к КЭП

### 3. Гибридный (MVP)

- **Сервер:** Ed25519 подпись (evidence-signing) после успешной биометрической аутентификации
- **Клиент:** WebAuthn assertion (fingerprint) → сервер проверяет → применяет server-side подпись
- **Привязка:** assertion.hash привязывается к document_hash в метаданных подписи

## Архитектура MVP (гибридный)

```
┌─────────────┐    1. challenge     ┌─────────────┐
│   Browser   │ ◄────────────────── │   Server    │
│             │                      │             │
│  2. WebAuthn│    3. assertion     │  4. verify  │
│  (fingerprint) ──────────────────► │  assertion  │
│             │                      │             │
│             │    5. signed doc     │  5. sign    │
│             │ ◄────────────────── │  (Ed25519)  │
└─────────────┘                      └─────────────┘
```

1. Клиент запрашивает challenge для документа (hash)
2. Сервер возвращает challenge + options (userVerification: required)
3. Пользователь подтверждает отпечатком → WebAuthn assertion
4. Сервер верифицирует assertion (биометрия пройдена)
5. Сервер подписывает document_hash своим ключом + фиксирует assertion_id в метаданных

## API

```
GET /api/signature/biometric/register
  Регистрация passkey. Возвращает options для startRegistration().

POST /api/signature/biometric/register
  Body: { response: RegistrationResponseJSON }
  Верификация и сохранение credential.

GET /api/signature/biometric/challenge?documentHash=<sha256>
  Опции для startAuthentication().

POST /api/signature/biometric
  Body: { documentHash, sessionId, assertion }
  Верификация assertion + подпись documentHash.
```

## Конфигурация

- `config/ecp-biometric.json` — включение, разрешённые роли, провайдер
- `BIOMETRIC_SIGN_ENABLED=1` — env override

## Регуляторные ссылки

- EASA Part-145.A.65 — система качества, подпись certifying staff
- АП-145 — аналог Part-145
- MOPM Mura Menasa MM-02 — процедуры ТОиР, удостоверяющий персонал
