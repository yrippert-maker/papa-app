#!/usr/bin/env node
/**
 * Client for issue-ack-server (used by independent-verify for ack enrichment).
 *
 * Usage: optional; set ACK_SERVER_URL (and ACK_API_KEY) when running independent-verify.
 */
import https from 'node:https';
import http from 'node:http';

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
          try {
            const j = txt ? JSON.parse(txt) : null;
            resolve({ status: res.statusCode || 0, json: j });
          } catch {
            resolve({ status: res.statusCode || 0, json: null });
          }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

export async function getAck(baseUrl, fingerprint, apiKey = null) {
  const hdrs = apiKey ? { 'x-api-key': apiKey } : {};
  const r = await requestJson(`${baseUrl.replace(/\/+$/, '')}/ack/${encodeURIComponent(fingerprint)}`, {
    headers: hdrs,
  });
  return r.json?.ack ?? null;
}

export async function upsertAck(baseUrl, payload, apiKey = null) {
  const hdrs = apiKey ? { 'x-api-key': apiKey } : {};
  const r = await requestJson(`${baseUrl.replace(/\/+$/, '')}/ack`, {
    method: 'POST',
    headers: hdrs,
    body: payload,
  });
  if (r.status < 200 || r.status >= 300) throw new Error(`ack failed http=${r.status}`);
  return true;
}
