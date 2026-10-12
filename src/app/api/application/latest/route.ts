import { NextResponse } from 'next/server';
import { createClient } from '@/server/lib/supabase';
import { prisma } from '@/server/lib/prisma';

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const application = await prisma.application.findFirst({
    where: { userId: user.id, user: { deletedAt: null } },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  return NextResponse.json({ success: true, applicationId: application.id });
}
