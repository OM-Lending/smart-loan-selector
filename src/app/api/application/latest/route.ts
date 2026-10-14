import { NextResponse } from 'next/server';
import { prisma } from '@/server/lib/prisma';
import { getAuthenticatedProfile } from '@/server/lib/auth';

export async function GET() {
  const identity = await getAuthenticatedProfile();
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!identity.profile) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  const application = await prisma.application.findFirst({
    where: { userId: identity.profile.id, user: { deletedAt: null } },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  return NextResponse.json({ success: true, applicationId: application.id });
}
