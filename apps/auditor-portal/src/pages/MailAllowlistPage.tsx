import React from 'react';
import { Link } from 'react-router-dom';
import { getJson } from '../lib/api';

const BASE = (import.meta as unknown as { env?: { VITE_PORTAL_API_URL?: string } }).env?.VITE_PORTAL_API_URL || 'http://localhost:8790';

async function fetchJson(path: string, body: unknown, apiKey: string) {
  const r = await fetch(`${BASE.replace(/\/+$/, '')}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${r.status}`);
  return j;
}

export function MailAllowlistPage() {
  const [err, setErr] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<'deny_all' | 'allow_all'>('deny_all');
  const [allowedFrom, setAllowedFrom] = React.useState('');
  const [allowedRegex, setAllowedRegex] = React.useState('');
  const [writeKey, setWriteKey] = React.useState('');
  const [loadedKey, setLoadedKey] = React.useState('');

  async function load() {
    setErr(null);
    try {
      const j = await getJson('/v1/config/mail-allowlist');
      const a = j.allowlist || {};
      setMode((a.mode === 'allow_all' ? 'allow_all' : 'deny_all') as 'deny_all' | 'allow_all');
      setAllowedFrom(Array.isArray(a.allowed_from) ? a.allowed_from.join('\n') : '');
      setAllowedRegex(String(a.allowed_from_regex || ''));
      setLoadedKey(String(j.key || ''));
    } catch (e: unknown) {
      setErr(String((e as Error)?.message || e));
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  async function save() {
    setErr(null);
    if (!writeKey.trim()) {
      setErr('Set x-api-key to save');
      return;
    }
    const operator_id = prompt('Operator id/name:') || 'operator';
    const body = {
      operator_id,
      mode,
      allowed_from: allowedFrom
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
      allowed_from_regex: allowedRegex.trim(),
    };
    try {
      const j = await fetchJson('/v1/config/mail-allowlist', body, writeKey);
      setLoadedKey(String(j.latest_key || ''));
      alert('Saved');
    } catch (e: unknown) {
      setErr(String((e as Error)?.message || e));
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Link to="/mail/inbox">Mail inbox</Link>
        <Link to="/days">Evidence</Link>
        <div style={{ marginLeft: 'auto' }}>
          <code style={{ fontSize: 12 }}>{loadedKey ? `loaded: ${loadedKey}` : ''}</code>
        </div>
      </div>
      <h2>Mail allowlist settings</h2>
      {err ? <div style={{ color: 'crimson', marginBottom: 10 }}>{err}</div> : null}

      <div style={{ border: '1px solid #ddd', padding: 12 }}>
        <div>
          <label>
            Mode:{' '}
            <select value={mode} onChange={(e) => setMode(e.target.value as 'deny_all' | 'allow_all')}>
              <option value="deny_all">deny_all (collect only allowed senders)</option>
              <option value="allow_all">allow_all (collect everything if list empty)</option>
            </select>
          </label>
        </div>

        <div style={{ marginTop: 12 }}>
          <div>
            <b>Allowed From (one email per line)</b>
          </div>
          <textarea
            value={allowedFrom}
            onChange={(e) => setAllowedFrom(e.target.value)}
            rows={10}
            style={{ width: '100%', marginTop: 6, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            placeholder={'pay@bank.ru\nbilling@vendor.com'}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <div>
            <b>Allowed From Regex (optional)</b>
          </div>
          <input
            value={allowedRegex}
            onChange={(e) => setAllowedRegex(e.target.value)}
            style={{ width: '100%', marginTop: 6, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            placeholder={'@(bank\\.ru|vendor\\.com)$'}
          />
        </div>
      </div>

      <div style={{ marginTop: 12, border: '1px solid #ddd', padding: 12 }}>
        <h3>Write access</h3>
        <div>Введите PORTAL_WRITE_API_KEY (x-api-key) для сохранения:</div>
        <input value={writeKey} onChange={(e) => setWriteKey(e.target.value)} style={{ width: '100%', marginTop: 6 }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button type="button" onClick={save}>
            Save
          </button>
          <button type="button" onClick={load}>
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
