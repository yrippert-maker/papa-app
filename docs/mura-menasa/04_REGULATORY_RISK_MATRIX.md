# Regulatory Risk Matrix и Compliance Roadmap
## AI Document Workflow / Mura Menasa

**Версия:** 1.0  
**Дата:** 2026-02  

---

## 1. Карта регуляторных требований

| Регулятор | Требование | Соответствие продукта | Gap | Приоритет |
|-----------|------------|------------------------|-----|-----------|
| АрМАК | Электронные документы, audit trail | EvidenceMap, ledger, approve-gate | Нет формальной сертификации | P2 |
| GCAA | Part-M, Part-145, Part-CAMO | Human-in-the-loop, трассируемость | Оценка GCAA | P1 |
| EASA | Part-M, Part-145, Part-CAMO | Готовность к расширению | Официальная оценка | P2 |
| EU AI Act | Классификация AI-систем | Human-in-the-loop, limited risk | Gap analysis | P1 |
| EASA | AI Concept Paper, trustworthiness | Документирование, explainability | Roadmap alignment | P2 |

---

## 2. Regulatory Risk Matrix

| ID | Риск | Вероятность | Влияние | Horizon | Готовность | Действия | Бюджет |
|----|------|-------------|---------|----------|------------|----------|--------|
| RR1 | Изменение требований АрМАК к эл. документам | 3 | 4 | 1–3 г | 70% | Мониторинг, гибкая схема | 0.2 млн ₽ |
| RR2 | GCAA: обязательная сертификация ПО | 3 | 5 | 2–4 г | 50% | Консультация, план сертификации | 1–2 млн ₽ |
| RR3 | EASA: mandatory AI requirements для MRO | 4 | 5 | 3–5 г | 40% | EU AI Act alignment | 0.5–1 млн ₽ |
| RR4 | EU AI Act: high-risk классификация | 4 | 5 | 1–2 г | 50% | Impact assessment, conformity | 0.5–1.5 млн ₽ |
| RR5 | Локализация данных (data sovereignty) | 3 | 4 | 2–4 г | 60% | On-premise, regional clouds | 0.5–1 млн ₽ |
| RR6 | Запрет external LLM для авиадокументов | 2 | 5 | 3–5 г | 70% | On-premise ML, local models | 1–2 млн ₽ |
| RR7 | Аккредитация блокчейн-систем | 2 | 3 | 3–5 г | 80% | Hash-only, минимальный footprint | 0.2 млн ₽ |
| RR8 | Изменение audit trail retention | 3 | 3 | 1–3 г | 75% | Configurable retention | 0.1 млн ₽ |
| RR9 | Explainability of AI decisions | 4 | 4 | 1–2 г | 60% | Логирование, отчёты | 0.3–0.5 млн ₽ |
| RR10 | DO-326A / ED-202A (cyber security) | 3 | 4 | 2–4 г | 40% | Security assessment | 0.5–1 млн ₽ |

---

## 3. EU AI Act Impact Assessment

| Параметр | Оценка |
|----------|--------|
| **Классификация** | Limited risk / возможно minimal risk |
| **Обоснование** | Human-in-the-loop, ИИ не принимает финальных решений, assistive tool |
| **Gap analysis** | Прозрачность, документация, конформность |
| **Conformity** | Самооценка (CE marking) или notified body при high-risk |
| **Timeline** | 2025–2026 вступление в силу |

---

## 4. EASA AI Roadmap Alignment

| Требование EASA | Текущее состояние | План |
|-----------------|------------------|------|
| Level of AI autonomy | Assisted (человек решает) | Документировать |
| Trustworthiness | Audit trail, evidence | Расширить explainability |
| Safety | Human-in-the-loop | Без изменений |
| Сертификация | — | Мониторинг развития framework |

---

## 5. Compliance Roadmap (12 месяцев)

| Квартал | Фокус | Документы | Сертификации |
|---------|-------|-----------|--------------|
| Q1 | EU AI Act gap | Impact assessment | — |
| Q2 | GCAA alignment | Compliance statement | Консультация GCAA |
| Q3 | Explainability | User docs, logs | — |
| Q4 | EASA readiness | Roadmap alignment | — |

---

## 6. Регуляторный мониторинг

| Источник | Периодичность | Ответственный |
|----------|---------------|----------------|
| EASA, ICAO | Ежемесячно | Compliance lead |
| АрМАК, GCAA | Ежеквартально | Compliance lead |
| EU AI Act | При обновлениях | Legal/Compliance |
| Процесс | Алерты → оценка → план | PM |

---

*Подготовлено по рекомендациям Mura Menasa. Ссылки: EASA Concept Paper on AI (2023), EU AI Act (2024), Part-M/Part-145.*
