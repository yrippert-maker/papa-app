/**
 * Electron preload API (window.papa).
 * Exposed via contextBridge in electron/preload.js.
 */
declare global {
  interface Window {
    papa?: {
      readConfig: () => Promise<string>;
      writeConfig: (text: string) => Promise<boolean>;
      restart: () => Promise<void>;
      onUpdateAvailable?: (cb: (info: { version?: string }) => void) => void;
      onUpdateDownloaded?: (cb: () => void) => void;
      onUpdateError?: (cb: (msg: string) => void) => void;
      installUpdate?: () => void;
    };
  }
}

export {};
