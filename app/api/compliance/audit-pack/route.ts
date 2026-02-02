/**
 * GET/POST /api/compliance/audit-pack
 * Generate and list external auditor packs.
 * Permission: ADMIN.MANAGE_USERS only (sensitive data export)
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS, hasPermission } from '@/lib/authz';
import {
  generateAuditPack,
  listAuditPacks,
  generateEvidenceIndex,
} from '@/lib/audit-pack-service';

export const dynamic = 'force-dynamic';

/**
 * GET - List audit packs or get evidence index
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  
  const hasAdmin = hasPermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);
  if (!hasAdmin) {
    const err = requirePermission(session, PERMISSIONS.ADMIN_MANAGE_USERS, request);
    if (err) return err;
  }

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    
    if (action === 'evidence-index') {
      const from = url.searchParams.get('from') ?? undefined;
      const to = url.searchParams.get('to') ?? undefined;
      const index = generateEvidenceIndex(from, to);
      return NextResponse.json(index);
    }
    
    const packs = listAuditPacks();
    return NextResponse.json({ packs });
  } catch (error) {
    console.error('[compliance/audit-pack] GET error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to list audit packs' } },
      { status: 500 }
    );
  }
}

/**
 * POST - Generate new audit pack
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  
  const hasAdmin = hasPermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);
  if (!hasAdmin) {
    const err = requirePermission(session, PERMISSIONS.ADMIN_MANAGE_USERS, request);
    if (err) return err;
  }

  try {
    const body = await request.json();
    
    const from_date = body.from_date;
    const to_date = body.to_date;
    
    if (!from_date || !to_date) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'from_date and to_date required' } },
        { status: 400 }
      );
    }
    
    const userId = (session?.user?.id as string) ?? 'unknown';
    
    const { pack_path, manifest } = generateAuditPack({
      from_date,
      to_date,
      include_keys: body.include_keys !== false,
      generated_by: userId,
    });
    
    return NextResponse.json({
      success: true,
      pack_id: manifest.pack_id,
      pack_path,
      manifest,
      message: 'Audit pack generated successfully',
    });
  } catch (error) {
    console.error('[compliance/audit-pack] POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate pack';
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
