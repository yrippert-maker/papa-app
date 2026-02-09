'use client';

import { useState } from 'react';
import Link from 'next/link';

const TOC: Record<string, string[]> = {
  rk: [
    '1. Область применения',
    '2. Термины и определения',
    '3. Организационная структура и схема управления системой качества',
    '4. Описание иерархии документации системы качества',
    '5. Описание распределения ответственности и полномочий',
    '6. Политика и цели в области качества',
    '7. Анализ системы качества со стороны руководства',
    '8. Внутренние проверки',
    '9. Профессиональная подготовка и допуск к работе',
    '10. Метрологическое обеспечение',
    '11. Работа с поставщиками',
    '12. Входной контроль. Хранение и транспортирование',
    '13. Управление технологическим процессом',
    '14. Управление состоянием средств ремонта',
    '15. Управление состоянием производственной среды',
    '16. Неразрушающий контроль',
    '17. Идентификация и прослеживаемость изделий АТ',
    '18. Организация пооперационного и приемочного контроля',
    '19. Управление несоответствующей продукцией',
    '20. Организация испытаний',
    '21. Доработки изделий по бюллетеням',
    '22. Порядок возврата в эксплуатацию изделий АТ',
    '23. Система информации по отказам изделий',
    '24. Управление внешней нормативной документацией',
    '25. Управление внутренней нормативной документацией',
    '26. Управление организационно-распорядительной документацией',
    '27. Управление технической документацией',
    '28. Управление производственно-контрольной документацией',
    '29. Политика и цели управления безопасностью полетов',
  ],
  mopm: [
    '1. Заявление-Декларация о соответствии АП-145',
    '2. Политика и цели безопасности полетов',
    '3. Руководящий персонал',
    '4. Распределение обязанностей и полномочий',
    '5. Организационная структура',
    '6. Удостоверяющий персонал',
    '7. Трудовые ресурсы',
    '8. Место производственной деятельности',
    '9. Описание сферы деятельности',
    '10. Информирование об изменениях',
    '11. Порядок управления Руководством по ТОиР',
    '12. Документированные процедуры системы управления',
    '13. Взаимодействие с коммерческими эксплуатантами',
    '16. Представители Авиарегистра МАК',
  ],
  sms: [
    '1. ОБЩИЕ ПОЛОЖЕНИЯ',
    '2. НОРМАТИВНЫЕ ССЫЛКИ',
    '3. ТЕРМИНЫ И ОПРЕДЕЛЕНИЯ, СОКРАЩЕНИЯ',
    '4. СТРУКТУРА СУБП',
    '5. ПОЛИТИКА И ЦЕЛИ БЕЗОПАСНОСТИ ПОЛЕТОВ',
    '5.1 Обязательства руководства',
    '5.2 Иерархия ответственности',
    '5.3 Ведущие сотрудники по безопасности',
    '5.4 Документация по СУБП',
    '6. УПРАВЛЕНИЕ РИСКАМИ',
    '6.1 Выявление источников опасности',
    '6.2 Оценка и уменьшение рисков',
    '7. ОБЕСПЕЧЕНИЕ БЕЗОПАСНОСТИ ПОЛЕТОВ',
    '7.1 Контроль эффективности',
    '7.2 Осуществление изменений',
    '7.3 Совершенствование СУБП',
    '8. ПОПУЛЯРИЗАЦИЯ БЕЗОПАСНОСТИ',
    '8.1 Подготовка кадров',
    '8.2 Обмен информацией',
  ],
  risk: [
    '1. Усталость исполнителя вследствие нарушения условий труда',
    '2. Контроль хранения чувствительных материалов',
    '3. Контроль сроков хранения и консервации',
    '4. Контроль процесса сборки',
    '5. Контроль соблюдения технологии',
  ],
};

interface DocItem {
  id: string;
  title: string;
  ed?: string;
  dt?: string;
  type: string;
  key?: string;
  status?: string;
  approvedBy?: string;
  lang?: string;
  src?: string;
}

