/**
 * Ensures lib/authz/routes-export.mjs stays in sync with lib/authz/routes.ts.
 * When adding routes, update both files.
 */
import { ROUTE_REGISTRY, VALID_PERMISSIONS } from '../../lib/authz/routes-export.mjs';

describe('routes-export sync', () => {
  it('route count matches expected (17)', () => {
    expect(ROUTE_REGISTRY.length).toBe(17);
  });

  it('all permissions in registry are valid', () => {
    for (const r of ROUTE_REGISTRY) {
      expect(VALID_PERMISSIONS.has(r.permission)).toBe(true);
    }
  });

  it('no duplicate method+path', () => {
    const seen = new Set();
    for (const r of ROUTE_REGISTRY) {
      const k = `${r.method} ${r.path}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });

  it('expected routes present', () => {
    const keys = new Set(ROUTE_REGISTRY.map((r) => `${r.method} ${r.path}`));
    const expected = [
      'GET /api/admin/users',
      'POST /api/admin/users',
      'PATCH /api/admin/users/:id',
      'GET /api/tmc/items',
      'GET /api/tmc/lots',
      'GET /api/tmc/requests',
      'GET /api/inspection/cards',
      'GET /api/inspection/cards/:id',
      'GET /api/files/list',
      'GET /api/ai-inbox',
      'POST /api/files/upload',
      'GET /api/workspace/status',
      'POST /api/workspace/init',
      'GET /api/ledger/verify',
      'POST /api/ledger/append',
      'GET /api/authz/verify',
      'GET /api/system/verify',
    ];
    for (const e of expected) {
      expect(keys.has(e)).toBe(true);
    }
  });
});
