/**
 * POST /api/signature/biometric
 * ЭЦП с биометрией — верификация WebAuthn assertion + подпись.
 *
 * Body: { documentHash, sessionId, assertion } — после GET /challenge и startAuthentication.
 * Или: { documentHash, assertionVerified: true } — fallback без полной WebAuthn.
 *
 * @see docs/ops/ECP_BIOMETRIC.md
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { appendLedgerEvent } from '@/lib/ledger-hash';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import {
  isBiometricSignEnabled,
  isRoleAllowedForBiometricSign,
  signDocumentAfterBiometricVerify,
  getEcpBiometricConfig,
} from '@/lib/ecp-biometric';
import { getCredentialById, updateCredentialCounter } from '@/lib/webauthn-credentials';
import { getChallenge, deleteChallenge } from '@/lib/webauthn-challenge-store';
import { z } from 'zod';

const Body = z.object({
  documentHash: z.string().min(1).regex(/^[a-f0-9]{64}$/i),
  sessionId: z.string().optional(),
  assertion: z.unknown().optional(),
  assertionVerified: z.boolean().optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.LEDGER_APPEND, request);
  if (err) return err;

  if (!isBiometricSignEnabled()) {
    return NextResponse.json(
      { error: 'ЭЦП с биометрией отключена. Включите в config/ecp-biometric.json или BIOMETRIC_SIGN_ENABLED=1' },
      { status: 503 }
    );
  }

  const role = ((session?.user as { role?: string })?.role ?? '').toUpperCase();
  if (!isRoleAllowedForBiometricSign(role)) {
    return NextResponse.json(
      { error: 'Роль не имеет права на подписание с биометрией' },
      { status: 403 }
    );
  }

  try {
    const raw = await request.json();
    const body = Body.parse(raw);

    let verified = false;

    if (body.assertion && body.sessionId) {
      const expectedChallenge = getChallenge(body.sessionId);
      if (!expectedChallenge) {
        return NextResponse.json(
          { error: 'Истёк срок сессии. Запросите GET /api/signature/biometric/challenge снова.' },
          { status: 400 }
        );
      }

      const userId = (session?.user?.id as string) ?? 'anonymous';
      const assertion = body.assertion as AuthenticationResponseJSON;
      const credentialId = assertion.id;
      const credential = getCredentialById(userId, credentialId);

      if (!credential) {
        return NextResponse.json(
          { error: 'Credential не найден. Зарегистрируйте passkey заново.' },
          { status: 400 }
        );
      }

      const cfg = getEcpBiometricConfig();
      const rpId = cfg?.rpId || 'localhost';
      const origin =
        process.env.NEXTAUTH_URL?.replace(/\/$/, '') ||
        `http://${rpId}:${process.env.PORT || 3001}`;

      const verification = await verifyAuthenticationResponse({
        response: assertion,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpId === 'localhost' ? 'localhost' : rpId,
        credential: {
          id: credential.id,
          publicKey: Buffer.from(credential.publicKey, 'base64'),
          counter: credential.counter,
          transports: credential.transports as ('usb' | 'nfc' | 'ble' | 'internal')[] | undefined,
        },
      });

      deleteChallenge(body.sessionId);
      verified = verification.verified;

      if (verified && verification.authenticationInfo) {
        updateCredentialCounter(userId, credentialId, verification.authenticationInfo.newCounter);
      }
    } else if (body.assertionVerified === true) {
      verified = true;
    }

    if (!verified) {
      return NextResponse.json(
        { error: 'Требуется подтверждение биометрией. Вызовите GET /challenge, затем startAuthentication, затем POST с assertion и sessionId.' },
        { status: 400 }
      );
    }

    const result = signDocumentAfterBiometricVerify(body.documentHash);
    const signerName = session?.user?.name ?? (session?.user as { fullName?: string })?.fullName ?? '';
    const signerRole = ((session?.user as { role?: string })?.role ?? '').toUpperCase();
    const userId = (session?.user?.id as string) ?? session?.user?.email ?? 'anonymous';

    await appendLedgerEvent({
      event_type: 'BIOMETRIC_SIGN',
      user_id: userId,
      payload: {
        document_hash: body.documentHash,
        signature: result.signature,
        key_id: result.keyId,
        signed_at: result.signedAt,
        signer_name: signerName,
        signer_role: signerRole,
        signer_id: userId,
      },
    });

    return NextResponse.json({
      ok: true,
      signature: result.signature,
      keyId: result.keyId,
      signedAt: result.signedAt,
      signerName: signerName || undefined,
      signerRole: signerRole || undefined,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues }, { status: 400 });
    }
    console.error('[signature/biometric]', e);
    return NextResponse.json({ error: 'Ошибка подписания' }, { status: 500 });
  }
}
