# Temporal Compliance (--as-of) — Specification

**Цель:** формальный ответ на вопросы «Была ли система compliant на дату X?» и «По каким правилам и данным это было решено?»

---

## 1. CLI

```bash
independent-verify --pack ./audit-pack --policy ./verify-policy.json --as-of 2024-06-01T00:00:00Z
```

| Опция | Описание |
|-------|----------|
| `--pack` | Путь к audit pack (alias: `--audit-pack`). |
| `--policy` | Явный путь к verify-policy (переопределяет pack/repo lookup). |
| `--as-of` | ISO 8601 timestamp — временной контекст решения. |

---

## 2. Поведение при `--as-of`

1. **Фиксация контекста**
   - `as_of` записывается в decision-record и в `decision_fingerprint_sha256`.
   - policy version и hash фиксируются в блоке `temporal`.

2. **Pack evidence timestamp check**
   - Если `MANIFEST.created_at` или `ANCHORING_STATUS.generated_at` > `as_of`, выводится предупреждение: «Pack evidence newer than as_of».
   - Верификация продолжается; предупреждение фиксирует, что evidence мог быть создан после as_of.

3. **Verification**
   - Проверки выполняются в историческом контексте.
   - Ledger snapshot = ledger_entry_id текущего verify (для внешнего ledger lookup — будущее расширение).

---

## 3. Decision Record: блок `temporal`

При наличии `--as-of`:

```json
"temporal": {
  "as_of": "2024-06-01T00:00:00.000Z",
  "ledger_snapshot": "ledger_entry_id",
  "policy_version": "v1",
  "policy_hash": "sha256:..."
}
```

---

## 4. Критерии готовности

- [x] Два запуска с разными `--as-of` дают разные `decision_fingerprint`.
- [x] Можно воспроизвести историческое решение (fingerprint детерминирован от as_of + pack + policy + summary).
- [x] decision-record явно фиксирует временной контекст (блок `temporal`).

---

## 5. Связь с decision-diff (Часть B)

`decision-diff --from A.json --to B.json` использует блок `temporal` для сравнения: `context_diff` показывает изменение `as_of`, policy_version, policy_hash. См. `docs/compliance/DECISION_DIFF_SPEC.md`.
