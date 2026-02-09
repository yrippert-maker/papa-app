'use client';

import { useState, useEffect } from 'react';

/**
 * Update banner for Electron: shows when update is downloaded.
 * Only renders when window.papa exists (Electron).
 */
export function UpdateBanner() {
  const [updateReady, setUpdateReady] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const papa = typeof window !== 'undefined' ? window.papa : undefined;
    if (!papa?.onUpdateAvailable || !papa?.onUpdateDownloaded || !papa?.onUpdateError) return;

    papa.onUpdateAvailable((info) => setVersion(info?.version ?? null));
    papa.onUpdateDownloaded(() => setUpdateReady(true));
    papa.onUpdateError((msg) => setError(msg));
  }, []);

  if (!updateReady && !error) return null;

  const handleInstall = () => {
    window.papa?.installUpdate?.();
  };

  if (error) {
    return (
      <div className="bg-amber-100 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-between text-sm">
        <span className="text-amber-800 dark:text-amber-200">
          Ошибка проверки обновлений: {error}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-blue-100 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800 px-4 py-2 flex items-center justify-between text-sm">
      <span className="text-blue-800 dark:text-blue-200">
        Доступно обновление {version ? `v${version}` : ''}. Установить и перезапустить?
      </span>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={handleInstall}
      >
        Установить
      </button>
    </div>
  );
}
