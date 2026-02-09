/**
 * WebAuthn passkey registration for ЭЦП с биометрией.
 * GET: registration options
 * POST: verify + save credential
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { getEcpBiometricConfig, isRoleAllowedForBiometricSign } from '@/lib/ecp-biometric';
import { getCredentialsForUser, saveCredential } from '@/lib/webauthn-credentials';
import { setChallenge, getChallenge, deleteChallenge } from '@/lib/webauthn-challenge-store';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

function getRpConfig() {
  const cfg = getEcpBiometricConfig();
  const rpId = cfg?.rpId || 'localhost';
  const origin =
    process.env.NEXTAUTH_URL?.replace(/\/$/, '') ||
    `http://${rpId}:${process.env.PORT || 3001}`;
  return { rpId, rpName: 'ПАПА', origin };
}

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.LEDGER_APPEND, null as unknown as Request);
  if (err) return err;

  if (!getEcpBiometricConfig()?.enabled) {
    return NextResponse.json({ error: 'ЭЦП с биометрией отключена' }, { status: 503 });
  }

  const role = ((session?.user as { role?: string })?.role ?? '').toUpperCase();
  if (!isRoleAllowedForBiometricSign(role)) {
    return NextResponse.json({ error: 'Роль не имеет права' }, { status: 403 });
  }

  const userId = (session?.user?.id as string) ?? 'anonymous';
  const { rpId, rpName } = getRpConfig();
  const existingCreds = getCredentialsForUser(userId);

  const options = await generateRegistrationOptions({
    rpName,
    rpID: rpId === 'localhost' ? 'localhost' : rpId,
    userID: new TextEncoder().encode(userId),
    userName: (session?.user?.email as string) ?? userId,
    attestationType: 'none',
    excludeCredentials: existingCreds.map((c) => ({
      id: c.id,
      transports: c.transports as ('usb' | 'nfc' | 'ble' | 'internal')[] | undefined,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
      authenticatorAttachment: 'platform',
    },
  });

  setChallenge(`reg:${userId}`, options.challenge);
  return NextResponse.json(options);
}

const Body = z.object({
  response: z.unknown(),
});

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.LEDGER_APPEND, request);
  if (err) return err;

  if (!getEcpBiometricConfig()?.enabled) {
    return NextResponse.json({ error: 'ЭЦП с биометрией отключена' }, { status: 503 });
  }

  const userId = (session?.user?.id as string) ?? 'anonymous';
  const { rpId, origin } = getRpConfig();

  try {
    const raw = await request.json();
    const { response } = Body.parse(raw);

    const expectedChallenge = getChallenge(`reg:${userId}`);
    if (!expectedChallenge) {
      return NextResponse.json(
        { error: 'Истёк срок действия. Запросите GET /api/signature/biometric/register снова.' },
        { status: 400 }
      );
    }

    const verification = await verifyRegistrationResponse({
      response: response as RegistrationResponseJSON,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpId === 'localhost' ? 'localhost' : rpId,
    });

    deleteChallenge(`reg:${userId}`);

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ verified: false, error: 'Верификация не пройдена' }, { status: 400 });
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const publicKeyB64 = Buffer.from(credential.publicKey).toString('base64');

    saveCredential(userId, {
      id: credential.id,
      publicKey: publicKeyB64,
      counter: credential.counter,
      transports: credential.transports,
    });

    return NextResponse.json({
      verified: true,
      credentialId: credential.id,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    });
  } catch (e) {
    console.error('[signature/biometric/register]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Ошибка регистрации' },
      { status: 500 }
    );
  }
}
