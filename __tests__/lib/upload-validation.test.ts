/**
 * Unit-тесты для валидации имён файлов при загрузке.
 * Логика совпадает с app/api/files/upload (isAllowedFile).
 */
const ALLOWED = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'txt', 'json', 'xml']);
const DANGEROUS = new Set(['exe', 'bat', 'cmd', 'sh', 'ps1', 'vbs', 'scr', 'msi', 'com', 'pif']);

function validateFileName(name: string): boolean {
  const parts = name.split('.');
  const ext = parts.pop()?.toLowerCase();
  if (ext && !ALLOWED.has(ext)) return false;
  if (parts.length >= 1) {
    for (const p of parts) {
      if (DANGEROUS.has(p.toLowerCase())) return false;
    }
  }
  return true;
}

describe('upload filename validation', () => {
  it('allows single extension', () => {
    expect(validateFileName('doc.pdf')).toBe(true);
    expect(validateFileName('report.docx')).toBe(true);
  });

  it('rejects dangerous extensions', () => {
    expect(validateFileName('virus.exe')).toBe(false);
    expect(validateFileName('script.bat')).toBe(false);
  });

  it('rejects double extension (dangerous segment)', () => {
    expect(validateFileName('virus.exe.pdf')).toBe(false);
    expect(validateFileName('report.bat.docx')).toBe(false);
  });

  it('rejects trailing dangerous extension', () => {
    expect(validateFileName('fake.pdf.exe')).toBe(false);
  });

  it('allows safe multi-segment names', () => {
    expect(validateFileName('report.backup.pdf')).toBe(true);
    expect(validateFileName('data.2024.json')).toBe(true);
  });
});
