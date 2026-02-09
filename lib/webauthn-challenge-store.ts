/**
 * In-memory challenge store for WebAuthn authentication.
 * Challenge expires after 5 minutes.
 */
const store = new Map<string, { challenge: string; expiresAt: number }>();
const TTL_MS = 5 * 60 * 1000;

export function setChallenge(sessionId: string, challenge: string): void {
  store.set(sessionId, { challenge, expiresAt: Date.now() + TTL_MS });
}

export function getChallenge(sessionId: string): string | null {
  const entry = store.get(sessionId);
  if (!entry || entry.expiresAt < Date.now()) {
    store.delete(sessionId);
    return null;
  }
  return entry.challenge;
}

export function deleteChallenge(sessionId: string): void {
  store.delete(sessionId);
}
