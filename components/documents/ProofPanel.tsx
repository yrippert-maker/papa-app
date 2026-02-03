'use client';

import { useEffect, useState } from 'react';

interface ProofData {
  ledger_event_id: number;
  event: { id: number; event_type: string; created_at: string; block_hash: string };
  signature_valid: boolean;
  chain_valid: boolean;
  anchor: { id: string; merkle_root?: string | null; tx_hash: string | null; status: string } | null;
}

export function ProofPanel({ changeEventId }: { changeEventId: string }) {
  const [proof, setProof] = useState<ProofData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!changeEventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/proof/by-change-event?changeEventId=${encodeURIComponent(changeEventId)}`)
      .then((r) => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error('Proof fetch failed');
        return r.json();
      })
      .then(setProof)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [changeEventId]);

  if (loading) return <p className="text-sm text-slate-500">Загрузка Proof…</p>;
  if (error) return <p className="text-sm text-amber-600">Ошибка: {error}</p>;
  if (!proof) return <p className="text-sm text-slate-500">Нет ledger event для этого изменения</p>;

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2">
        <span className={proof.signature_valid ? 'text-emerald-600' : 'text-amber-600'}>
          {proof.signature_valid ? '✓' : '✗'}
        </span>
        <span>Подпись: {proof.signature_valid ? 'OK' : 'FAIL'}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={proof.chain_valid ? 'text-emerald-600' : 'text-amber-600'}>
          {proof.chain_valid ? '✓' : '✗'}
        </span>
        <span>Цепочка prev_hash: {proof.chain_valid ? 'OK' : 'FAIL'}</span>
      </div>
      <div>
        <p className="text-slate-500">SHA-256 (event):</p>
        <p className="font-mono text-xs break-all">{proof.event.block_hash}</p>
      </div>
      {proof.anchor && (
        <div>
          <p className="text-slate-500">
            Anchor: {proof.anchor.status}
            {proof.anchor.status === 'empty' && ' (период без событий)'}
          </p>
          {proof.anchor.tx_hash && (
            <a
              href={`https://polygonscan.com/tx/${proof.anchor.tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-xs"
            >
              {proof.anchor.tx_hash.slice(0, 18)}…
            </a>
          )}
          {proof.anchor.status === 'pending' && (
            <p className="text-slate-500 text-xs">Ожидает on-chain подтверждения</p>
          )}
        </div>
      )}
    </div>
  );
}
