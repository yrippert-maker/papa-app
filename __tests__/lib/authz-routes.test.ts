/**
 * Deny-by-default: route registry coverage and permission consistency.
 * Every route MUST have an explicit permission. See docs/ENDPOINT_AUTHZ_EVIDENCE.md.
 */
import { routeRegistry } from '@/lib/authz/routes';
import { Permissions } from '@/lib/authz/permissions';

describe('route registry', () => {
  it('each route has method, path, permission', () => {
    for (const r of routeRegistry) {
      expect(r.method).toBeTruthy();
      expect(r.path).toBeTruthy();
      expect(r.permission).toBeTruthy();
    }
  });

  it('no duplicate method+path', () => {
    const seen = new Set<string>();
    for (const r of routeRegistry) {
      const k = `${r.method} ${r.path}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });

  it('all permissions exist in Permissions enum', () => {
    const all = new Set(Object.values(Permissions));
    for (const r of routeRegistry) {
      expect(all.has(r.permission)).toBe(true);
    }
  });

  it('registry covers all protected API routes (deny-by-default)', () => {
    const expected: Array<{ method: string; path: string }> = [
      { method: 'GET', path: '/api/admin/users' },
      { method: 'POST', path: '/api/admin/users' },
      { method: 'PATCH', path: '/api/admin/users/:id' },
      { method: 'GET', path: '/api/tmc/items' },
      { method: 'GET', path: '/api/tmc/lots' },
      { method: 'GET', path: '/api/tmc/requests' },
      { method: 'GET', path: '/api/inspection/cards' },
      { method: 'GET', path: '/api/inspection/report' },
      { method: 'GET', path: '/api/inspection/cards/:id' },
      { method: 'GET', path: '/api/inspection/cards/:id/audit' },
      { method: 'GET', path: '/api/inspection/cards/:id/evidence' },
      { method: 'POST', path: '/api/inspection/evidence/verify' },
      { method: 'POST', path: '/api/inspection/cards/:id/transition' },
      { method: 'POST', path: '/api/inspection/cards/:id/check-results' },
      { method: 'GET', path: '/api/files/list' },
      { method: 'GET', path: '/api/ai-inbox' },
      { method: 'POST', path: '/api/files/upload' },
      { method: 'GET', path: '/api/workspace/status' },
      { method: 'POST', path: '/api/workspace/init' },
      { method: 'GET', path: '/api/ledger/verify' },
      { method: 'POST', path: '/api/ledger/append' },
      { method: 'GET', path: '/api/authz/verify' },
      { method: 'GET', path: '/api/system/verify' },
      { method: 'GET', path: '/api/compliance/keys' },
      { method: 'POST', path: '/api/compliance/keys/rotate' },
      { method: 'POST', path: '/api/compliance/keys/:keyId/revoke' },
      { method: 'GET', path: '/api/compliance/verify-stats' },
    ];
    const reg = new Set(routeRegistry.map((r) => `${r.method} ${r.path}`));
    for (const e of expected) {
      expect(reg.has(`${e.method} ${e.path}`)).toBe(true);
    }
    expect(routeRegistry.length).toBe(expected.length);
  });
});
