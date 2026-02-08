# Шаблон API route с auth

Скопировать из working routes (например `app/api/ledger/verify/route.ts`).

## GET handler с auth + rate limit

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const key = getClientKey(req);
  const { allowed, retryAfterMs } = checkRateLimit(key, { windowMs: 60_000, max: 10 });
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: retryAfterMs ? { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } : undefined,
      }
    );
  }

  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.LEDGER_READ, req);
  if (err) return err;

  try {
    // ... handler logic
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[route-name]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

## GET handler с несколькими permissions (OR)

```ts
const hasView = await hasPermission(session, PERMISSIONS.COMPLIANCE_VIEW);
const hasAdmin = await hasPermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);

if (!hasView && !hasAdmin) {
  const err = await requirePermission(session, PERMISSIONS.COMPLIANCE_VIEW, request);
  if (err) return err;
}
```

**Важно:** всегда `await` для `hasPermission` — функция асинхронная.

## ESLint: no-floating-promises

Для ловли забытых `await` добавить `@typescript-eslint/no-floating-promises`. Требует type-aware linting (parserOptions.project). См. https://tseslint.com/typed-linting — настройка типа:

```json
"parserOptions": { "project": "./tsconfig.json" }
```

## Ссылки

- `app/api/ledger/verify/route.ts` — полный пример
- `lib/authz.ts` — `requirePermission`, `hasPermission`, `PERMISSIONS`
