export {};
declare global {
  interface Window {
    papa?: {
      getVersion?: () => string;
      checkForUpdates?: () => void;
      onUpdateAvailable?: (callback: (info: any) => void) => void;
      onUpdateError?: (callback: (msg: any) => void) => void;
      copyToClipboard?: (text: string) => void;
      [key: string]: any;
    };
  }
}
