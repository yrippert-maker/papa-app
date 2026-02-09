/**
 * GET /api/signature/biometric/challenge?documentHash=xxx
 * WebAuthn auth options для подписания документа.
 * Клиент вызывает startAuthentication(options), затем POST /api/signature/biometric.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { getEcpBiometricConfig, isRoleAllowedForBiometricSign } from '@/lib/ecp-biometric';
import { getCredentialsForUser } from '@/lib/webauthn-credentials';
import { setChallenge } from '@/lib/webauthn-challenge-store';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.LEDGER_APPEND, request);
  if (err) return err;

  if (!getEcpBiometricConfig()?.enabled) {
    return NextResponse.json({ error: 'ЭЦП с биометрией отключена' }, { status: 503 });
  }

  const role = ((session?.user as { role?: string })?.role ?? '').toUpperCase();
  if (!isRoleAllowedForBiometricSign(role)) {
    return NextResponse.json({ error: 'Роль не имеет права' }, { status: 403 });
  }

  const documentHash = request.nextUrl.searchParams.get('documentHash');
  if (!documentHash || !/^[a-f0-9]{64}$/i.test(documentHash)) {
    return NextResponse.json({ error: 'documentHash (SHA-256 hex) обязателен' }, { status: 400 });
  }

  const userId = (session?.user?.id as string) ?? 'anonymous';
  const creds = getCredentialsForUser(userId);
  if (creds.length === 0) {
    return NextResponse.json(
      { error: 'Сначала зарегистрируйте passkey (отпечаток). POST /api/signature/biometric/register.' },
      { status: 400 }
    );
  }

  const cfg = getEcpBiometricConfig();
  const rpId = cfg?.rpId || 'localhost';

  const options = await generateAuthenticationOptions({
    rpID: rpId === 'localhost' ? 'localhost' : rpId,
    userVerification: cfg?.requireUserVerification ? 'required' : 'preferred',
    allowCredentials: creds.map((c) => ({
      id: c.id,
      transports: c.transports as ('usb' | 'nfc' | 'ble' | 'internal')[] | undefined,
    })),
  });

  const sessionId = nanoid();
  setChallenge(sessionId, options.challenge);

  return NextResponse.json({
    options,
    sessionId,
    documentHash,
  });
}