interface Regulator {
  id: string;
  name: string;
  color: string;
  docs: DocItem[];
}

const REGULATORS: Regulator[] = [
  {
    id: 'mm',
    name: 'Мура Менаса FZCO',
    color: '#EF1C23',
    docs: [
      { id: 'mm-01', title: 'Руководство по качеству (Quality Manual)', ed: 'Изд. 4', dt: '25.12.2025', type: 'РК', key: 'rk', status: 'active', approvedBy: 'Ю.В. Ребров' },
      { id: 'mm-02', title: 'Руководство по процедурам ТОиР (MOPM)', ed: 'Изд. 3', dt: '25.07.2025', type: 'MOPM', key: 'mopm', status: 'remarks', approvedBy: 'Ю.В. Ребров' },
      { id: 'mm-03', title: 'Руководство по СУБП (SMS Manual)', ed: 'Изд. 1', dt: '15.12.2025', type: 'СУБП', key: 'sms', status: 'active', approvedBy: 'Ю.В. Ребров' },
      { id: 'mm-04', title: 'Реестр рисков (Safety Risk Register)', ed: '12-2025', dt: '15.12.2025', type: 'Реестр', key: 'risk', status: 'active', approvedBy: 'Ю.В. Ребров' },
    ],
  },
  {
    id: 'icao',
    name: 'ICAO',
    color: '#1B7FAA',
    docs: [
      { id: 'i1', title: 'Annex 6 — Operation of Aircraft', ed: '2024', type: 'Annex', lang: 'EN/RU', src: 'https://store.icao.int/' },
      { id: 'i2', title: 'Annex 8 — Airworthiness of Aircraft', ed: '2023', type: 'Annex', lang: 'EN/RU', src: 'https://store.icao.int/' },
      { id: 'i3', title: 'Annex 1 — Personnel Licensing', ed: '2022', type: 'Annex', lang: 'EN/RU', src: 'https://store.icao.int/' },
      { id: 'i4', title: 'Doc 9760 — Airworthiness Manual', ed: '2014', type: 'Manual', lang: 'EN/RU', src: 'https://store.icao.int/' },
      { id: 'i5', title: 'Doc 9859 — Safety Management Manual', ed: '2018', type: 'Manual', lang: 'EN/RU', src: 'https://store.icao.int/' },
      { id: 'i6', title: 'Doc 10066 — PANS Training', ed: '2020', type: 'PANS', lang: 'EN', src: 'https://store.icao.int/' },
      { id: 'i7', title: 'Doc 8335 — Operations Inspection Manual', ed: '2017', type: 'Manual', lang: 'EN', src: 'https://store.icao.int/' },
    ],
  },
  {
    id: 'easa',
    name: 'EASA',
    color: '#2E5090',
    docs: [
      { id: 'e1', title: 'Regulation (EU) 1321/2014', ed: '2023', type: 'Regulation', lang: 'EN', src: 'https://www.easa.europa.eu/en/regulations' },
      { id: 'e2', title: 'Part-M — Continuing Airworthiness', ed: '2023', type: 'Part', lang: 'EN', src: 'https://www.easa.europa.eu/en/regulations' },
      { id: 'e3', title: 'Part-145 — Maintenance Organisation', ed: '2023', type: 'Part', lang: 'EN', src: 'https://www.easa.europa.eu/en/regulations' },
      { id: 'e4', title: 'Part-CAMO', ed: '2021', type: 'Part', lang: 'EN', src: 'https://www.easa.europa.eu/en/regulations' },
      { id: 'e5', title: 'Part-21 — Certification', ed: '2023', type: 'Part', lang: 'EN', src: 'https://www.easa.europa.eu/en/regulations' },
      { id: 'e6', title: 'Part-66 — Certifying Staff', ed: '2023', type: 'Part', lang: 'EN', src: 'https://www.easa.europa.eu/en/regulations' },
      { id: 'e7', title: 'Part-147 — Training Org', ed: '2023', type: 'Part', lang: 'EN', src: 'https://www.easa.europa.eu/en/regulations' },
      { id: 'e8', title: 'AMC/GM to Part-M', ed: '2023', type: 'AMC/GM', lang: 'EN', src: 'https://www.easa.europa.eu/en/regulations' },
      { id: 'e9', title: 'AMC/GM to Part-145', ed: '2023', type: 'AMC/GM', lang: 'EN', src: 'https://www.easa.europa.eu/en/regulations' },
      { id: 'e10', title: 'AI Concept Paper', ed: '2024', type: 'Concept', lang: 'EN', src: 'https://www.easa.europa.eu/en/domains/artificial-intelligence' },
    ],
  },
  {
    id: 'faa',
    name: 'FAA',
    color: '#8B6914',
    docs: [
      { id: 'f1', title: '14 CFR Part 43 — Maintenance', ed: 'current', type: 'CFR', lang: 'EN', src: 'https://www.ecfr.gov/current/title-14/part-43' },
      { id: 'f2', title: '14 CFR Part 91 — General Operating', ed: 'current', type: 'CFR', lang: 'EN', src: 'https://www.ecfr.gov/current/title-14/part-91' },
      { id: 'f3', title: '14 CFR Part 121 — Operating Requirements', ed: 'current', type: 'CFR', lang: 'EN', src: 'https://www.ecfr.gov/current/title-14/part-121' },
      { id: 'f4', title: '14 CFR Part 145 — Repair Stations', ed: 'current', type: 'CFR', lang: 'EN', src: 'https://www.ecfr.gov/current/title-14/part-145' },
      { id: 'f5', title: '14 CFR Part 39 — Airworthiness Directives', ed: 'current', type: 'CFR', lang: 'EN', src: 'https://www.ecfr.gov/current/title-14/part-39' },
      { id: 'f6', title: 'AC 43-9C — Maintenance Records', ed: '1998', type: 'AC', lang: 'EN', src: 'https://www.faa.gov/regulations_policies/advisory_circulars' },
      { id: 'f7', title: 'AC 43.13-1B — Acceptable Methods', ed: '1998', type: 'AC', lang: 'EN', src: 'https://www.faa.gov/regulations_policies/advisory_circulars' },
      { id: 'f8', title: 'Order 8900.1 — FSIMS', ed: 'current', type: 'Order', lang: 'EN', src: 'https://fsims.faa.gov/' },
    ],
  },
  {
    id: 'armak',
    name: 'АрМАК',
    color: '#A02020',
    docs: [
      { id: 'a1', title: 'АП — Лётная годность', ed: 'current', type: 'Правила', lang: 'RU/HY', src: 'https://armac.am/' },
      { id: 'a2', title: 'АП — Техобслуживание ВС (Part-145)', ed: 'current', type: 'Правила', lang: 'RU/HY', src: 'https://armac.am/' },
      { id: 'a3', title: 'АП — CAMO', ed: 'current', type: 'Правила', lang: 'RU/HY', src: 'https://armac.am/' },
      { id: 'a4', title: 'АП — Лицензирование персонала', ed: 'current', type: 'Правила', lang: 'RU/HY', src: 'https://armac.am/' },
    ],
  },
  {
    id: 'gcaa',
    name: 'GCAA (ОАЭ)',
    color: '#2D8B4F',
    docs: [
      { id: 'g1', title: 'CAR Part V — Airworthiness', ed: 'current', type: 'CAR', lang: 'EN', src: 'https://www.gcaa.gov.ae/en/ePublication' },
      { id: 'g2', title: 'CAR Part IX — Air Operator', ed: 'current', type: 'CAR', lang: 'EN', src: 'https://www.gcaa.gov.ae/en/ePublication' },
      { id: 'g3', title: 'CAAP 43 — Maintenance', ed: 'current', type: 'CAAP', lang: 'EN', src: 'https://www.gcaa.gov.ae/en/ePublication' },
      { id: 'g4', title: 'CAAP 145 — Approved MRO', ed: 'current', type: 'CAAP', lang: 'EN', src: 'https://www.gcaa.gov.ae/en/ePublication' },
      { id: 'g5', title: 'CAAP M — Continuing Airworthiness', ed: 'current', type: 'CAAP', lang: 'EN', src: 'https://www.gcaa.gov.ae/en/ePublication' },
      { id: 'g6', title: 'Safety Management Guidance', ed: 'current', type: 'Guide', lang: 'EN', src: 'https://www.gcaa.gov.ae/en/ePublication' },
    ],
  },
];

