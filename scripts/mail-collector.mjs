#!/usr/bin/env node
/**
 * Mail MVP — сбор писем из Gmail (Workspace SA impersonation) и IMAP (mail.nic.ru).
 * Пишет mail_event в MAIL_BUCKET/MAIL_EVENTS_PREFIX/YYYY/MM/DD/<mail_id>.json.
 * M2: allowlist по From (MAIL_ALLOWED_FROM, MAIL_ALLOWED_FROM_REGEX, MAIL_ALLOWED_FROM_MODE).
 * M2.1: allowlist из docs-store config/mail-allowlist (env override).
 */
import { createHash } from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { google } from 'googleapis';

function must(v, name) {
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}
function isTruthy(v) {
  return v === '1' || v === 'true' || v === 'yes';
}
function sha256Hex(s) {
  return createHash('sha256').update(s).digest('hex');
}
function uuid() {
  return globalThis.crypto?.randomUUID?.() ?? `m_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function dayParts(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return { y, m, d: dd };
}

function mailKey(prefix, receivedAt, mailId) {
  const { y, m, d } = dayParts(new Date(receivedAt));
  return `${prefix}/${y}/${m}/${d}/${mailId}.json`;
}

function normalizeText(s) {
  return String(s || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function redactPII(s) {
  let t = String(s || '');
  t = t.replace(/\b\d{16}\b/g, '[REDACTED_CARD]');
  t = t.replace(/\+?\d[\d\-\s]{8,}\d/g, '[REDACTED_PHONE]');
  return t;
}

async function readJsonObject(s3, bucket, key, maxBytes = 2_000_000) {
  const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks = [];
  let size = 0;
  for await (const c of out.Body) {
    size += c.length;
    if (size > maxBytes) throw new Error('object too large');
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function loadAllowlistFromDocsStore(s3) {
  const docsBucket = (process.env.DOCS_BUCKET || process.env.MAIL_BUCKET || process.env.LEDGER_BUCKET || '').trim();
  const docsPrefix = (process.env.DOCS_PREFIX || 'docs-store').replace(/^\/+|\/+$/g, '');
  const docId = (process.env.MAIL_ALLOWLIST_DOC_ID || 'config/mail-allowlist').trim();
  if (!docsBucket) return null;
  const key = `${docsPrefix}/${docId}/latest.json`;
  try {
    const j = await readJsonObject(s3, docsBucket, key);
    return { bucket: docsBucket, key, allowlist: j };
  } catch {
    return null;
  }
}

function parseAllowlistFromEnvOrJson(jsonAllowlist) {
  const modeEnv = (process.env.MAIL_ALLOWED_FROM_MODE || '').trim().toLowerCase();
  const listEnv = (process.env.MAIL_ALLOWED_FROM || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const reSrcEnv = (process.env.MAIL_ALLOWED_FROM_REGEX || '').trim();

  const fallbackMode = String(jsonAllowlist?.mode || 'deny_all').trim().toLowerCase();
  const fallbackList = Array.isArray(jsonAllowlist?.allowed_from)
    ? jsonAllowlist.allowed_from.map((s) => String(s).trim().toLowerCase()).filter(Boolean)
    : [];
  const fallbackReSrc = String(jsonAllowlist?.allowed_from_regex || '').trim();

  const useMode =
    process.env.MAIL_ALLOWED_FROM_MODE != null && process.env.MAIL_ALLOWED_FROM_MODE !== ''
      ? modeEnv || 'deny_all'
      : fallbackMode;
  const useList =
    process.env.MAIL_ALLOWED_FROM != null && process.env.MAIL_ALLOWED_FROM !== '' ? listEnv : fallbackList;
  const useReSrc =
    process.env.MAIL_ALLOWED_FROM_REGEX != null && process.env.MAIL_ALLOWED_FROM_REGEX !== ''
      ? reSrcEnv
      : fallbackReSrc;

  const re = useReSrc ? new RegExp(useReSrc, 'i') : null;
  return { mode: useMode, list: new Set(useList), re };
}

function extractEmailLike(s) {
  const m = /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i.exec(String(s || ''));
  return m ? m[1].toLowerCase() : '';
}

function isAllowedFrom(fromText, allow) {
  const email = extractEmailLike(fromText);
  if (!email) return false;
  const hasRules = allow.list.size > 0 || !!allow.re;
  if (!hasRules) return allow.mode === 'allow_all';
  if (allow.list.size > 0 && allow.list.has(email)) return true;
  if (allow.re && allow.re.test(email)) return true;
  return false;
}

async function putJson(s3, bucket, key, json) {
  const body = JSON.stringify(json, null, 2);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'application/json',
    })
  );
  return { sha256: sha256Hex(body) };
}

async function collectImap({ s3, bucket, prefix, allow }) {
  if (!isTruthy(process.env.MAIL_IMAP_ENABLED)) return { ok: true, count: 0, skipped: 0 };
  const host = must(process.env.MAIL_IMAP_HOST, 'MAIL_IMAP_HOST');
  const port = Number(process.env.MAIL_IMAP_PORT || '993');
  const user = must(process.env.MAIL_IMAP_USER, 'MAIL_IMAP_USER');
  const pass = must(process.env.MAIL_IMAP_PASSWORD, 'MAIL_IMAP_PASSWORD');
  const folders = (process.env.MAIL_IMAP_FOLDERS || 'INBOX').split(',').map((s) => s.trim()).filter(Boolean);
  const sinceHours = Number(process.env.MAIL_SINCE_HOURS || '24');

  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  await client.connect();
  let total = 0;
  let skipped = 0;
  try {
    const since = new Date(Date.now() - sinceHours * 3600 * 1000);
    for (const box of folders) {
      const lock = await client.getMailboxLock(box);
      try {
        const uids = await client.search({ since });
        for await (const msg of client.fetch(uids, { uid: true, envelope: true, source: true })) {
          const envFromText = msg.envelope?.from?.[0]
            ? `${msg.envelope.from[0].name || ''} <${msg.envelope.from[0].address || ''}>`
            : '';
          if (!isAllowedFrom(envFromText, allow)) {
            skipped += 1;
            continue;
          }
          const parsed = await simpleParser(msg.source);
          const bodyText = normalizeText(parsed.text || parsed.html || '');
          const norm = redactPII(bodyText);
          const mailId = uuid();
          const receivedAt = (parsed.date || new Date()).toISOString();
          const attachments = (parsed.attachments || []).map((a) => ({
            filename: a.filename || 'attachment',
            mime: a.contentType || 'application/octet-stream',
            size: a.size ?? null,
            sha256: sha256Hex(a.content || Buffer.from('')),
          }));

          const mailEvent = {
            version: 1,
            mail_id: mailId,
            source: { system: 'imap', mailbox: host, uid: String(msg.uid) },
            message_id: parsed.messageId ?? null,
            thread_id: null,
            received_at: receivedAt,
            from: parsed.from?.text || '',
            to: (parsed.to?.value || []).map((x) => x.address).filter(Boolean),
            cc: (parsed.cc?.value || []).map((x) => x.address).filter(Boolean),
            subject: parsed.subject || '',
            body_text: norm,
            attachments,
            integrity: {
              sha256_normalized: sha256Hex(
                JSON.stringify({
                  h: { from: parsed.from?.text, to: parsed.to?.text, subject: parsed.subject },
                  b: norm,
                  a: attachments.map((x) => x.sha256),
                })
              ),
            },
          };

          const key = mailKey(prefix, receivedAt, mailId);
          await putJson(s3, bucket, key, mailEvent);
          total += 1;
        }
      } finally {
        lock.release();
      }
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return { ok: true, count: total, skipped };
}

async function gmailClient() {
  if (!isTruthy(process.env.MAIL_GMAIL_ENABLED)) return null;
  const projectId = process.env.MAIL_GMAIL_PROJECT_ID;
  const clientEmail = process.env.MAIL_GMAIL_CLIENT_EMAIL;
  const privateKey = process.env.MAIL_GMAIL_PRIVATE_KEY;
  const subjectUser = process.env.MAIL_GMAIL_IMPERSONATE;
  if (!projectId || !clientEmail || !privateKey || !subjectUser) return null;
  const key = privateKey.replace(/\\n/g, '\n');
  const jwt = new google.auth.JWT({
    email: clientEmail,
    key,
    scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    subject: subjectUser,
  });
  jwt.projectId = projectId;
  await jwt.authorize();
  return google.gmail({ version: 'v1', auth: jwt });
}

async function collectGmail({ s3, bucket, prefix, allow }) {
  const g = await gmailClient();
  if (!g) return { ok: true, count: 0, skipped: 0 };
  const labels = (process.env.MAIL_GMAIL_LABELS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const baseQ = process.env.MAIL_GMAIL_QUERY || 'newer_than:1d';

  const hasRules = allow.list.size > 0 || !!allow.re;
  if (!hasRules && allow.mode === 'deny_all') return { ok: true, count: 0, skipped: 0 };

  let fromQ = '';
  if (allow.list.size > 0) {
    const parts = Array.from(allow.list).map((e) => `"${e}"`);
    fromQ = `from:(${parts.join(' OR ')})`;
  }
  const q = fromQ ? `(${baseQ}) AND (${fromQ})` : baseQ;

  let total = 0;
  let skipped = 0;
  const list = await g.users.messages.list({
    userId: 'me',
    q,
    labelIds: labels.length ? labels : undefined,
    maxResults: 50,
  });
  const msgs = list.data.messages || [];
  for (const m of msgs) {
    const full = await g.users.messages.get({ userId: 'me', id: m.id, format: 'full' });
    const payload = full.data.payload;
    const headers = payload?.headers || [];
    const hdr = (name) => headers.find((h) => (h.name || '').toLowerCase() === name)?.value || '';
    const subject = hdr('subject');
    const from = hdr('from');
    const to = hdr('to');
    const dateHdr = hdr('date');
    const messageId = hdr('message-id');
    const receivedAt = dateHdr ? new Date(dateHdr).toISOString() : new Date().toISOString();

    if (!isAllowedFrom(from, allow)) {
      skipped += 1;
      continue;
    }

    const parts = payload?.parts || [];
    let body = '';
    const pick = (p) => (p?.mimeType === 'text/plain' && p?.body?.data ? p.body.data : null);
    const b64 = pick(payload) || parts.map(pick).find(Boolean) || '';
    if (b64) body = Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const norm = redactPII(normalizeText(body));

    const mailId = uuid();
    const mailEvent = {
      version: 1,
      mail_id: mailId,
      source: { system: 'gmail', mailbox: 'me', uid: String(full.data.id) },
      message_id: messageId || null,
      thread_id: full.data.threadId || null,
      received_at: receivedAt,
      from: from || '',
      to: to ? [to] : [],
      cc: [],
      subject: subject || '',
      body_text: norm,
      attachments: [],
      integrity: { sha256_normalized: sha256Hex(JSON.stringify({ from, to, subject, body: norm })) },
    };

    const key = mailKey(prefix, receivedAt, mailId);
    await putJson(s3, bucket, key, mailEvent);
    total += 1;
  }
  return { ok: true, count: total, skipped };
}

async function main() {
  const bucket = must(process.env.MAIL_BUCKET || process.env.LEDGER_BUCKET, 'MAIL_BUCKET or LEDGER_BUCKET');
  const prefix = (process.env.MAIL_EVENTS_PREFIX || 'mail-events').replace(/^\/+|\/+$/g, '');
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  const s3 = new S3Client({ region });

  const cfg = await loadAllowlistFromDocsStore(s3);
  const allow = parseAllowlistFromEnvOrJson(cfg?.allowlist ?? null);
  console.log(
    JSON.stringify(
      {
        allowlist_loaded: !!cfg,
        allowlist_source: cfg ? `${cfg.bucket}/${cfg.key}` : null,
        allowlist_mode: allow.mode,
        allowlist_count: allow.list.size,
        allowlist_regex: allow.re ? String(allow.re) : null,
      },
      null,
      2
    )
  );

  const imap = await collectImap({ s3, bucket, prefix, allow });
  const gmail = await collectGmail({ s3, bucket, prefix, allow });
  console.log(JSON.stringify({ ok: true, imap, gmail }, null, 2));
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(2);
});
