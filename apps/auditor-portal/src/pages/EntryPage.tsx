import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getJson, postJson } from '../lib/api';

function kv(label: string, value: React.ReactNode) {
  return (
    <div style={{ marginBottom: 6 }}>
      <b>{label}:</b> <span>{value ?? '-'}</span>
    </div>
  );
}

type TopGroup = { severity?: string; type?: string; count?: number; runbook?: string; examples?: Array<{ fingerprint?: string; fingerprint_sha256?: string; period?: string; message?: string }> };

type IssueExamples = { examples?: Array<{ fingerprint?: string }> };
type SeverityToType = Record<string, IssueExamples>;
type AnchoringGrouped = {
  issues_grouped?: Record<string, SeverityToType>;
};

function pickFingerprintFromTop(e: Record<string, unknown> | null | undefined): string | null {
  const top = (e?.anchoring as { top?: TopGroup[] } | undefined)?.top ?? [];
  for (const g of top) {
    for (const ex of g.examples ?? []) {
      if (ex?.fingerprint) return ex.fingerprint;
    }
  }
  return null;
}

function pickFingerprintFromGrouped(e: Record<string, unknown> | null | undefined): string | null {
  const grouped = (e?.anchoring as AnchoringGrouped | undefined)?.issues_grouped;
  if (!grouped) return null;
  for (const sev of Object.keys(grouped)) {
    for (const typ of Object.keys(grouped[sev] ?? {})) {
      const examples = grouped[sev]?.[typ]?.examples ?? [];
      for (const ex of examples) {
        if (ex?.fingerprint) return ex.fingerprint;
      }
    }
  }
  return null;
}

