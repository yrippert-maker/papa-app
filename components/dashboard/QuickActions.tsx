'use client';

import Link from 'next/link';

const actions = [
  {
    href: '/tmc-requests/incoming',
    label: 'Принять в ремонт',
    desc: 'Входной контроль, приём объекта',
  },
  {
    href: '/tmc-requests/incoming',
    label: 'Принять товар',
    desc: 'Поступление ТМЦ',
  },
  {
    href: '/tmc-requests/outgoing',
    label: 'Выдать из ремонта',
    desc: 'Исходящая заявка',
  },
];

export function QuickActions() {
  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((a) => (
        <Link
          key={a.href + a.label}
          href={a.href}
          className="btn btn-primary inline-flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          {a.label}
        </Link>
      ))}
    </div>
  );
}
