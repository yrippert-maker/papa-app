import express from 'express';
import crypto from 'node:crypto';
import { openDb, upsertAck, getAck, listAcks } from './db.mjs';

const PORT = Number(process.env.PORT || '8787');
const DB_PATH = process.env.ACK_DB_PATH || './ack.sqlite';
const API_KEY = (process.env.ACK_API_KEY || '').trim();

function requireKey(req, res, next) {
  if (!API_KEY) return next();
  const hdr = (req.headers['x-api-key'] || '').toString();
  const a = Buffer.from(hdr, 'utf8');
  const b = Buffer.from(API_KEY, 'utf8');
  if (a.length !== b.length) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (crypto.timingSafeEqual(a, b)) return next();
  return res.status(401).json({ ok: false, error: 'unauthorized' });
}

function isIso(s) {
  if (!s) return true;
  return !Number.isNaN(Date.parse(s));
}

const db = openDb(DB_PATH);
const app = express();
app.use(express.json({ limit: '256kb' }));

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/ack/:fingerprint', (req, res) => {
  const fp = String(req.params.fingerprint || '').trim();
  if (!fp) return res.status(400).json({ ok: false, error: 'missing fingerprint' });
  const row = getAck(db, fp);
  if (!row) return res.json({ ok: true, ack: null });
  if (row.expires_at) {
    const expires = new Date(row.expires_at);
    if (!Number.isNaN(expires.getTime()) && expires <= new Date()) return res.json({ ok: true, ack: null });
  }
  return res.json({ ok: true, ack: row });
});

app.get('/acks', (req, res) => {
  const limit = Math.min(Number(req.query.limit || '200'), 1000);
  const activeOnly = String(req.query.active || '1') !== '0';
  const rows = listAcks(db, { limit, activeOnly });
  return res.json({ ok: true, acks: rows });
});

app.post('/ack', requireKey, (req, res) => {
  const b = req.body || {};
  const fingerprint = String(b.fingerprint || '').trim();
  const ack_by = String(b.ack_by || '').trim();
  const ack_reason = b.ack_reason != null ? String(b.ack_reason).trim() : null;
  const pack_sha256 = b.pack_sha256 != null ? String(b.pack_sha256).trim() : null;
  const expires_at = b.expires_at != null ? String(b.expires_at).trim() : null;
  const meta_json = b.meta ? JSON.stringify(b.meta) : null;

  if (!fingerprint) return res.status(400).json({ ok: false, error: 'missing fingerprint' });
  if (!ack_by) return res.status(400).json({ ok: false, error: 'missing ack_by' });
  if (expires_at && !isIso(expires_at)) return res.status(400).json({ ok: false, error: 'invalid expires_at' });

  const row = {
    fingerprint,
    pack_sha256,
    ack_by,
    ack_reason,
    created_at: new Date().toISOString(),
    expires_at,
    meta_json,
  };
  upsertAck(db, row);
  return res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`issue-ack-server listening on :${PORT} db=${DB_PATH}`);
});
