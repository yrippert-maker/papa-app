# Конфигурация ИИ-агента ПАПА

Конфигурация для обучения и настройки ИИ-агента программы papa-app.

## Источники (ТЗ)

| Файл | Описание | Применение |
|------|----------|------------|
| `папа-ю/ТЗ/поиск ИИ.docx` | Агент мониторинга, скоринг, дайджест | `scoring.yaml`, `recommendation-format.yaml` |
| `папа-ю/ТЗ/учеба ИИ.docx` | Planner/Builder/Verifier, CI | `system-prompt.txt` |
| `папа-ю/ТЗ/доп общ.docx` | Scorer, deps_graph (poisk-ii) | Концепции скоринга в `scoring.yaml` |
| `папа-ю/ТЗ/коннект ИИ.docx` | Online Research, anti-hallucination | `anti-hallucination-rules.yaml` |
| `папа-ю/ТЗ/Buyer.docx` | Data Room, Q&A (папа-ю) | Справочник; принципы прозрачности |

## Файлы

- **scoring.yaml** — формула скоринга для AI Inbox (Relevance, Impact, Actionability, Credibility)
- **recommendation-format.yaml** — формат карточки рекомендации
- **system-prompt.txt** — системный промпт для агента разработки
- **anti-hallucination-rules.yaml** — правила защиты от галлюцинаций (поиск ИИ + коннект ИИ)

## Документация

См. `docs/ai/AI_AGENT_TZ_APPLIED.md` — детальное описание применения ТЗ.
