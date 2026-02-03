"use client";

import React from "react";

type Health = {
  version: 1;
  generated_at: string;
  status: "ok" | "degraded" | "fail";
  checks: { name: string; ok: boolean; severity: "info" | "warn" | "fail"; message: string; meta?: unknown }[];
};

function badge(status: Health["status"]) {
  const base = "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium";
  if (status === "ok") return <span className={`${base} bg-green-100 text-green-900`}>OK</span>;
  if (status === "degraded") return <span className={`${base} bg-yellow-100 text-yellow-900`}>DEGRADED</span>;
  return <span className={`${base} bg-red-100 text-red-900`}>FAIL</span>;
}

export default function SystemHealthPage() {
  const [data, setData] = React.useState<Health | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/system/health", { cache: "no-store" });
      const j = (await r.json()) as Health;
      setData(j);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">System Health</h1>
        {data ? badge(data.status) : null}
        <div className="ml-auto flex gap-2">
          <button
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
            onClick={load}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {err ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-900">{err}</div> : null}

      {data ? (
        <div className="space-y-3">
          <div className="text-sm text-gray-600">Generated: {data.generated_at}</div>

          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-3">Check</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Message</th>
                </tr>
              </thead>
              <tbody>
                {data.checks.map((c) => (
                  <tr key={c.name} className="border-t">
                    <td className="p-3 font-mono">{c.name}</td>
                    <td className="p-3">
                      {c.ok ? (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-green-900">OK</span>
                      ) : c.severity === "fail" ? (
                        <span className="rounded-full bg-red-100 px-2 py-1 text-red-900">FAIL</span>
                      ) : (
                        <span className="rounded-full bg-yellow-100 px-2 py-1 text-yellow-900">WARN</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div>{c.message}</div>
                      {c.meta ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-gray-600">details</summary>
                          <pre className="mt-2 overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
                            {JSON.stringify(c.meta, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-600">Loading…</div>
      )}
    </div>
  );
}