export function EntryPage() {
  const [sp] = useSearchParams();
  const key = sp.get('key');
  const [entry, setEntry] = React.useState<Record<string, unknown> | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [presigned, setPresigned] = React.useState<string | null>(null);
  const [packPresigned, setPackPresigned] = React.useState<string | null>(null);
  const [ack, setAck] = React.useState<{ ack_by?: string; expires_at?: string } | null>(null);

  const fp = pickFingerprintFromTop(entry) ?? pickFingerprintFromGrouped(entry) ?? null;

  React.useEffect(() => {
    if (!key) return;
    setErr(null);
    setPresigned(null);
    getJson(`/v1/object?key=${encodeURIComponent(key)}`)
      .then((j) => setEntry(j.json as Record<string, unknown>))
      .catch((e) => setErr(String(e?.message || e)));
  }, [key]);

  React.useEffect(() => {
    if (!fp) return;
    getJson(`/v1/ack/${encodeURIComponent(fp)}`)
      .then((j) => setAck(j.ack || null))
      .catch(() => setAck(null));
  }, [fp]);

  if (!key) {
    return (
      <div style={{ padding: 16, fontFamily: 'system-ui' }}>
        <Link to="/days">← Days</Link>
        <div style={{ marginTop: 12 }}>
          Missing query param: <code>?key=...</code>
        </div>
      </div>
    );
  }

  const pack = entry?.pack as { sha256?: string } | undefined;
  const packObject = entry?.pack_object as { bucket?: string; key?: string; sha256?: string } | undefined;
  const sha = pack?.sha256 ?? null;
  const sig = entry?.signature as { ok?: boolean; key_id?: string } | undefined;
  const sigOk = sig?.ok;
  const anch = entry?.anchoring as { issues_hits?: number; status?: string; top?: TopGroup[] } | undefined;
  const hits = anch?.issues_hits;
  const result = entry?.result as { passed?: boolean } | undefined;
  const status = result?.passed ? 'PASS' : 'FAIL';

  const top = anch?.top ?? [];

  const entryDateFromKey = key ? (() => {
    const parts = key.split('/');
    if (parts.length >= 4 && /^\d{4}$/.test(parts[1]) && /^\d{2}$/.test(parts[2]) && /^\d{2}$/.test(parts[3]))
      return `${parts[1]}-${parts[2]}-${parts[3]}`;
    const gen = entry?.generated_at as string | undefined;
    return gen ? gen.slice(0, 10) : null;
  })() : null;

  const [rollupAnchoredForDate, setRollupAnchoredForDate] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    if (!entryDateFromKey) {
      setRollupAnchoredForDate(null);
      return;
    }
    getJson(`/v1/rollup/${entryDateFromKey}`)
      .then((j) => {
        const status = j.rollup_anchoring_status as { anchored?: boolean } | undefined;
        setRollupAnchoredForDate(status?.anchored ?? false);
      })
      .catch(() => setRollupAnchoredForDate(false));
  }, [entryDateFromKey]);

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui' }}>
      <div style={{ marginBottom: 8 }}>
        <Link to="/days">← Days</Link>
      </div>
      <h2>Ledger entry</h2>
      <div style={{ marginBottom: 6 }}>
        <code>{key}</code>
      </div>
      {err ? <div style={{ color: 'crimson' }}>{err}</div> : null}
      {!entry ? <div>Loading...</div> : null}
      {entry && rollupAnchoredForDate === true && entryDateFromKey ? (
        <div style={{ marginTop: 8, padding: 8, background: '#e8f5e9', borderRadius: 4 }}>
          This entry is covered by anchored rollup <strong>{entryDateFromKey}</strong>.
        </div>
      ) : null}

      {entry ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ padding: 12, border: '1px solid #ddd' }}>
            <h3>Summary</h3>
            {kv('status', status)}
            {kv('pack_sha256', sha ? <code>{sha}</code> : '-')}
            {kv('signature', sigOk ? `OK${sig?.key_id ? ` (key_id=${sig.key_id})` : ''}` : 'FAIL')}
            {kv('hits', hits)}
            {kv('anchoring.status', anch?.status)}
          </div>

          <div style={{ marginTop: 12, padding: 12, border: '1px solid #ddd' }}>
            <h3>Actions</h3>
            <button
              onClick={async () => {
                const j = await getJson(`/v1/presign?key=${encodeURIComponent(key)}&expires=900`);
                setPresigned(j.url);
              }}
            >
              Presign ledger-entry.json (15m)
            </button>
            {presigned ? (
              <div style={{ marginTop: 8 }}>
                <a href={presigned} target="_blank" rel="noreferrer">
                  Open presigned URL
                </a>
              </div>
            ) : null}

            {packObject?.bucket && packObject?.key ? (
              <div style={{ marginTop: 12 }}>
                <button
                  onClick={async () => {
                    const j = await getJson(
                      `/v1/presign?key=${encodeURIComponent(packObject.key!)}&bucket=${encodeURIComponent(packObject.bucket!)}&expires=900`
                    );
                    setPackPresigned(j.url);
                    if (j.url) window.open(j.url, '_blank');
                  }}
                >
                  Download pack (tar.gz)
                </button>
                {packPresigned ? (
                  <div style={{ marginTop: 8 }}>
                    <a href={packPresigned} target="_blank" rel="noreferrer">
                      Open pack download
                    </a>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div style={{ marginTop: 12 }}>
              <h4>Ack (best-effort)</h4>
              {fp ? (
                <div>
                  fingerprint: <code>{fp}</code>
                </div>
              ) : (
                <div>No fingerprint found in top examples</div>
              )}
              {ack ? (
                <div style={{ marginTop: 6 }}>
                  Ack: {ack.ack_by} {ack.expires_at ? `(exp ${ack.expires_at})` : ''}
                </div>
              ) : (
                <div style={{ marginTop: 6 }}>Not acknowledged</div>
              )}
              {fp ? (
                <button
                  style={{ marginTop: 8 }}
                  onClick={async () => {
                    const ackBy = prompt('Ack by (name/email):') || '';
                    if (!ackBy.trim()) return;
                    const reason = prompt('Reason (optional):') || '';
                    const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
                    await postJson('/v1/ack', {
                      fingerprint: fp,
                      pack_sha256: sha,
                      ack_by: ackBy,
                      ack_reason: reason,
                      expires_at: expires,
                    });
                    const refreshed = await getJson(`/v1/ack/${encodeURIComponent(fp)}`);
                    setAck(refreshed.ack || null);
                  }}
                >
                  Acknowledge (7d)
                </button>
              ) : null}
            </div>
          </div>

          <div style={{ marginTop: 12, padding: 12, border: '1px solid #ddd' }}>
            <h3>Top issue groups</h3>
            {top.slice(0, 5).map((g, idx) => (
              <div key={idx} style={{ borderTop: idx ? '1px solid #eee' : 'none', paddingTop: 8, marginTop: 8 }}>
                <div>
                  <b>
                    {g.severity}/{g.type}
                  </b>
                  {' — count '}
                  {g.count}
                </div>
                {g.runbook ? (
                  <div>
                    runbook:{' '}
                    <a href={g.runbook} target="_blank" rel="noreferrer">
                      {g.runbook}
                    </a>
                  </div>
                ) : null}
                {(g.examples || []).slice(0, 2).map((ex, i) => (
                  <div key={i} style={{ marginLeft: 12, marginTop: 4 }}>
                    • {ex.fingerprint ? <code>{ex.fingerprint}</code> : null}{' '}
                    {ex.period ? ` period=${ex.period}` : ''}{' '}
                    {ex.message ? ` msg=${String(ex.message).slice(0, 120)}` : ''}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
