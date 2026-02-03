# Отчёт по изменениям: Anchoring UX и API

**Дата:** 2026-02-02  
**Область:** Governance / Anchoring

---

## 1. Добавлено поле `windowDays` в Anchoring Health API

**Файлы:** `lib/types/anchoring.ts`, `lib/anchoring-health-service.ts`, `app/api/anchoring/health/route.ts`

**Изменение:** В ответ `GET /api/anchoring/health` добавлено поле `windowDays: number` (по умолчанию 30). Позволяет UI и отчётам явно знать размер окна, по которому считаются `confirmedInWindow`, `emptyInWindow`, `failedInWindow`.

---

## 2. Автообновление Anchoring Health на Dashboard (polling 60 с)

**Файл:** `components/dashboard/AnchoringHealth.tsx`

**Изменение:** Блок Anchoring Health на Dashboard теперь обновляется каждые 60 секунд через `setInterval`. Первая загрузка — при монтировании. Используется `cache: 'no-store'` для актуальных данных.

---

## 3. Обновлён текст Assurance (EN + RU)

**Файл:** `docs/ASSURANCE.md`

**Изменение:** Секция «Integrity Anchoring» переименована в «Integrity Anchoring (Polygon)», уточнён текст (commitments, metadata). Добавлена русская версия «Якорение целостности (Polygon)» для партнёров и регуляторов.

---

## 4. Новая страница `/governance/anchoring` с deep-link и drawer

**Файлы:** `components/governance/AnchoringPage.tsx`, `app/governance/anchoring/page.tsx`

**Изменение:** Страница переработана:

- **Сводка:** статус (OK/DELAYED/FAILED), последний confirmed, покрытие за окно
- **Фильтры:** период (7/30/90 дней), даты from/to, статус (All, confirmed, empty, pending, failed)
- **Таблица:** Period, Events, Status, On-chain tx, Contract, Anchor ID
- **Drawer:** детали anchor, on-chain proof, Merkle root, кнопки «Open receipt» и «Export proof bundle»
- **Deep-link:** `?status=failed`, `?anchorId=<id>`, `?preset=7|30|90`, `?from=`, `?to=`
- **URL sync:** фильтры синхронизируются с query params

---

## 5. Адаптация под схему `ledger_anchors` (pending вместо created/submitted)

**Файл:** `components/governance/AnchoringPage.tsx`

**Изменение:** В фильтре статусов убраны `created` и `submitted` (их нет в БД). Оставлены: `confirmed`, `empty`, `pending`, `failed`. Badge для `pending` отображается как «⏳ pending». Стили приведены к Tailwind-классам проекта (slate, emerald, amber, red).

---

## Итог

- Все 220 unit-тестов проходят
- Страница `/governance/anchoring` поддерживает deep-link и синхронизацию с URL
- Dashboard Anchoring Health обновляется каждые 60 с
- API health возвращает `windowDays` для прозрачности окна расчёта
