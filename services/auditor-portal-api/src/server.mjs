import express from 'express';
import https from 'node:https';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { authMiddleware } from './auth.mjs';
import {
  makeS3,
  listPrefixes,
  listKeys,
  getJsonObject,
  presignGet,
  headObject,
  putObjectJson,
  deleteObject,
} from './s3.mjs';
import {
  listDocIds,
  getLatestDoc,
  listDocVersions,
  listVersions,
  getVersion,
  writeNewDocVersion,
  applyFinanceAppend,
  applyMarkdownAppend,
} from './docs-store.mjs';
import { putProposal, getProposal, putJson as putJsonMail, listMailEvents, getMailEvent } from './mail-store.mjs';
import { sha256HexJson, summarizeAllowlistDiff, makeActorFromReq, makeSourceFromReq } from './config-ledger.mjs';

const PORT = Number(process.env.PORT || '8790');

const LEDGER_BUCKET = (process.env.LEDGER_BUCKET || '').trim();
const LEDGER_PREFIX = (process.env.LEDGER_PREFIX || 'ledger').replace(/^\/+|\/+$/g, '');
const DOC_LEDGER_PREFIX = (process.env.DOC_LEDGER_PREFIX || 'doc-ledger').replace(/^\/+|\/+$/g, '');
const DOC_LEDGER_PENDING_PREFIX = (process.env.DOC_LEDGER_PENDING_PREFIX || `${DOC_LEDGER_PREFIX}/_pending`).replace(
  /^\/+|\/+$/g,
  ''
);
const ROLLUP_PREFIX = (process.env.LEDGER_ROLLUP_PREFIX || 'ledger-rollups').replace(/^\/+|\/+$/g, '');
const ENRICHED_PREFIX = (process.env.LEDGER_ENRICHED_PREFIX || 'ledger-enriched').replace(/^\/+|\/+$/g, '');

const PACKS_BUCKET = (process.env.PACKS_BUCKET || '').trim();

const DOCS_BUCKET = (process.env.DOCS_BUCKET || '').trim() || LEDGER_BUCKET;
const DOCS_PREFIX = (process.env.DOCS_PREFIX || 'docs-store').replace(/^\/+|\/+$/g, '');

const MAIL_BUCKET = (process.env.MAIL_BUCKET || '').trim() || LEDGER_BUCKET;
const MAIL_EVENTS_PREFIX = (process.env.MAIL_EVENTS_PREFIX || 'mail-events').replace(/^\/+|\/+$/g, '');
const MAIL_PROPOSALS_PREFIX = (process.env.MAIL_PROPOSALS_PREFIX || 'mail-proposals').replace(/^\/+|\/+$/g, '');
const MAIL_ALLOWLIST_DOC_ID = (process.env.MAIL_ALLOWLIST_DOC_ID || 'config/mail-allowlist').trim();

const PORTAL_WRITE_API_KEY = (process.env.PORTAL_WRITE_API_KEY || '').trim() || null;

const ACK_SERVER_URL = (process.env.ACK_SERVER_URL || '').trim() || null;
const ACK_API_KEY = (process.env.ACK_API_KEY || '').trim() || null;

function must(v, name) {
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function isDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
}

function dayPrefix(prefix, date) {
  const [y, m, d] = date.split('-');
  return `${prefix}/${y}/${m}/${d}/`;
}

