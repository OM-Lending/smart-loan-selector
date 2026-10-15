import { NextResponse } from 'next/server';
import { getAuthenticatedProfile } from '@/server/lib/auth';

export async function requireAdmin() {
  const identity = await getAuthenticatedProfile();
  if (!identity) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  if (!identity.profile || identity.profile.role !== 'ADMIN' || identity.profile.deletedAt) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { ok: true as const, identity };
}
