# Evidence Kit — Roadmap монетизации

> **Статус:** roadmap (не в текущем спринте).  
> **Контекст:** demo pack технически готов; следующий шаг — превратить его в продукт.

---

## 1. Public Evidence Kit

**Цель:** один публичный «пример пакета» для демонстрации возможностей.

| Артефакт | Описание |
|----------|----------|
| Пример пакета | Один готовый demo-pack.zip (или ссылка на artifact) |
| 1–2 диаграммы | Архитектура evidence flow, цепочка trust (decision → ledger → anchor) |
| Executive summary | 2 страницы: что делает система, что доказано, scope |

**Результат:** партнёр/инвестор за 5 минут понимает ценность.

---

## 2. Pricing / Tiering

**Цель:** чёткое разделение по уровням и объёму evidence.

| Tier | Что входит в evidence |
|------|------------------------|
| **Demo** | Fixture pack, self-serve verify, checksums |
| **Partner** | Реальный pack, temporal, decision-diff, support |
| **Enterprise** | Полный evidence kit, SLA, кастомные интеграции |

**Результат:** понятная модель «что платишь — что получаешь».

---

## 3. Versioned Schema Docs

**Цель:** стабильный контракт для интеграций и аудита.

| Артефакт | Описание |
|----------|----------|
| `PACKAGE_SCHEMA.md` | Короткая страница: структура пакета, версии полей, обязательные артефакты |

**Результат:** внешние стороны могут опираться на версионированную схему.

---

## Связь с текущим состоянием

- **Demo pack** — реализован (`npm run compliance:demo:from-pack`, CI artifact).
- **EXEC_SUMMARY.md** — уже в пакете (базовый one-pager).
- **00_PACKAGE_STATUS.json**, **index.json** — готовы для schema docs.
- **PACKAGE_SCHEMA.md** — реализован ([docs/PACKAGE_SCHEMA.md](../PACKAGE_SCHEMA.md)): структура пакетов, обязательные артефакты, версии полей.
- **Evidence Kit Public Bundle** — реализован (`npm run evidence-kit:public`).

Следующий шаг — не «доделать», а **монетизировать**: Evidence Kit + pricing + schema.
