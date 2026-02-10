# UI Routing Sanity Evidence

**Статус:** implemented
**Цель:** зафиксировать, что клиентская навигация, обработка 404 и ошибки маршрутизации **управляемы, предсказуемы и не приводят к неопределённому состоянию UI**.

---

## 1. Область охвата (Scope)

Данный артефакт подтверждает корректность и управляемость:

* UI-маршрутизации в **основном приложении (Next.js App Router)**
* UI-маршрутизации в **Auditor Portal (React Router)**
* обработки:

  * несуществующих путей (404),
  * ошибок рендеринга страниц,
  * навигации между связанными экранами.

❌ Не покрывает API-маршруты и права доступа (см. `ENDPOINT_AUTHZ_EVIDENCE.md`).

---

## 2. Архитектура маршрутизации (кратко)

| Layer               | Технология         | Реализация            | Назначение                     |
| ------------------- | ------------------ | --------------------- | ------------------------------ |
| UI (Main App)       | Next.js App Router | `app/**/page.tsx`     | File-based routing             |
| UI (Auditor Portal) | React Router       | `main.tsx`            | Client-side routing            |
| API AuthZ           | Custom registry    | `lib/authz/routes.ts` | Deny-by-default access control |

> UI routing и API authorization намеренно разделены по слоям.

---

## 3. Next.js App Router — управляемость маршрутов

### Реализовано

* Явные страницы создания:

  * `/tmc-requests/incoming/new`
  * `/tmc-requests/outgoing/new`
* Использование общего layout:

  * `DashboardLayout`
  * единый `PageHeader`
  * предсказуемая навигация "← К списку"
* Контекстный 404 в модуле заявок:

  * `app/tmc-requests/not-found.tsx` — "Раздел заявок: страница не найдена" + ссылки назад

### Гарантии

* Отсутствие "плавающих" URL
* Обновление страницы (F5) на `/new` не приводит к 404
* Прямые deep-links поддерживаются

---

## 4. Auditor Portal (React Router) — устойчивость навигации

### Реализовано

#### 4.1 NotFound handling

* Глобальный маршрут:

  ```tsx
  <Route path="*" element={<NotFoundPage />} />
  ```
* Все неописанные пути обрабатываются явно

#### 4.2 Layout-based routing

* `AppLayout` с общей навигацией
* `<Outlet />` для вложенных маршрутов
* Все страницы обёрнуты в layout

#### 4.3 Error Boundary

* `ErrorBoundary` вокруг всего приложения
* Ошибки страниц:

  * не "роняют" всё приложение
  * отображаются контролируемо

#### 4.4 Относительная навигация

* Внутри секций `/mail/*`, `/settings/*` — только относительные пути (`to="inbox"`, `to="view"`)
* Абсолютные пути — только для кросс-секционных ссылок (см. `AUDITOR_PORTAL.md`)

---

## 5. Контроль навигационных ошибок

### Типовые сценарии и поведение

| Сценарий                      | Ожидаемое поведение  | Статус |
| ----------------------------- | -------------------- | ------ |
| Переход на несуществующий URL | NotFoundPage         | ✅      |
| Ошибка в компоненте страницы  | ErrorBoundary        | ✅      |
| Навигация между разделами     | Без console errors   | ✅      |
| Deep-link + reload            | Страница открывается | ✅      |

---

## 6. Smoke-проверка (ручная, воспроизводимая)

### Next.js

```text
/tmc-requests/incoming
→ click "Новая заявка"
→ /tmc-requests/incoming/new
→ "← К списку"
```

### Auditor Portal

```text
/mail/inbox
→ /mail/view
→ /no-such-route → NotFoundPage
```

❗ Проверка выполняется без дополнительной конфигурации окружения.

---

## 7. Почему это важно для DD / Audit

* Навигация **не зависит от скрытого состояния**
* Ошибки маршрутов **не маскируются**
* UI ведёт себя **детерминированно**
* Отсутствуют "мёртвые" ссылки и silent-fail сценарии

Это снижает:

* риск пользовательских ошибок,
* нагрузку на поддержку,
* вопросы со стороны аудиторов и партнёров.

---

## 8. Связанные артефакты

* `ENDPOINT_AUTHZ_EVIDENCE.md` — контроль API-маршрутов
* `AUDITOR_PORTAL.md` — конвенции навигации
* Demo Compliance Package — integrity + verification
* CI checks — сборка и no-secrets sanitizer

---

### Итог

UI routing в системе является **контролируемым, проверяемым и устойчивым**,
что соответствует требованиям enterprise-уровня и due diligence.

---

## Screenshot (Evidence Kit)

![NotFoundPage](evidence-screenshots/evidence-not-found-page.png)

*Рис. 1. Auditor Portal — NotFoundPage при переходе на несуществующий URL.*

В regulatory bundle: `07_UI_EVIDENCE/not-found-page.png` (supporting evidence).

---

## Что дальше (опционально)

* добавить скриншот ErrorBoundary в Evidence Kit
* автоматизировать smoke-проверку (Playwright, минимально)
* вставить этот документ в PDF Evidence Report как доп. раздел, или
* короткая версия для аудиторов (½ страницы)
