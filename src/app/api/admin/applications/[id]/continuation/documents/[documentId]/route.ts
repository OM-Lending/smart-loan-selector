import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { requireAdmin } from '@/server/lib/admin-auth';
import { privateStorageRequest, privateStorageSignedUrl } from '@/server/lib/private-storage';

const Params = z.object({ id: z.string().uuid(), documentId: z.string().uuid() });

export async function GET(_request: Request, context: { params: Promise<{ id: string; documentId: string }> }) {
  const access = await requireAdmin();
  if (!access.ok) return access.response;

  const parsed = Params.safeParse(await context.params);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid document reference' }, { status: 400 });

  const document = await prisma.applicationDocument.findFirst({
    where: {
      id: parsed.data.documentId,
      continuation: {
        applicationId: parsed.data.id,
        status: 'SUBMITTED',
        application: { currentStage: { in: ['BROKER_REVIEW', 'DOCUMENTS_PENDING'] }, user: { deletedAt: null } },
      },
    },
    select: { storagePath: true },
  });
  if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return NextResponse.json({ error: 'Private storage is not configured' }, { status: 503 });
  const result = await privateStorageRequest(document.storagePath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 300 }),
  }, 'sign');
  if (!result.ok) {
    console.error('Could not create broker document link:', result.status, await result.text());
    return NextResponse.json({ error: 'Could not open this document' }, { status: 502 });
  }
  const payload = await result.json() as { signedURL?: string };
  if (!payload.signedURL) return NextResponse.json({ error: 'Could not open this document' }, { status: 502 });

  return NextResponse.redirect(privateStorageSignedUrl(baseUrl, payload.signedURL), {
    status: 302,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
