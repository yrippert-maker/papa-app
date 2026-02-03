const BASE = (import.meta as unknown as { env?: { VITE_PORTAL_API_URL?: string } }).env?.VITE_PORTAL_API_URL || 'http://localhost:8790';
const API_KEY = (import.meta as unknown as { env?: { VITE_PORTAL_API_KEY?: string } }).env?.VITE_PORTAL_API_KEY || '';
const AUTH_BEARER = (import.meta as unknown as { env?: { VITE_PORTAL_BEARER?: string } }).env?.VITE_PORTAL_BEARER || '';

function headers(): Record<string, string> {
  const h: Record<string, string> = {};
  if (API_KEY) h['x-api-key'] = API_KEY;
  if (AUTH_BEARER) h['Authorization'] = `Bearer ${AUTH_BEARER}`;
  return h;
}

export async function getJson(path: string) {
  const r = await fetch(`${BASE.replace(/\/+$/, '')}${path}`, { headers: headers() });
  const j = await r.json();
  if (!r.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${r.status}`);
  return j;
}

export async function postJson(path: string, body: unknown) {
  const r = await fetch(`${BASE.replace(/\/+$/, '')}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers() },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${r.status}`);
  return j;
}
