import React from 'react';
import { Link } from 'react-router-dom';
import { getJson } from '../lib/api';

type AckRow = {
  fingerprint: string;
  pack_sha256?: string | null;
  ack_by?: string | null;
  ack_reason?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
};

function isExpired(expires_at: string | null | undefined): boolean {
  if (!expires_at) return false;
  const d = new Date(expires_at);
  return !Number.isNaN(d.getTime()) && d <= new Date();
}

export function ExceptionsPage() {
  const [acks, setAcks] = React.useState<AckRow[]>([]);
  const [err, setErr] = React.useState<string | null>(null);
  const [activeOnly, setActiveOnly] = React.useState(true);

  React.useEffect(() => {
    setErr(null);
    getJson(`/v1/acks?limit=500&active=${activeOnly ? '1' : '0'}`)
      .then((j) => setAcks(j.acks || []))
      .catch((e) => setErr(String(e?.message || e)));
  }, [activeOnly]);

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui' }}>
      <div style={{ marginBottom: 8 }}>
        <Link to="/days">← Days</Link>
      </div>
      <h2>Exception register</h2>
      <p style={{ color: '#666', marginBottom: 12 }}>
        Acknowledged issues (exceptions). Expired acks are treated as unacked for verify/alerting.
      </p>
      <div style={{ marginBottom: 12 }}>
        <label>
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
          />
          {' '}Active only (exclude expired)
        </label>
      </div>
      {err ? <div style={{ color: 'crimson' }}>{err}</div> : null}
      <table cellPadding={8} style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ddd' }}>
            <th align="left">Fingerprint</th>
            <th align="left">Ack by</th>
            <th align="left">Created</th>
            <th align="left">Expires</th>
            <th align="left">Pack SHA256</th>
            <th align="left">Reason</th>
          </tr>
        </thead>
        <tbody>
          {acks.map((a) => (
            <tr key={a.fingerprint} style={{ borderTop: '1px solid #eee' }}>
              <td>
                <code style={{ fontSize: 11 }}>{a.fingerprint}</code>
              </td>
              <td>{a.ack_by ?? '—'}</td>
              <td>{a.created_at ? new Date(a.created_at).toISOString().slice(0, 19) : '—'}</td>
              <td>
                {a.expires_at ? (
                  isExpired(a.expires_at) ? (
                    <span style={{ color: '#c62828' }}>expired</span>
                  ) : (
                    new Date(a.expires_at).toISOString().slice(0, 10)
                  )
                ) : (
                  '—'
                )}
              </td>
              <td>{a.pack_sha256 ? <code style={{ fontSize: 11 }}>{a.pack_sha256.slice(0, 16)}…</code> : '—'}</td>
              <td style={{ maxWidth: 200 }}>{a.ack_reason ? String(a.ack_reason).slice(0, 80) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {acks.length === 0 && !err ? <div style={{ marginTop: 12, color: '#888' }}>No exceptions in register.</div> : null}
    </div>
  );
}