export function DocumentLibraryFull() {
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ mm: true });
  const [search, setSearch] = useState('');

  const toggleGroup = (id: string) =>
    setOpenGroups((p) => ({ ...p, [id]: !p[id] }));

  const findDoc = (docId: string): { doc: DocItem; reg: Regulator } | null => {
    for (const r of REGULATORS) {
      const d = r.docs.find((x) => x.id === docId);
      if (d) return { doc: d, reg: r };
    }
    return null;
  };

  const filteredRegs = REGULATORS.map((r) => ({
    ...r,
    docs: r.docs.filter((d) => !search || d.title.toLowerCase().includes(search.toLowerCase())),
  })).filter((r) => r.docs.length > 0);

  const totalDocs = REGULATORS.reduce((s, r) => s + r.docs.length, 0);
  const found = activeDoc ? findDoc(activeDoc) : null;

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950 text-white"
      style={{ fontFamily: 'Inter, system-ui, sans-serif', minHeight: '70vh' }}
    >
      {/* Top Bar */}
      <div
        className="flex items-center gap-3 px-5 py-3 bg-slate-900 border-b-2"
        style={{ borderColor: '#EF1C23' }}
      >
        <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 200 200" className="w-5 h-5">
            <circle cx="100" cy="100" r="90" fill="#444" />
            <g transform="translate(100,100)">
              <path d="M0,-10 C-25,-45 -15,-80 0,-75 C15,-80 25,-45 0,-10Z" fill="#EF1C23" />
              <path d="M0,-10 C-25,-45 -15,-80 0,-75 C15,-80 25,-45 0,-10Z" fill="#EF1C23" transform="rotate(120)" />
              <path d="M0,-10 C-25,-45 -15,-80 0,-75 C15,-80 25,-45 0,-10Z" fill="#EF1C23" transform="rotate(240)" />
              <circle r="10" fill="#EF1C23" />
            </g>
          </svg>
        </div>
        <span className="text-sm font-semibold tracking-widest text-slate-400">MURA MENASA FZCO</span>
        <span className="text-red-500 text-lg font-light">|</span>
        <span className="text-base font-bold">Библиотека документов</span>
        <span className="ml-auto text-xs text-slate-500">AI Document Workflow (ПАПА)</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden flex-shrink-0">
          <div className="p-3 border-b border-slate-800">
            <input
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-red-500"
              placeholder="🔍 Поиск документов..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (e.target.value) setOpenGroups(Object.fromEntries(REGULATORS.map((r) => [r.id, true])));
              }}
            />
          </div>
          <div className="flex gap-2 p-3 border-b border-slate-800">
            <div className="flex-1 bg-slate-800 rounded-lg p-2 text-center border border-slate-700">
              <div className="text-lg font-bold text-red-500">{totalDocs}</div>
              <div className="text-xs text-slate-500">Документов</div>
            </div>
            <div className="flex-1 bg-slate-800 rounded-lg p-2 text-center border border-slate-700">
              <div className="text-lg font-bold text-red-500">{REGULATORS.length}</div>
              <div className="text-xs text-slate-500">Регуляторов</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredRegs.map((reg) => (
              <div key={reg.id} className="border-b border-slate-800">
                <button
                  type="button"
                  className="flex items-center gap-2 w-full px-4 py-3 cursor-pointer hover:bg-slate-800 transition-colors text-left"
                  onClick={() => toggleGroup(reg.id)}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: reg.color }} />
                  <span className="text-xs font-semibold flex-1">{reg.name}</span>
                  <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{reg.docs.length}</span>
                  <span className={`text-xs text-slate-500 transition-transform ${openGroups[reg.id] ? 'rotate-90' : ''}`}>▶</span>
                </button>
                {openGroups[reg.id] &&
                  reg.docs.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={`w-full px-4 py-2 pl-8 text-xs cursor-pointer border-l-2 transition-all text-left ${
                        activeDoc === d.id ? 'bg-blue-950 border-red-500 text-white font-medium' : 'border-transparent text-slate-400 hover:bg-slate-800 hover:border-slate-600'
                      }`}
                      onClick={() => setActiveDoc(d.id)}
                    >
                      {d.title}
                      {d.status === 'remarks' && <span className="ml-1 text-yellow-500 text-xs">⚠</span>}
                      {d.lang?.includes('RU') && (
                        <span className="ml-1 text-xs bg-green-900 text-green-300 px-1 rounded">RU</span>
                      )}
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          {!found ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500 p-8">
              <div className="text-6xl mb-4 opacity-30">📚</div>
              <h2 className="text-2xl font-light text-slate-400 mb-2">Библиотека документов</h2>
              <p className="text-sm max-w-sm text-center">
                Выберите документ из списка слева. Документы Мура Менаса открываются с полным оглавлением.
              </p>
            </div>
          ) : (
            <div>
              {/* Doc Header */}
              <div className="p-6 bg-gradient-to-br from-slate-800 to-slate-900 border-b border-slate-700">
                <span
                  className="inline-block px-3 py-1 rounded text-xs font-bold tracking-wider text-white mb-2"
                  style={{ background: found.reg.color }}
                >
                  {found.reg.name}
                </span>
                <h2 className="text-xl font-bold mb-2">{found.doc.title}</h2>
                <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                  <span>📋 {found.doc.type}</span>
                  <span>📅 {found.doc.dt ?? found.doc.ed}</span>
                  {found.doc.lang && <span>🌐 {found.doc.lang}</span>}
                  {found.doc.approvedBy && <span>✍️ {found.doc.approvedBy}, Генеральный директор</span>}
                  {found.doc.status === 'remarks' && <span className="text-yellow-400 font-medium">⚠️ Документ содержит замечания</span>}
                  {found.doc.src && (
                    <a
                      href={found.doc.src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      🔗 Открыть источник
                    </a>
                  )}
                </div>
              </div>

              {/* Content */}
              {found.doc.key && TOC[found.doc.key] ? (
                <div>
                  <div className="p-4 bg-slate-900 border-b border-slate-800">
                    <h3 className="text-xs font-semibold text-slate-500 tracking-wider mb-3">
                      📑 ОГЛАВЛЕНИЕ ({TOC[found.doc.key].length} разделов)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                      {TOC[found.doc.key].map((t, i) => (
                        <div key={i} className="text-xs text-slate-300 py-1 px-2 hover:text-red-400 hover:bg-slate-800 rounded cursor-default transition-colors">
                          {t}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 max-w-2xl">
                      <p className="text-sm text-slate-300 mb-3">
                        Документ загружен в систему ПАПА. Полное содержание доступно при открытии файла.
                      </p>
                      <div className="flex gap-3">
                        <Link
                          href="/documents/mura-menasa/handbook"
                          className="inline-block px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded font-medium transition-colors"
                        >
                          📄 Открыть документ
                        </Link>
                        <Link
                          href="/documents/mura-menasa/handbook"
                          className="inline-block px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors"
                        >
                          ⬇️ Скачать/Handbook
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 max-w-xl">
                    <p className="text-sm text-slate-400 mb-4">
                      Внешний регуляторный документ. Для просмотра откройте официальный источник.
                    </p>
                    {found.doc.src && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Официальный источник:</p>
                        <a
                          href={found.doc.src}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-red-400 font-medium hover:underline block"
                        >
                          🔗 {found.doc.src.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    )}
                    <p className="text-xs text-slate-600 mt-4">
                      Используйте поиск слева для других документов. PDF доступны через Библиотеку (карточки).
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
