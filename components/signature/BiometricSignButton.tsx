'use client';

/**
 * Кнопка «Подписать биометрией» — WebAuthn flow.
 * 1. GET /api/signature/biometric/challenge?documentHash=...
 * 2. startAuthentication(options)
 * 3. POST /api/signature/biometric { documentHash, sessionId, assertion }
 */
import { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';

type Props = {
  documentHash: string;
  onSuccess?: (result: { signature: string; keyId: string; signedAt: string }) => void;
  onError?: (msg: string) => void;
  disabled?: boolean;
};

export function BiometricSignButton({ documentHash, onSuccess, onError, disabled }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!documentHash || loading || disabled) return;
    setLoading(true);
    try {
      const challengeRes = await fetch(
        `/api/signature/biometric/challenge?documentHash=${encodeURIComponent(documentHash)}`
      );
      const challengeData = await challengeRes.json();
      if (!challengeRes.ok) {
        onError?.(challengeData.error || 'Ошибка получения challenge');
        return;
      }
      const { options, sessionId } = challengeData;

      const assertion = await startAuthentication(options);

      const signRes = await fetch('/api/signature/biometric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentHash,
          sessionId,
          assertion,
        }),
      });
      const signData = await signRes.json();
      if (!signRes.ok) {
        onError?.(signData.error || 'Ошибка подписания');
        return;
      }
      onSuccess?.(signData);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка';
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      className="btn btn-secondary text-sm inline-flex items-center gap-2"
    >
      {loading ? '…' : '👆'}
      {loading ? 'Подписание…' : 'Подписать биометрией'}
    </button>
  );
}
