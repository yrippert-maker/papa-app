/**
 * ЭЦП с биометрией — подготовка структуры.
 * Подписание документов с подтверждением отпечатком (WebAuthn).
 *
 * MVP: гибридный режим — WebAuthn assertion на клиенте,
 * server-side подпись после верификации assertion.
 *
 * @see docs/ops/ECP_BIOMETRIC.md
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { signExportHash } from './evidence-signing';

export type EcpBiometricConfig = {
  enabled: boolean;
  provider: 'webauthn' | 'idemia' | 'external';
  allowedRoles: string[];
  requireUserVerification: boolean;
  rpId: string;
  timeout: number;
  idemia?: { enabled: boolean };
};

let cachedConfig: EcpBiometricConfig | null = null;

export function getEcpBiometricConfig(): EcpBiometricConfig | null {
  if (cachedConfig) return cachedConfig;
  if (process.env.BIOMETRIC_SIGN_ENABLED === '1') {
    cachedConfig = {
      enabled: true,
      provider: 'webauthn',
      allowedRoles: ['ADMIN', 'MANAGER', 'ENGINEER'],
      requireUserVerification: true,
      rpId: (() => {
        const h = process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, '').split('/')[0] ?? '';
        return h?.startsWith('localhost') ? 'localhost' : h;
      })(),
      timeout: 60000,
    };
    return cachedConfig;
  }
  try {
    const p = join(process.cwd(), 'config', 'ecp-biometric.json');
    if (existsSync(p)) {
      cachedConfig = JSON.parse(readFileSync(p, 'utf8')) as EcpBiometricConfig;
      return cachedConfig;
    }
  } catch {
    // ignore
  }
  return null;
}

export function isBiometricSignEnabled(): boolean {
  const cfg = getEcpBiometricConfig();
  return cfg?.enabled === true;
}

export function isRoleAllowedForBiometricSign(role: string): boolean {
  const cfg = getEcpBiometricConfig();
  if (!cfg?.enabled) return false;
  const r = role.toUpperCase();
  return cfg.allowedRoles.length === 0 || cfg.allowedRoles.some((a) => a.toUpperCase() === r);
}

/**
 * После успешной верификации WebAuthn assertion — подписывает documentHash.
 * Использует evidence-signing (Ed25519).
 * В production: assertion должна быть проверена до вызова.
 */
export function signDocumentAfterBiometricVerify(documentHash: string): {
  signature: string;
  keyId: string;
  signedAt: string;
} {
  const { signature, keyId } = signExportHash(documentHash);
  return {
    signature,
    keyId,
    signedAt: new Date().toISOString(),
  };
}