function requestJson(url, { method = 'GET', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const data = body ? Buffer.from(JSON.stringify(body), 'utf8') : null;
    const req = lib.request(
      {
        method,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + (u.search || ''),
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': data.length } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const txt = Buffer.concat(chunks).toString('utf8');
          let j = null;
          try {
            j = txt ? JSON.parse(txt) : null;
          } catch {}
          resolve({ status: res.statusCode || 0, json: j, text: txt });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function safeKey(k) {
  const s = String(k || '');
  if (!s || s.includes('..') || s.startsWith('/') || s.includes('\\') || s.includes('://')) return null;
  return s;
}

function safeDocId(id) {
  const s = String(id || '').trim();
  if (!s || s.includes('..') || s.startsWith('/') || s.includes('\\') || s.includes('://')) return null;
  return s;
}

function writeAuthMiddleware(req, res, next) {
  if (!PORTAL_WRITE_API_KEY) return res.status(503).json({ ok: false, error: 'write API not configured' });
  const hdr = String(req.headers['x-api-key'] || '').trim();
  if (hdr === PORTAL_WRITE_API_KEY) return next();
  return res.status(401).json({ ok: false, error: 'unauthorized (write)' });
}

const s3 = makeS3();
const app = express();
app.use(express.json({ limit: '512kb' }));

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/v1', authMiddleware);

app.get('/v1/days', async (req, res) => {
  try {
    must(LEDGER_BUCKET, 'LEDGER_BUCKET');
    const years = await listPrefixes(s3, { bucket: LEDGER_BUCKET, prefix: `${LEDGER_PREFIX}/`, delimiter: '/' });
    const days = [];
    for (const ypref of years) {
      const months = await listPrefixes(s3, { bucket: LEDGER_BUCKET, prefix: ypref, delimiter: '/' });
      for (const mpref of months) {
        const dd = await listPrefixes(s3, { bucket: LEDGER_BUCKET, prefix: mpref, delimiter: '/' });
        for (const dpref of dd) {
          const m = new RegExp(`^${LEDGER_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(\\d{4})/(\\d{2})/(\\d{2})/`).exec(dpref);
          if (!m) continue;
          const date = `${m[1]}-${m[2]}-${m[3]}`;
          const rollupKey = `${ROLLUP_PREFIX}/${m[1]}/${m[2]}/${m[3]}/rollup.json`;
          const anchoringStatusKey = `${ROLLUP_PREFIX}/${m[1]}/${m[2]}/${m[3]}/ROLLUP_ANCHORING_STATUS.json`;
          let rollup_exists = false;
          let anchored = false;
          try {
            await headObject(s3, { bucket: LEDGER_BUCKET, key: rollupKey });
            rollup_exists = true;
          } catch {}
          try {
            const statusObj = await getJsonObject(s3, { bucket: LEDGER_BUCKET, key: anchoringStatusKey, maxBytes: 4096 });
            anchored = statusObj?.anchored === true;
          } catch {}
          days.push({ date, ledger_prefix: dpref, rollup_exists, anchored });
        }
      }
    }
    days.sort((a, b) => (a.date < b.date ? 1 : -1));
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();
    const out = days.filter((d) => (!from || d.date >= from) && (!to || d.date <= to));
    return res.json({ ok: true, days: out.slice(0, 3650) });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get('/v1/day/:date/entries', async (req, res) => {
  try {
    must(LEDGER_BUCKET, 'LEDGER_BUCKET');
    const date = req.params.date;
    if (!isDate(date)) return res.status(400).json({ ok: false, error: 'bad date' });
    const prefixLedger = dayPrefix(LEDGER_PREFIX, date);
    const prefixEnriched = dayPrefix(ENRICHED_PREFIX, date);
    const limit = Math.min(Number(req.query.limit || '200'), 1000);
    const include = String(req.query.include || '0') === '1';

    let prefix = prefixLedger;
    const enrichedKeys = await listKeys(s3, { bucket: LEDGER_BUCKET, prefix: prefixEnriched, maxKeys: 1 });
    if (enrichedKeys && enrichedKeys.length > 0) prefix = prefixEnriched;

    const keys = await listKeys(s3, { bucket: LEDGER_BUCKET, prefix, maxKeys: 5000 });
    const jsonKeys = keys.filter((x) => x.key.endsWith('.json') && !x.key.endsWith('index.jsonl'));
    jsonKeys.sort((a, b) => (a.key < b.key ? 1 : -1));
    const sliced = jsonKeys.slice(0, limit);
    if (!include) return res.json({ ok: true, bucket: LEDGER_BUCKET, prefix, entries: sliced });

    const loaded = [];
    for (const it of sliced) {
      try {
        const j = await getJsonObject(s3, { bucket: LEDGER_BUCKET, key: it.key, maxBytes: 2_000_000 });
        loaded.push({ key: it.key, meta: it, entry: j });
      } catch {
        loaded.push({ key: it.key, meta: it, entry: null });
      }
    }
    return res.json({ ok: true, bucket: LEDGER_BUCKET, prefix, entries: loaded });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get('/v1/rollup/:date', async (req, res) => {
  try {
    must(LEDGER_BUCKET, 'LEDGER_BUCKET');
    const date = req.params.date;
    if (!isDate(date)) return res.status(400).json({ ok: false, error: 'bad date' });
    const [y, m, d] = date.split('-');
    const rollupKey = `${ROLLUP_PREFIX}/${y}/${m}/${d}/rollup.json`;
    const manifestKey = `${ROLLUP_PREFIX}/${y}/${m}/${d}/manifest.json`;
    const anchoringStatusKey = `${ROLLUP_PREFIX}/${y}/${m}/${d}/ROLLUP_ANCHORING_STATUS.json`;
    const rollup = await getJsonObject(s3, { bucket: LEDGER_BUCKET, key: rollupKey, maxBytes: 3_000_000 });
    let manifest = null;
    let rollup_anchoring_status = null;
    try {
      manifest = await getJsonObject(s3, { bucket: LEDGER_BUCKET, key: manifestKey, maxBytes: 8_000_000 });
    } catch {}
    try {
      rollup_anchoring_status = await getJsonObject(s3, { bucket: LEDGER_BUCKET, key: anchoringStatusKey, maxBytes: 4096 });
    } catch {}
    return res.json({ ok: true, bucket: LEDGER_BUCKET, rollupKey, manifestKey, rollup, manifest, rollup_anchoring_status });
  } catch (e) {
    const code = e?.name === 'NoSuchKey' ? 404 : 500;
    return res.status(code).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get('/v1/object', async (req, res) => {
  try {
    const key = safeKey(req.query.key);
    if (!key) return res.status(400).json({ ok: false, error: 'bad key' });
    const bucket = String(req.query.bucket || LEDGER_BUCKET).trim();
    if (!bucket) return res.status(400).json({ ok: false, error: 'missing bucket' });
    const j = await getJsonObject(s3, { bucket, key, maxBytes: 8_000_000 });
    return res.json({ ok: true, bucket, key, json: j });
  } catch (e) {
    const code = e?.name === 'NoSuchKey' ? 404 : 500;
    return res.status(code).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get('/v1/presign', async (req, res) => {
  try {
    const key = safeKey(req.query.key);
    if (!key) return res.status(400).json({ ok: false, error: 'bad key' });
    const bucket = String(req.query.bucket || LEDGER_BUCKET).trim();
    const expiresSec = Math.min(Number(req.query.expires || '900'), 3600);
    if (!bucket) return res.status(400).json({ ok: false, error: 'missing bucket' });
    const url = await presignGet(s3, { bucket, key, expiresSec });
    return res.json({ ok: true, url, bucket, key, expires: expiresSec });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get('/v1/ack/:fingerprint', async (req, res) => {
  try {
    if (!ACK_SERVER_URL) return res.json({ ok: true, ack: null });
    const fp = String(req.params.fingerprint || '').trim();
    if (!fp) return res.status(400).json({ ok: false, error: 'missing fingerprint' });
    const r = await requestJson(`${ACK_SERVER_URL.replace(/\/+$/, '')}/ack/${fp}`, {
      headers: ACK_API_KEY ? { 'x-api-key': ACK_API_KEY } : {},
    });
    return res.json({ ok: true, ack: r.json?.ack ?? null });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get('/v1/acks', async (req, res) => {
  try {
    if (!ACK_SERVER_URL) return res.json({ ok: true, acks: [] });
    const limit = Math.min(Number(req.query.limit || '200'), 1000);
    const activeOnly = String(req.query.active ?? '1') !== '0';
    const r = await requestJson(
      `${ACK_SERVER_URL.replace(/\/+$/, '')}/acks?limit=${limit}&active=${activeOnly ? '1' : '0'}`,
      { headers: ACK_API_KEY ? { 'x-api-key': ACK_API_KEY } : {} }
    );
    return res.json({ ok: true, acks: r.json?.acks ?? [] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post('/v1/ack', async (req, res) => {
  try {
    if (!ACK_SERVER_URL) return res.status(400).json({ ok: false, error: 'ACK server not configured' });
    const body = req.body || {};
    if (!String(body.fingerprint || '').trim()) return res.status(400).json({ ok: false, error: 'missing fingerprint' });
    if (!String(body.ack_by || '').trim()) return res.status(400).json({ ok: false, error: 'missing ack_by' });
    const r = await requestJson(`${ACK_SERVER_URL.replace(/\/+$/, '')}/ack`, {
      method: 'POST',
      headers: ACK_API_KEY ? { 'x-api-key': ACK_API_KEY } : {},
      body,
    });
    if (r.status < 200 || r.status >= 300) return res.status(502).json({ ok: false, error: 'ack upstream failed' });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// --- Config: mail allowlist ---
app.get('/v1/config/mail-allowlist', async (req, res) => {
  try {
    const docId = MAIL_ALLOWLIST_DOC_ID;
    const latest = await getLatestDoc(s3, { bucket: DOCS_BUCKET, docsPrefix: DOCS_PREFIX, docId });
    if (!latest?.content) {
      return res.json({
        ok: true,
        doc_id: docId,
        allowlist: { version: 1, mode: 'deny_all', allowed_from: [], allowed_from_regex: '' },
      });
    }
    if (latest.format !== 'json') return res.status(400).json({ ok: false, error: 'allowlist doc must be json' });
    return res.json({ ok: true, doc_id: docId, allowlist: latest.content, key: latest.key });
  } catch (e) {
    const msg = String(e?.message || e);
    if (e?.name === 'NoSuchKey' || msg.includes('NoSuchKey') || msg.includes('not found')) {
      return res.json({
        ok: true,
        doc_id: MAIL_ALLOWLIST_DOC_ID,
        allowlist: { version: 1, mode: 'deny_all', allowed_from: [], allowed_from_regex: '' },
      });
    }
    return res.status(500).json({ ok: false, error: msg });
  }
});

app.post('/v1/config/mail-allowlist', writeAuthMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const operator_id = String(body.operator_id || '').trim() || 'operator';
    const mode = String(body.mode || 'deny_all').trim();
    if (!['deny_all', 'allow_all'].includes(mode)) return res.status(400).json({ ok: false, error: 'bad mode' });

    const allowed_from = Array.isArray(body.allowed_from)
      ? body.allowed_from.map((s) => String(s).trim().toLowerCase()).filter(Boolean)
      : String(body.allowed_from || '')
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
    const allowed_from_regex = String(body.allowed_from_regex || '').trim();
    if (allowed_from_regex) {
      try {
        new RegExp(allowed_from_regex, 'i');
      } catch {
        return res.status(400).json({ ok: false, error: 'invalid regex' });
      }
    }

    const docId = MAIL_ALLOWLIST_DOC_ID;

    let prev = null;
    let prevKey = null;
    try {
      const latest = await getLatestDoc(s3, { bucket: DOCS_BUCKET, docsPrefix: DOCS_PREFIX, docId });
      if (latest?.format === 'json') {
        prev = latest.content;
        prevKey = latest.key || null;
      }
    } catch {
      prev = null;
      prevKey = null;
    }

    const next = {
      version: 1,
      mode,
      allowed_from,
      allowed_from_regex,
      updated_at: new Date().toISOString(),
      updated_by: operator_id,
    };

    const strictLedger = ['1', 'true', 'yes'].includes(String(process.env.REQUIRE_CONFIG_LEDGER || '').trim());

    // -------- Phase A: prepare ledger entry (pending) --------
    const prev_sha256 = prev ? sha256HexJson(prev) : null;
    const new_sha256 = sha256HexJson(next);
    const diff_summary = summarizeAllowlistDiff(prev, next);
    const actor = makeActorFromReq(req);
    const source = makeSourceFromReq(req);
    const stamp = new Date().toISOString();
    const y = stamp.slice(0, 4);
    const m = stamp.slice(5, 7);
    const d = stamp.slice(8, 10);

    const entryBase = {
      version: 1,
      domain: 'config',
      kind: 'config_change',
      doc_id: docId,
      generated_at: stamp,
      actor,
      source,
      storage: {
        bucket: DOCS_BUCKET,
        prev_latest_key: prevKey,
        latest_key: null,
        version_key: null,
      },
      hash: { prev_sha256, new_sha256 },
      diff_summary,
    };
    const entrySha = sha256HexJson(entryBase);
    const pendingKey = `${DOC_LEDGER_PENDING_PREFIX}/config-mail-allowlist-${entrySha}.json`;

    let pendingWritten = false;
    try {
      await putObjectJson(s3, { bucket: LEDGER_BUCKET, key: pendingKey, json: entryBase });
      pendingWritten = true;
    } catch (e) {
      if (strictLedger) {
        throw new Error(`config ledger prepare failed: ${String(e?.message || e)}`);
      }
    }

    // -------- Phase B: commit docs-store (new version + latest) --------
    let write;
    try {
      write = await writeNewDocVersion(s3, {
        bucket: DOCS_BUCKET,
        docsPrefix: DOCS_PREFIX,
        docId,
        format: 'json',
        newContent: next,
      });
    } catch (e) {
      if (strictLedger) {
        throw new Error(`docs-store write failed: ${String(e?.message || e)}`);
      }
      throw e;
    }

    // -------- Phase C: finalize ledger entry (move to dated prefix) --------
    const entryFinal = {
      ...entryBase,
      storage: {
        ...entryBase.storage,
        latest_key: write.latest_key,
        version_key: write.version_key,
      },
    };
    const finalKey = `${DOC_LEDGER_PREFIX}/${y}/${m}/${d}/config-mail-allowlist-${entrySha}.json`;

    try {
      await putObjectJson(s3, { bucket: LEDGER_BUCKET, key: finalKey, json: entryFinal });
      if (pendingWritten) {
        try {
          await deleteObject(s3, { bucket: LEDGER_BUCKET, key: pendingKey });
        } catch {
          // best-effort cleanup; GC will remove stale pending
        }
      }
    } catch (e) {
      if (strictLedger) {
        throw new Error(`config ledger finalize failed: ${String(e?.message || e)}`);
      }
    }

    return res.json({
      ok: true,
      doc_id: docId,
      allowlist: next,
      version_key: write.version_key,
      latest_key: write.latest_key,
      ledger_key: finalKey,
      pending_key: pendingWritten ? pendingKey : null,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// --- Mail inbox (read) ---
app.get('/v1/mail/inbox', async (req, res) => {
  try {
    const prefix = String(req.query.prefix || `${MAIL_EVENTS_PREFIX}/`).trim();
    const limit = Math.min(Number(req.query.limit || '200'), 500);
    const keys = await listMailEvents(s3, { bucket: MAIL_BUCKET, prefix, limit });
    return res.json({ ok: true, bucket: MAIL_BUCKET, prefix, items: keys });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get('/v1/mail/get', async (req, res) => {
  try {
    const key = safeKey(req.query.key);
    if (!key) return res.status(400).json({ ok: false, error: 'bad key' });
    const j = await getMailEvent(s3, { bucket: MAIL_BUCKET, key });
    return res.json({ ok: true, bucket: MAIL_BUCKET, key, mail: j });
  } catch (e) {
    const code = e?.name === 'NoSuchKey' ? 404 : 500;
    return res.status(code).json({ ok: false, error: String(e?.message || e) });
  }
});

const MAIL_DECISIONS_PREFIX = (process.env.MAIL_DECISIONS_PREFIX || 'mail-decisions').replace(/^\/+|\/+$/g, '');

app.post('/v1/mail/decision', writeAuthMiddleware, async (req, res) => {
  try {
    if (!MAIL_BUCKET) return res.status(503).json({ ok: false, error: 'MAIL_BUCKET not configured' });
    const body = req.body || {};
    const key = safeKey(body.key);
    const decision = String(body.decision || '').trim();
    const operator_id = String(body.operator_id || '').trim() || 'operator';
    if (!key) return res.status(400).json({ ok: false, error: 'bad or missing key' });
    if (!['accept', 'reject', 'escalate', 'request_info'].includes(decision))
      return res.status(400).json({ ok: false, error: 'decision must be accept|reject|escalate|request_info' });
    const stamp = new Date().toISOString();
    const y = stamp.slice(0, 4);
    const m = stamp.slice(5, 7);
    const d = stamp.slice(8, 10);
    const sha = createHash('sha256').update(key + stamp).digest('hex').slice(0, 16);
    const decisionKey = `${MAIL_DECISIONS_PREFIX}/${y}/${m}/${d}/${sha}.json`;
    const record = { version: 1, key, decision, operator_id, at: stamp };
    await putJsonMail(s3, { bucket: MAIL_BUCKET, key: decisionKey, json: record });
    return res.json({ ok: true, key, decision, decision_key: decisionKey });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// --- Document Store (docs-store) ---
app.get('/v1/docs/list', async (req, res) => {
  try {
    if (!DOCS_BUCKET) return res.status(503).json({ ok: false, error: 'DOCS_BUCKET not configured' });
    const ids = await listDocIds(s3, { bucket: DOCS_BUCKET, docsPrefix: DOCS_PREFIX });
    return res.json({ ok: true, doc_ids: ids, bucket: DOCS_BUCKET, prefix: DOCS_PREFIX });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get('/v1/docs/get', async (req, res) => {
  try {
    const docId = String(req.query.doc_id || '').trim();
    if (!docId) return res.status(400).json({ ok: false, error: 'bad or missing doc_id' });
    if (!DOCS_BUCKET) return res.status(503).json({ ok: false, error: 'DOCS_BUCKET not configured' });
    const latest = await getLatestDoc(s3, { bucket: DOCS_BUCKET, docsPrefix: DOCS_PREFIX, docId });
    return res.json({ ok: true, doc: latest });
  } catch (e) {
    const code = e?.name === 'NoSuchKey' ? 404 : 500;
    return res.status(code).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get('/v1/docs/versions', async (req, res) => {
  try {
    const docId = String(req.query.doc_id || '').trim();
    if (!docId) return res.status(400).json({ ok: false, error: 'bad or missing doc_id' });
    if (!DOCS_BUCKET) return res.status(503).json({ ok: false, error: 'DOCS_BUCKET not configured' });
    const limit = Math.min(Number(req.query.limit || '50'), 200);
    const versions = await listDocVersions(s3, { bucket: DOCS_BUCKET, docsPrefix: DOCS_PREFIX, docId, limit });
    return res.json({ ok: true, versions });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get('/v1/docs/version', async (req, res) => {
  try {
    const docId = safeDocId(req.query.doc_id);
    const key = safeKey(req.query.key);
    if (!docId || !key) return res.status(400).json({ ok: false, error: 'bad or missing doc_id/key' });
    if (!DOCS_BUCKET) return res.status(503).json({ ok: false, error: 'DOCS_BUCKET not configured' });
    const out = await getVersion(s3, { bucket: DOCS_BUCKET }, docId, key);
    if (!out) return res.status(404).json({ ok: false, error: 'not found' });
    return res.json({ ok: true, key: out.key, content: out.content, format: out.format });
  } catch (e) {
    const code = e?.name === 'NoSuchKey' ? 404 : 500;
    return res.status(code).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post('/v1/docs/propose', writeAuthMiddleware, async (req, res) => {
  try {
    if (!MAIL_BUCKET) return res.status(503).json({ ok: false, error: 'MAIL_BUCKET not configured' });
    const proposal = req.body || {};
    const out = await putProposal(s3, { bucket: MAIL_BUCKET, proposalsPrefix: MAIL_PROPOSALS_PREFIX, proposal: { ...proposal, status: 'pending' } });
    return res.json({ ok: true, stored: out });
  } catch (e) {
    return res.status(400).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post('/v1/docs/approve', writeAuthMiddleware, async (req, res) => {
  try {
    if (!DOCS_BUCKET || !LEDGER_BUCKET) return res.status(503).json({ ok: false, error: 'DOCS_BUCKET or LEDGER_BUCKET not configured' });
    const { proposal_id, operator_id, decision, apply_mode } = req.body || {};
    if (!proposal_id || !operator_id || !decision) return res.status(400).json({ ok: false, error: 'missing fields' });
    const d = String(decision);
    if (!['approve', 'reject'].includes(d)) return res.status(400).json({ ok: false, error: 'bad decision' });

    const { key: proposalKey, proposal } = await getProposal(s3, { bucket: MAIL_BUCKET, proposalsPrefix: MAIL_PROPOSALS_PREFIX, proposalId: proposal_id });
    proposal.status = d === 'approve' ? 'approved' : 'rejected';
    proposal.approved_by = operator_id;
    proposal.approved_at = new Date().toISOString();
    proposal.apply_mode = apply_mode || 'safe_auto';

    await putJsonMail(s3, { bucket: MAIL_BUCKET, key: proposalKey, json: proposal });

    if (d === 'reject') return res.json({ ok: true, decision: 'reject' });

    const docId = String(proposal.doc_id || '');
    const mode = String(proposal.mode || '');
    const patch = proposal.patch || {};

    const latest = await getLatestDoc(s3, { bucket: DOCS_BUCKET, docsPrefix: DOCS_PREFIX, docId });
    let beforeText = latest.format === 'json' ? JSON.stringify(latest.content, null, 2) : String(latest.content || '');

    let nextContent = null;
    let nextFormat = latest.format;
    if (docId === 'finance/payments' && mode === 'append_json') {
      const appendItems = Array.isArray(patch.append_items) ? patch.append_items : [];
      const { next } = applyFinanceAppend(latest.content, appendItems);
      nextContent = next;
      nextFormat = 'json';
    } else if (docId === 'mura-menasa/handbook' && mode === 'append_markdown') {
      const block = String(patch.append_markdown || '');
      nextContent = applyMarkdownAppend(latest.content, block);
      nextFormat = 'md';
    } else {
      return res.status(400).json({ ok: false, error: 'unsupported doc_id/mode for MVP' });
    }

    const write = await writeNewDocVersion(s3, {
      bucket: DOCS_BUCKET,
      docsPrefix: DOCS_PREFIX,
      docId,
      format: nextFormat,
      newContent: nextContent,
    });
    const afterText = nextFormat === 'json' ? JSON.stringify(nextContent, null, 2) : String(nextContent || '');

    const stamp = new Date().toISOString();
    const y = stamp.slice(0, 4);
    const m = stamp.slice(5, 7);
    const dd = stamp.slice(8, 10);
    const ledgerKey = `doc-ledger/${y}/${m}/${dd}/${createHash('sha256').update(docId + proposal_id + stamp).digest('hex').slice(0, 16)}.json`;
    const docLedger = {
      version: 1,
      type: 'doc_update',
      at: stamp,
      doc_id: docId,
      proposal_id,
      operator_id,
      decision: 'approve',
      previous_key: latest.key,
      new_version_key: write.version_key,
      new_latest_key: write.latest_key,
      hash_before_sha256: createHash('sha256').update(beforeText).digest('hex'),
      hash_after_sha256: createHash('sha256').update(afterText).digest('hex'),
    };
    await putObjectJson(s3, { bucket: LEDGER_BUCKET, key: ledgerKey, json: docLedger });

    return res.json({ ok: true, applied: { doc_id: docId, version_key: write.version_key, latest_key: write.latest_key }, doc_ledger_key: ledgerKey });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.listen(PORT, () => {
  console.log(`auditor-portal-api listening :${PORT}`);
  console.log(`ledger: s3://${LEDGER_BUCKET}/${LEDGER_PREFIX}/`);
  console.log(`doc-ledger: s3://${LEDGER_BUCKET}/${DOC_LEDGER_PREFIX}/`);
  console.log(`rollups: s3://${LEDGER_BUCKET}/${ROLLUP_PREFIX}/`);
  if (PACKS_BUCKET) console.log(`packs bucket: s3://${PACKS_BUCKET}/`);
  if (DOCS_BUCKET) console.log(`docs store: s3://${DOCS_BUCKET}/${DOCS_PREFIX}/`);
  if (ACK_SERVER_URL) console.log(`ack proxy: ${ACK_SERVER_URL}`);
});
