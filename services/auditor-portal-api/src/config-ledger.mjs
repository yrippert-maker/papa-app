/**
 * Config change ledger: audit trail for allowlist (and other config) changes.
 */
import crypto from 'node:crypto';

export function sha256HexJson(obj) {
  const s = JSON.stringify(obj);
  return crypto.createHash('sha256').update(s).digest('hex');
}

function setFrom(arr) {
  const out = new Set();
  if (Array.isArray(arr)) {
    for (const x of arr) {
      const s = String(x || '').trim().toLowerCase();
      if (s) out.add(s);
    }
  }
  return out;
}

function mapById(arr) {
  const m = new Map();
  if (Array.isArray(arr)) {
    for (const x of arr) {
      const id = String(x?.id || '').trim();
      if (id) m.set(id, x);
    }
  }
  return m;
}

export function summarizeAllowlistDiff(prev, next) {
  const p = prev && typeof prev === 'object' ? prev : {};
  const n = next && typeof next === 'object' ? next : {};

  const pAllowed = p.version === 1 ? setFrom(p.allowed_from) : setFrom(p.default?.allowed_from);
  const nAllowed = n.version === 1 ? setFrom(n.allowed_from) : setFrom(n.default?.allowed_from);

  let added = 0,
    removed = 0;
  for (const x of nAllowed) if (!pAllowed.has(x)) added++;
  for (const x of pAllowed) if (!nAllowed.has(x)) removed++;

  const pm = mapById(p.mailboxes);
  const nm = mapById(n.mailboxes);
  let mailboxes_changed = 0;
  const allMbIds = new Set([...pm.keys(), ...nm.keys()]);
  for (const id of allMbIds) {
    const a = pm.get(id);
    const b = nm.get(id);
    if (!a || !b) {
      mailboxes_changed++;
      continue;
    }
    if (JSON.stringify(a) !== JSON.stringify(b)) mailboxes_changed++;
  }

  const pe = mapById(p.entries);
  const ne = mapById(n.entries);
  let entries_added = 0,
    entries_removed = 0,
    entries_changed = 0;
  const allEIds = new Set([...pe.keys(), ...ne.keys()]);
  for (const id of allEIds) {
    const a = pe.get(id);
    const b = ne.get(id);
    if (!a && b) entries_added++;
    else if (a && !b) entries_removed++;
    else if (a && b && JSON.stringify(a) !== JSON.stringify(b)) entries_changed++;
  }

  return {
    allowed_from_added: added,
    allowed_from_removed: removed,
    mailboxes_changed,
    entries_added,
    entries_removed,
    entries_changed,
  };
}

export function makeActorFromReq(req) {
  const u = req.user || {};
  const rolesClaim = process.env.PORTAL_OIDC_ROLES_CLAIM || 'roles';
  const roles = Array.isArray(u[rolesClaim])
    ? u[rolesClaim]
    : typeof u[rolesClaim] === 'string'
      ? u[rolesClaim].split(/[,\s]+/)
      : [];
  return {
    sub: u.sub || null,
    email: u.email || u.preferred_username || null,
    roles,
  };
}

export function makeSourceFromReq(req) {
  return {
    ip: (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString(),
    user_agent: String(req.headers['user-agent'] || ''),
    request_id: String(req.headers['x-request-id'] || ''),
  };
}
