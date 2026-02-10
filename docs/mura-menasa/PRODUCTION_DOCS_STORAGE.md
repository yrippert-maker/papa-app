# Место хранения производственных документов Mura Menasa

## Текущая структура

| Назначение | Путь | Описание |
|------------|------|----------|
| Handbook (MM-01..MM-04) | `Новая папка/` | Руководства, MOPM, СУБП, Реестр рисков |
| Индекс | `Новая папка/DOCUMENT_INDEX.json` | Метаданные документов |
| Регуляторные PDF | `data/regulatory-docs/` | PDF из Библиотеки (если загружены) |

## Рекомендуемая структура для производственных документов

```
data/
  mura-menasa/
    production/           # Текущие производственные документы
      acts/               # Акт входного/выходного контроля
        {year}/
          {work_order}/
      techcards/          # Технологические карты
        {product}/
      repair_files/       # Дела ремонта (по изделию)
        {serial_number}/
    templates/            # Эталоны (шаблоны)
```

## Переменная окружения

```bash
# Необязательно. По умолчанию используется WORKSPACE_ROOT/data/mura-menasa/production
PRODUCTION_DOCS_PATH=data/mura-menasa/production
```

## Связь с Agent

- Помощник по документам ищет в `DOCS_ROOT_DIR` / `PAPA_DB_ROOT`
- Сгенерированные DOCX сохраняются через `AGENT_OUTPUT_ROOT`
- Для production документов: сохранять в `PRODUCTION_DOCS_PATH` или `AGENT_OUTPUT_ROOT`

## Срок хранения

Согласно прога: не менее 10 лет в папке конкретного изделия, прошедшего ремонт.
