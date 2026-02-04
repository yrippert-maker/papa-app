# RACI / Accountability Layer — Specification

**Цель:** явное владение решением верификации: кто Owner, Reviewer, Approver; связка policy → role → decision; фиксация «approved by X at Y» или «auto-approved under policy Z».

---

## 1. Назначение

- **RACI:** Owner (ответственный за решение), Reviewer (проверяющий), Approver (утверждающий).
- **Accountability:** каждое решение (pass/fail) привязано к роли и при необходимости к человеку/системе и времени.
- **Трассируемость:** регулятор или банк может увидеть, кто утвердил результат и по какой политике.

---

## 2. Модель ответственности и утверждения

| Роль | Описание | Когда фиксируется |
|------|----------|-------------------|
| **Owner** | Владелец процесса верификации (например «Compliance Team», «CI») | В конфигурации или в decision-record. |
| **Reviewer** | Тот, кто проверил результат (опционально; при ручной проверке) | При наличии — в decision-record.approval или в отдельном approval-record. |
| **Approver** | Утверждающий решение (policy или человек) | Auto: policy_ref + approved_at = generated_at. Manual: approved_by + approved_at. |

---

## 3. Расширение decision-record (approval)

В `decision-record.json` уже есть блок `approval`:

```json
"approval": {
  "mode": "auto",
  "policy_ref": "/path/to/verify-policy.json",
  "approved_by": null,
  "approved_at": null
}
```

Расширение для RACI (без ломания схемы):

| Поле | Тип | Описание |
|------|-----|----------|
| `approval.mode` | string | `auto` \| `manual` |
| `approval.policy_ref` | string \| null | Ссылка на политику при auto. |
| `approval.approved_by` | string \| null | При manual: идентификатор (email, id, роль). |
| `approval.approved_at` | string \| null | ISO 8601. |
| `approval.owner` | string \| null | RACI Owner (например «Compliance Team»). |
| `approval.reviewer` | string \| null | RACI Reviewer при наличии. |
| `approval.approver` | string \| null | RACI Approver: при auto — «policy:<path>», при manual — идентификатор. |

При **auto** по умолчанию: `approved_at = generated_at`, `approver = "policy:<policy_ref>"`.

---

## 4. Связка policy → role → decision

- **Policy** (verify-policy.json или anchoring.verify-policy.json) может содержать опциональное поле:
  - `approval_owner` (string): владелец процесса.
  - `approval_reviewer` (string): по умолчанию не задан.
  - При генерации decision-record: подставлять эти значения в `approval.owner` / `approval.reviewer`.
- **Decision** (pass/fail) всегда сопровождается записью approval (auto или manual).
- Для **manual approval** (будущее): отдельный шаг или API «утвердить результат верификации» записывает approved_by и approved_at в decision-record или в отдельный approval-record, ссылающийся на decision_record_id.

---

## 5. Артефакты

| Артефакт | Содержимое |
|----------|------------|
| decision-record.json | Блок `approval` с mode, policy_ref, approved_by, approved_at, опционально owner, reviewer, approver. |
| Policy (опционально) | Поля `approval_owner`, `approval_reviewer` для подстановки в RACI. |
| approval-record.json (опционально) | Отдельный файл при manual approval: decision_record_ref, approved_by, approved_at, signature. |

---

## 6. Реализация (минимальная)

1. **Уже есть:** в decision-record.json блок `approval` с `mode: "auto"`, `policy_ref`.
2. **Добавить в policy (опционально):** `approval_owner`, `approval_reviewer`; при генерации decision-record читать и записывать в `approval.owner`, `approval.reviewer`.
3. **Добавить в decision-record (опционально):** поля `approval.owner`, `approval.reviewer`, `approval.approver` (при auto: `"policy:<path>"`).
4. **Manual approval:** оставить под дальнейшую реализацию (API или скрипт, записывающий approved_by/approved_at).

---

## 7. Связь с ENTERPRISE_PARITY_ROADMAP

Блок «RACI / Accountability» из roadmap закрывается:  
— явный RACI (owner, reviewer, approver);  
— связка policy → role → decision;  
— фиксация «approved by X at Y» или «auto-approved under policy Z».
