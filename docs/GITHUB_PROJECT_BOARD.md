# GitHub Project Board — P1/P2

## Структура (рекомендуемая)

### Колонки

| Колонка | Назначение |
|---------|------------|
| **Backlog** | Задачи на рассмотрение |
| **To Do** | Готовы к работе |
| **In Progress** | В работе |
| **In Review** | PR открыт |
| **Done** | Завершено |

### Автоматизация (опционально)

- **При открытии PR** → issue переходит в «In Review»
- **При merge** → issue переходит в «Done»

(Настраивается в Project → … → Workflows)

---

## Создание через GitHub UI

1. **Repository** → Projects → New project
2. Выбрать **Table** или **Board**
3. Создать колонки вручную
4. Добавить Issues: drag & drop из списка или Link issue

---

## Создание через gh CLI

Требуется scope `project`: `gh auth refresh -s project`

```bash
# 1. Создать проект
gh project create --owner @me --title "papa-app P1/P2"

# 2. Связать с репозиторием
# В UI: Project Settings → Link repository → papa-app

# 3. Добавить Issues в проект
# В UI: Add item → search issues by #number
# Или: drag issue из репозитория
```

---

## Маппинг Issues → колонки

| Issue | Колонка (старт) |
|-------|-----------------|
| US-5 Admin UI | To Do |
| US-6 ADR OAuth | Backlog |
| US-7 Пагинация | To Do |
| US-8 SQLite safe | To Do |

---

## Быстрый старт (после создания Issues)

1. Создать Project вручную на GitHub
2. Добавить колонки: Backlog, To Do, In Progress, Done
3. Link repository: papa-app
4. Add items: выбрать US-5, US-7, US-8 (US-6 — optional в Backlog)
