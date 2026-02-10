import React from 'react';
import { Link } from 'react-router-dom';
import { getJson, postJson } from '../lib/api';

export function MailInboxPage() {
  const [items, setItems] = React.useState<{ key: string; size?: number; last_modified?: string }[]>([]);
  const [err, setErr] = React.useState<string | null>(null);
  const [limit, setLimit] = React.useState(200);
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});

  async function load() {
    setErr(null);
    try {
      const j = await getJson(`/v1/mail/inbox?limit=${limit}`);
      setItems(j.items || []);
    } catch (e: unknown) {
      setErr(String((e as Error)?.message || e));
    }
  }

  React.useEffect(() => {
    load();
  }, [limit]);

  async function bulk(decision: 'accept' | 'reject') {
    const keys = items.filter((it) => selected[it.key]).map((it) => it.key);
    if (keys.length === 0) return;
    if (!confirm(`${decision.toUpperCase()} ${keys.length} item(s)?`)) return;
    setErr(null);
    let done = 0;
    for (const key of keys) {
      try {
        await postJson('/v1/mail/decision', { key, decision, operator_id: 'bulk' });
        done += 1;
      } catch {
        setErr(`Failed on key ${key}`);
        break;
      }
    }
    setSelected({});
    await load();
    if (done === keys.length) alert(`Done: ${done} decision(s) recorded.`);
  }

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Mail inbox</h2>
        <Link to="/days">Evidence</Link>
        <Link to="/documents/finance%2Fpayments">Finance payments</Link>
        <Link to="/documents/mura-menasa%2Fhandbook">Mura menasa</Link>
        <Link to="/settings/mail-allowlist">Allowlist settings</Link>
      </div>
      {err ? <div style={{ color: 'crimson', marginTop: 8 }}>{err}</div> : null}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => bulk('accept')} disabled={selectedCount === 0}>
          Bulk Accept
        </button>
        <button type="button" onClick={() => bulk('reject')} disabled={selectedCount === 0}>
          Bulk Reject
        </button>
        <span style={{ opacity: 0.7, marginLeft: 'auto' }}>selected: {selectedCount}</span>
      </div>
      <div style={{ marginTop: 12 }}>
        Limit:{' '}
        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
          <option value={50}>50</option>
          <option value={200}>200</option>
          <option value={500}>500</option>
        </select>
      </div>
      <table cellPadding={6} style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
        <thead>
          <tr>
            <th align="left" style={{ width: 40 }} />
            <th align="left">Key</th>
            <th align="left">Size</th>
            <th align="left">Last modified</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.key} style={{ borderTop: '1px solid #ddd' }}>
              <td>
                <label style={{ marginRight: 8 }}>
                  <input
                    type="checkbox"
                    checked={!!selected[it.key]}
                    onChange={(e) => setSelected((s) => ({ ...s, [it.key]: e.target.checked }))}
                  />
                </label>
              </td>
              <td>
                <Link to={`/mail/view?key=${encodeURIComponent(it.key)}`}>{it.key.split('/').slice(-1)[0]}</Link>
              </td>
              <td>{it.size ?? '-'}</td>
              <td>{it.last_modified ? String(it.last_modified) : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
