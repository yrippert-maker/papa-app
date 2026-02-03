import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { getJson } from '../lib/api';

type EntryMeta = { key: string; size: number | null; last_modified: string | null };

export function DayPage() {
  const { date } = useParams<{ date: string }>();
  const [rollup, setRollup] = React.useState<Record<string, unknown> | null>(null);
  const [entries, setEntries] = React.useState<EntryMeta[]>([]);
  const [err, setErr] = React.useState<string | null>(null);
  const [limit, setLimit] = React.useState(200);

  const [anchored, setAnchored] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (!date) return;
    setErr(null);
    getJson(`/v1/rollup/${date}`)
      .then((j) => {
        setRollup(j.rollup || null);
        const status = j.rollup_anchoring_status as { anchored?: boolean } | undefined;
        setAnchored(status?.anchored ?? false);
      })
      .catch(() => {
        setRollup(null);
        setAnchored(false);
      });
    getJson(`/v1/day/${date}/entries?limit=${limit}&include=0`)
      .then((j) => setEntries(j.entries || []))
      .catch((e) => setErr(String(e?.message || e)));
  }, [date, limit]);

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui' }}>
      <div style={{ marginBottom: 8 }}>
        <Link to="/days">← Days</Link>
      </div>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        Day {date} (UTC)
        {rollup ? (
          <span style={{ display: 'inline-flex', gap: 6 }}>
            <span style={{ background: '#e8f4ea', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>ROLLED-UP</span>
            {anchored ? (
              <span style={{ background: '#1b5e20', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>ANCHORED</span>
            ) : null}
          </span>
        ) : null}
      </h2>
      {err ? <div style={{ color: 'crimson' }}>{err}</div> : null}

      <div style={{ marginTop: 12, padding: 12, border: '1px solid #ddd' }}>
        <h3>Rollup</h3>
        {rollup ? (
          <div>
            <div>entries: {(rollup.entries as { count?: number })?.count ?? '?'}</div>
            <div>
              merkle_root_sha256: <code>{(rollup.entries as { merkle_root_sha256?: string })?.merkle_root_sha256 ?? '?'}</code>
            </div>
          </div>
        ) : (
          <div>rollup.json not found</div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <h3>Ledger entries</h3>
        <div style={{ marginBottom: 8 }}>
          Limit:{' '}
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={50}>50</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
          </select>
        </div>
        <table cellPadding={6} style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th align="left">Key</th>
              <th align="left">Size</th>
              <th align="left">Last modified</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.key} style={{ borderTop: '1px solid #ddd' }}>
                <td>
                  <Link to={`/entry?key=${encodeURIComponent(e.key)}`}>{e.key.split('/').slice(-1)[0]}</Link>
                </td>
                <td>{e.size ?? '-'}</td>
                <td>{e.last_modified ? String(e.last_modified) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
