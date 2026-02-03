/**
 * Unit-тесты для lib/workspace — защита от Path Traversal.
 */
import { resolve } from 'path';

jest.mock('@/lib/config', () => ({
  WORKSPACE_ROOT: '/tmp/papa-workspace',
}));

const MOCK_ROOT = '/tmp/papa-workspace';

import { isPathInsideWorkspace, resolveWorkspacePath } from '@/lib/workspace';

describe('isPathInsideWorkspace', () => {
  it('allows path inside workspace', () => {
    expect(isPathInsideWorkspace(MOCK_ROOT)).toBe(true);
    expect(isPathInsideWorkspace(resolve(MOCK_ROOT, 'ai-inbox'))).toBe(true);
    expect(isPathInsideWorkspace(resolve(MOCK_ROOT, '00_SYSTEM/db'))).toBe(true);
  });

  it('blocks path traversal outside workspace', () => {
    expect(isPathInsideWorkspace(resolve(MOCK_ROOT, '..'))).toBe(false);
    expect(isPathInsideWorkspace(resolve(MOCK_ROOT, '../etc'))).toBe(false);
    expect(isPathInsideWorkspace('/etc/passwd')).toBe(false);
    expect(isPathInsideWorkspace(resolve(MOCK_ROOT, 'sub/../../etc'))).toBe(false);
  });
});

describe('resolveWorkspacePath', () => {
  it('returns path for valid relative dir', () => {
    const result = resolveWorkspacePath('');
    expect(result).toBe(MOCK_ROOT);
    expect(resolveWorkspacePath('ai-inbox')).toContain('ai-inbox');
  });

  it('throws for path traversal', () => {
    expect(() => resolveWorkspacePath('../../../etc')).toThrow('Path traversal blocked');
    expect(() => resolveWorkspacePath('..')).toThrow('Path traversal blocked');
    expect(() => resolveWorkspacePath('sub/../../etc')).toThrow('Path traversal blocked');
  });
});
