import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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

function cryptoRandom() {
  return globalThis.crypto?.randomUUID?.() ?? `p_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function sha16(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0') + '00000000';
}

export function MailDetailPage() {
  const [sp] = useSearchParams();
  const key = sp.get('key');
  const [mail, setMail] = React.useState<Record<string, unknown> | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [proposal, setProposal] = React.useState<Record<string, unknown> | null>(null);
  const [writeKey, setWriteKey] = React.useState('');

  React.useEffect(() => {
    if (!key) return;
    setErr(null);
    getJson(`/v1/mail/get?key=${encodeURIComponent(key)}`)
      .then((j) => setMail(j.mail))
      .catch((e: Error) => setErr(String(e?.message || e)));
  }, [key]);

  function proposeFinanceAppend() {
    if (!mail) return;
    const proposalId = cryptoRandom();
    const amount = Number(prompt('Amount (e.g. 123.45):') || '0');
    const currency = (prompt('Currency (e.g. RUB):') || 'RUB').trim();
    const date = (prompt('Date (YYYY-MM-DD):') || new Date().toISOString().slice(0, 10)).trim();
    const counterparty = (prompt('Counterparty:') || '').trim();
    const messageId = (mail.message_id as string) ?? '';
    const payment_id = sha16(`${date}|${amount}|${currency}|${counterparty}|${messageId}`);
    const p = {
      version: 1,
      proposal_id: proposalId,
      mail_id: mail.mail_id,
      doc_id: 'finance/payments',
      mode: 'append_json',
      patch: {
        append_items: [
          {
            payment_id,
            date,
            amount,
            currency,
            counterparty,
            source_mail_id: mail.mail_id,
            source_message_id: messageId || null,
          },
        ],
      },
      status: 'pending',
      created_at: new Date().toISOString(),
      created_by: 'portal-operator',
    };
    setProposal(p);
  }

  function proposeMuraAppend() {
    if (!mail) return;
    const proposalId = cryptoRandom();
    const block = `### Incoming update (${new Date().toISOString().slice(0, 10)})\n- Subject: ${mail.subject ?? ''}\n- From: ${mail.from ?? ''}\n- Summary: (fill)\n`;
    const p = {
      version: 1,
      proposal_id: proposalId,
      mail_id: mail.mail_id,
      doc_id: 'mura-menasa/handbook',
      mode: 'append_markdown',
      patch: { append_markdown: block },
      status: 'pending',
      created_at: new Date().toISOString(),
      created_by: 'portal-operator',
    };
    setProposal(p);
  }

  async function submitProposal() {
    if (!proposal) return;
    if (!writeKey.trim()) {
      alert('Set x-api-key for write');
      return;
    }
    await fetchJson('/v1/docs/propose', proposal, writeKey);
    alert('Proposal stored. Now approve to apply.');
  }

  async function approve(decision: 'approve' | 'reject') {
    if (!proposal) return;
    if (!writeKey.trim()) {
      alert('Set x-api-key for write');
      return;
    }
    const operator_id = prompt('Operator id/name:') || 'operator';
    const body = { proposal_id: (proposal.proposal_id as string), operator_id, decision, apply_mode: 'safe_auto' };
    const j = await fetchJson('/v1/docs/approve', body, writeKey);
    alert(`Done: ${JSON.stringify(j)}`);
  }

  if (!key) {
    return (
      <div style={{ padding: 16, fontFamily: 'system-ui' }}>
        <Link to="/mail/inbox">← Inbox</Link>
        <div style={{ marginTop: 12 }}>Missing ?key=...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Link to="/mail/inbox">← Inbox</Link>
        <Link to="/documents/finance%2Fpayments">Finance payments</Link>
        <Link to="/documents/mura-menasa%2Fhandbook">Mura menasa</Link>
      </div>
      <h2>Mail detail</h2>
      {err ? <div style={{ color: 'crimson' }}>{err}</div> : null}
      {!mail ? <div>Loading...</div> : null}
      {mail ? (
        <div style={{ border: '1px solid #ddd', padding: 12, marginTop: 12 }}>
          <div>
            <b>Subject:</b> {String(mail.subject ?? '')}
          </div>
          <div>
            <b>From:</b> {String(mail.from ?? '')}
          </div>
          <div>
            <b>Received:</b> {String(mail.received_at ?? '')}
          </div>
          <div style={{ marginTop: 10 }}>
            <b>Body:</b>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{String(mail.body_text ?? '')}</pre>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 12, border: '1px solid #ddd', padding: 12 }}>
        <h3>Write access</h3>
        <div>Введите PORTAL_WRITE_API_KEY (x-api-key) для propose/approve:</div>
        <input value={writeKey} onChange={(e) => setWriteKey(e.target.value)} style={{ width: '100%', marginTop: 6 }} />
      </div>

      <div style={{ marginTop: 12, border: '1px solid #ddd', padding: 12 }}>
        <h3>Proposal (MVP manual)</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={proposeFinanceAppend}>
            Create finance proposal
          </button>
          <button type="button" onClick={proposeMuraAppend}>
            Create mura proposal
          </button>
          <button type="button" onClick={submitProposal} disabled={!proposal}>
            Store proposal
          </button>
        </div>
        {proposal ? (
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 10 }}>{JSON.stringify(proposal, null, 2)}</pre>
        ) : (
          <div style={{ marginTop: 10 }}>No proposal yet</div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button type="button" onClick={() => approve('approve')} disabled={!proposal}>
            Approve & apply
          </button>
          <button type="button" onClick={() => approve('reject')} disabled={!proposal}>
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
