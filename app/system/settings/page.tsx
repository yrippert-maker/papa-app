"use client";

import React from "react";

export default function SystemSettingsPage() {
  const [config, setConfig] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const isElectron = typeof window !== "undefined" && window.papa;

  React.useEffect(() => {
    if (!isElectron) {
      setLoading(false);
      return;
    }
    window.papa!.readConfig().then((text) => {
      setConfig(text);
      setLoading(false);
    }).catch((e: unknown) => {
      setMessage(e instanceof Error ? e.message : String(e));
      setLoading(false);
    });
  }, [isElectron]);

  async function handleSave() {
    if (!isElectron) return;
    setSaving(true);
    setMessage(null);
    try {
      await window.papa!.writeConfig(config);
      setMessage("Сохранено. Нажмите «Перезапустить», чтобы применить.");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function handleRestart() {
    if (!isElectron) return;
    if (confirm("Перезапустить приложение? Несохранённые изменения в других вкладках будут потеряны.")) {
      window.papa!.restart();
    }
  }

  if (!isElectron) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Настройки (config.env)</h1>
        <p className="mt-2 text-gray-600">
          Редактирование config.env доступно только в desktop-приложении (Electron). В браузере настройте переменные окружения на сервере.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Настройки</h1>
        <p className="mt-2 text-gray-600">Загрузка config.env…</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Настройки (config.env)</h1>
      <p className="text-sm text-gray-600">
        Файл в userData приложения. После сохранения нажмите «Перезапустить», чтобы применить изменения.
      </p>
      <textarea
        className="w-full min-h-[320px] font-mono text-sm border rounded-md p-3"
        value={config}
        onChange={(e) => setConfig(e.target.value)}
        spellCheck={false}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-md bg-gray-800 text-white px-4 py-2 text-sm hover:bg-gray-700 disabled:opacity-50"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Сохранение…" : "Сохранить"}
        </button>
        <button
          type="button"
          className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
          onClick={handleRestart}
        >
          Перезапустить приложение
        </button>
      </div>
      {message ? (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          {message}
        </div>
      ) : null}
    </div>
  );
}
