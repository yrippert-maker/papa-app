# MRO Regulatory Monitoring — операционный пакет

**Цель:** ежемесячный мониторинг изменений ICAO/EASA/FAA MRO, уведомление оператору, обновление документации только после approve.

---

## 1. Структура папок

```
.../БАЗА/menasa/
  руководства/
    регуляторика/
      MRO/
        ICAO/
        EASA/
        FAA/
        ARMAK/
          AP-145/
          Guidance/
          Letters/
  выгрузки/
    MRO_UPDATES/
      YYYY-MM/
        review_packet/
        approved_patch/
```

**Создание:** `npm run mro:init`

---

## 2. ENV

```env
PAPA_DB_ROOT=.../БАЗА/menasa
AGENT_OUTPUT_ROOT=.../БАЗА/menasa/выгрузки
MRO_LIBRARY_ROOT=.../БАЗА/menasa/руководства/регуляторика/MRO
```

---

## 3. Источники (config/mro-sources.json)

| Authority | Kind | Документ |
|-----------|------|----------|
| EASA | regulation | Commission Regulation (EU) No 1321/2014 |
| EASA | amc_gm | AMC & GM to Part-145 |
| EASA | easy_access | Easy Access Rules for Continuing Airworthiness |
| FAA | regulation | 14 CFR Part 145 |
| FAA | guidance | Part 145 Certification Guidance |
| ICAO | guidance | Maintenance on aircraft |
| ARMAK | regulation | АП-145 Ремонтные организации |
| ARMAK | guidance | Руководство 145.1В Процедуры сертификации |

*ICAO Annexes — часто платные; храним метаданные и ссылки.*  
*АрМАК — храним то, что официально доступно: PDF если есть, иначе MD конспект + ссылка + metadata.json.*

---

## 4. Мониторинг

**Запуск:** `npm run mro:monitor`

**Логика:**
1. Fetch HEAD по каждому URL (ETag, Last-Modified)
2. Сравнение с `mro_snapshot.json`
3. При изменениях → `review_packet.md` в `MRO_UPDATES/YYYY-MM/review_packet/`
4. Desktop-уведомление (macOS): «Найдены обновления EASA Part-145 — пакет готов к ревью»

**Опции:** `--dry-run`, `--no-notify`

---

## 5. Approve gate

**Правило:** авто-обновление рабочей документации **запрещено**. Только после ручного Approve:

1. Агент готовит Patch Proposal (список файлов, разделы, ссылки на норматив)
2. Оператор нажимает Approve в UI/CLI
3. Создаётся новая версия, sha256, EvidenceMap, журнал «кто/когда утвердил»

---

## 6. launchd (macOS)

Ежемесячно 1-го числа в 09:00:

```bash
# 1. Скопировать и отредактировать путь
cp scripts/mro-launchd.plist.example ~/Library/LaunchAgents/com.papa.mro-monitor.plist

# 2. В plist заменить /path/to/papa-app на реальный путь

# 3. Загрузить
launchctl load ~/Library/LaunchAgents/com.papa.mro-monitor.plist
```

---

## 7. Формат snapshot.json

```json
{
  "takenAt": "2026-02-04T12:00:00.000Z",
  "sources": {
    "easa-amc-gm-145": {
      "url": "...",
      "etag": "...",
      "lastMod": "...",
      "authority": "EASA",
      "kind": "amc_gm",
      "title": "..."
    }
  }
}
```

---

## 8. Формат review_packet.md

- Summary: N source(s) changed
- Per source: title, authority, kind, URL, ETag/Last-Modified diff
- Action: Review and update. Apply only after operator approval.
