/**
 * Unit tests for POST /api/inspection/evidence/verify
 */
import { POST } from '@/app/api/inspection/evidence/verify/route';

jest.mock('@/lib/auth-options', () => ({ authOptions: {} }));

jest.mock('next-auth', () => ({
  getServerSession: () => ({ user: { id: '1', email: 'auditor@local' } }),
}));

jest.mock('@/lib/authz', () => ({
  requirePermission: () => null,
  requirePermissionWithAlias: () => null,
  PERMISSIONS: {},
}));

jest.mock('@/lib/evidence-signing', () => ({
  verifyExportHashWithDetails: jest.fn((hash: string, sig: string, keyId?: string) => {
    if (keyId === 'revoked_key') {
      return { valid: false, keyId, error: 'KEY_REVOKED', revocationReason: 'compromised' };
    }
    if (sig === 'invalid_signature') {
      return { valid: false, keyId, error: 'SIGNATURE_INVALID' };
    }
    if (keyId === 'unknown_key') {
      return { valid: false, keyId, error: 'KEY_NOT_FOUND' };
    }
    return { valid: true, keyId };
  }),
  getKeyStatus: jest.fn((keyId: string) => {
    if (keyId === 'revoked_key') {
      return { keyId, isActive: false, isRevoked: true, revocationInfo: { reason: 'compromised' } };
    }
    if (keyId === 'active_key') {
      return { keyId, isActive: true, isRevoked: false };
    }
    return null;
  }),
}));

jest.mock('@/lib/inspection-evidence', () => ({
  verifyExportContent: jest.fn((exportData: { export_hash: string }) => {
    if (exportData.export_hash === 'tampered_hash') {
      return { valid: false, computedHash: 'correct_hash' };
    }
    return { valid: true, computedHash: exportData.export_hash };
  }),
}));

describe('POST /api/inspection/evidence/verify', () => {
  it('returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost/api/inspection/evidence/verify', {
      method: 'POST',
      body: 'not json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing export_json', async () => {
    const req = new Request('http://localhost/api/inspection/evidence/verify', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('verifies valid content without signature', async () => {
    const req = new Request('http://localhost/api/inspection/evidence/verify', {
      method: 'POST',
      body: JSON.stringify({
        export_json: {
          export_hash: 'valid_hash',
          schema_version: '1',
          exported_at: '2026-01-01',
          inspection_card_id: 'CARD-1',
          card: {},
          check_results: [],
          audit_events: [],
        },
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.content.valid).toBe(true);
    expect(body.signature).toBeUndefined();
  });

  it('verifies valid content with valid signature', async () => {
    const req = new Request('http://localhost/api/inspection/evidence/verify', {
      method: 'POST',
      body: JSON.stringify({
        export_json: {
          export_hash: 'valid_hash',
          export_signature: 'valid_sig',
          export_key_id: 'active_key',
          schema_version: '1',
        },
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.content.valid).toBe(true);
    expect(body.signature?.valid).toBe(true);
    expect(body.signature?.key_id).toBe('active_key');
  });

  it('returns ok=false for tampered content', async () => {
    const req = new Request('http://localhost/api/inspection/evidence/verify', {
      method: 'POST',
      body: JSON.stringify({
        export_json: { export_hash: 'tampered_hash' },
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.content.valid).toBe(false);
    expect(body.content.computed_hash).toBe('correct_hash');
    expect(body.errors).toContain('Content hash mismatch: export may have been tampered with');
  });

  it('returns ok=false for revoked key', async () => {
    const req = new Request('http://localhost/api/inspection/evidence/verify', {
      method: 'POST',
      body: JSON.stringify({
        export_json: {
          export_hash: 'valid_hash',
          export_signature: 'valid_sig',
          export_key_id: 'revoked_key',
        },
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.signature?.valid).toBe(false);
    expect(body.signature?.error).toBe('KEY_REVOKED');
    expect(body.signature?.revocation_reason).toBe('compromised');
    expect(body.signature?.key_status?.is_revoked).toBe(true);
    expect(body.errors).toContain('Signature key has been revoked: compromised');
  });

  it('returns ok=false for invalid signature', async () => {
    const req = new Request('http://localhost/api/inspection/evidence/verify', {
      method: 'POST',
      body: JSON.stringify({
        export_json: { export_hash: 'valid_hash' },
        signature: 'invalid_signature',
        key_id: 'active_key',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.signature?.valid).toBe(false);
    expect(body.signature?.error).toBe('SIGNATURE_INVALID');
    expect(body.errors).toContain('Signature is invalid');
  });

  it('returns ok=false for unknown key', async () => {
    const req = new Request('http://localhost/api/inspection/evidence/verify', {
      method: 'POST',
      body: JSON.stringify({
        export_json: { export_hash: 'valid_hash' },
        signature: 'some_sig',
        key_id: 'unknown_key',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.signature?.error).toBe('KEY_NOT_FOUND');
    expect(body.errors).toContain('Signing key not found');
  });
});
