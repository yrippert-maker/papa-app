import React from 'react';
import { Link } from 'react-router-dom';
import { getJson } from '../lib/api';

type DayRow = { date: string; ledger_prefix: string; rollup_exists: boolean; anchored?: boolean };

function Badges({ d }: { d: DayRow }) {
  return (
    <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
      {d.rollup_exists ? (
        <span style={{ background: '#e8f4ea', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>ROLLED-UP</span>
      ) : null}
      {d.anchored ? (
        <span style={{ background: '#1b5e20', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>ANCHORED</span>
      ) : null}
      {!d.rollup_exists && !d.anchored ? <span style={{ color: '#888' }}>—</span> : null}
    </span>
  );
}

export function DaysPage() {
  const [days, setDays] = React.useState<DayRow[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    getJson('/v1/days')
      .then((j) => setDays(j.days || []))
      .catch((e) => setErr(String(e?.message || e)));
  }, []);

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        Auditor Portal — Days
        <Link to="/exceptions" style={{ fontSize: 14, fontWeight: 'normal' }}>Exception register</Link>
      </h2>
      {err ? <div style={{ color: 'crimson' }}>{err}</div> : null}
      <table cellPadding={6} style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th align="left">Date (UTC)</th>
            <th align="left">Status</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date} style={{ borderTop: '1px solid #ddd' }}>
              <td>
                <Link to={`/day/${d.date}`}>{d.date}</Link>
              </td>
              <td>
                <Badges d={d} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
