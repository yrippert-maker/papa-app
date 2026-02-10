/**
 * T5: audit-pack-service tests
 * Pack generation types, integrity check structure.
 */
import type {
  AuditPackManifest,
  EvidenceIndex,
  LegalHold,
} from '@/lib/audit-pack-service';

jest.mock('@/lib/config', () => ({ WORKSPACE_ROOT: '/tmp/test-audit-pack' }));
jest.mock('@/lib/audit-snapshot-service');
jest.mock('@/lib/compliance-service');
jest.mock('@/lib/retention-service');
jest.mock('@/lib/evidence-signing');
jest.mock('@/lib/db');

describe('audit-pack-service', () => {
  describe('AuditPackManifest type', () => {
    it('has required structure', () => {
      const manifest: AuditPackManifest = {
        pack_version: '1.0',
        pack_id: 'pack-1',
        generated_at: new Date().toISOString(),
        generated_by: 'system',
        period: { from: '2024-01-01', to: '2024-12-31' },
        contents: {
          snapshots: [],
          evidence_index: 'index.json',
          retention_policy: 'policy.json',
          verification_instructions: 'instructions.md',
          keys_inventory: 'keys.json',
          legal_holds: 'holds.json',
        },
        checksums: {},
        pack_hash: 'hash123',
      };
      expect(manifest.pack_id).toBe('pack-1');
      expect(manifest.contents.snapshots).toEqual([]);
    });
  });

  describe('EvidenceIndex type', () => {
    it('has required structure', () => {
      const index: EvidenceIndex = {
        index_version: '1.0',
        generated_at: new Date().toISOString(),
        period_covered: { from: '2024-01-01', to: '2024-12-31' },
        entry_count: 0,
        entries: [],
        index_hash: 'hash',
      };
      expect(index.entry_count).toBe(0);
    });
  });

  describe('LegalHold type', () => {
    it('has required structure', () => {
      const hold: LegalHold = {
        hold_id: 'hold-1',
        reason: 'Litigation',
        custodian: 'legal@test.com',
        start_date: '2024-01-01',
        end_date: null,
        status: 'active',
        scope: {
          from_date: '2024-01-01',
          to_date: '2024-12-31',
          includes_keys: true,
          includes_snapshots: true,
          includes_ledger: true,
        },
        created_by: 'user',
        created_at: new Date().toISOString(),
        released_by: null,
        released_at: null,
      };
      expect(hold.status).toBe('active');
    });
  });
});
