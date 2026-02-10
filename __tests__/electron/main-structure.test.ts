/**
 * E7: Electron main.js structure smoke
 * Verifies that main.js contains expected handlers:
 * - crashReporter
 * - autoUpdater (update check)
 * - handleDeepLink / open-url
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const mainPath = join(process.cwd(), 'electron', 'main.js');

describe('electron main.js structure (E7)', () => {
  let mainContent: string;

  beforeAll(() => {
    mainContent = readFileSync(mainPath, 'utf8');
  });

  it('has crashReporter usage', () => {
    expect(mainContent).toContain('crashReporter');
    expect(mainContent).toContain('crashReporter.start');
  });

  it('has autoUpdater / update check', () => {
    expect(mainContent).toContain('autoUpdater');
    expect(mainContent).toContain('checkForUpdates');
    expect(mainContent).toContain('update-available');
    expect(mainContent).toContain('update-downloaded');
  });

  it('has deep link handler', () => {
    expect(mainContent).toContain('handleDeepLink');
    expect(mainContent).toContain('open-url');
    expect(mainContent).toContain('papa://');
  });

  it('sets protocol client when packaged', () => {
    expect(mainContent).toContain('setAsDefaultProtocolClient');
    expect(mainContent).toContain('papa');
  });
});
