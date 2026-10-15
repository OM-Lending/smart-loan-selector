import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { getAuthenticatedProfile } from '@/server/lib/auth';
import { privateStorageRequest, privateStorageSignedUrl } from '@/server/lib/private-storage';

const Params = z.object({ id: z.string().uuid(), documentId: z.string().uuid() });

export async function GET(_request: Request, context: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    const identity = await getAuthenticatedProfile();
    if (!identity?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id, documentId } = Params.parse(await context.params);
    const document = await prisma.applicationDocument.findFirst({
      where: { id: documentId, continuation: { applicationId: id, application: { userId: identity.profile.id } } },
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
      console.error('Could not create a private document review link:', result.status, await result.text());
      return NextResponse.json({ error: 'Could not open this document' }, { status: 502 });
    }
    const payload = await result.json() as { signedURL?: string };
    if (!payload.signedURL) return NextResponse.json({ error: 'Could not open this document' }, { status: 502 });
    return NextResponse.redirect(privateStorageSignedUrl(baseUrl, payload.signedURL), { status: 302, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid document reference' }, { status: 400 });
    if (error instanceof Error && error.message === 'PRIVATE_STORAGE_NOT_CONFIGURED') return NextResponse.json({ error: 'Private storage is not configured' }, { status: 503 });
    console.error('Failed to open application document:', error);
    return NextResponse.json({ error: 'Could not open this document' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    const identity = await getAuthenticatedProfile();
    if (!identity?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id, documentId } = Params.parse(await context.params);
    const document = await prisma.applicationDocument.findFirst({
      where: {
        id: documentId,
        continuation: {
          applicationId: id,
          application: {
            userId: identity.profile.id,
            currentStage: { notIn: ['SUBMITTED_TO_LENDER', 'PRE_APPROVED', 'UNCONDITIONAL_APPROVED', 'SETTLED'] },
          },
        },
      },
      select: { id: true, storagePath: true },
    });
    if (!document) return NextResponse.json({ error: 'Document not found or your application has already been submitted to a lender' }, { status: 404 });
    const removed = await privateStorageRequest(document.storagePath, { method: 'DELETE' });
    if (!removed.ok) {
      console.error('Could not remove private document object:', removed.status, await removed.text());
      return NextResponse.json({ error: 'Could not remove the stored file. Please try again.' }, { status: 502 });
    }
    await prisma.applicationDocument.delete({ where: { id: document.id } });
    return NextResponse.json({ success: true, documentId: document.id });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid document reference' }, { status: 400 });
    if (error instanceof Error && error.message === 'PRIVATE_STORAGE_NOT_CONFIGURED') return NextResponse.json({ error: 'Private storage is not configured' }, { status: 503 });
    console.error('Failed to remove application document:', error);
    return NextResponse.json({ error: 'Could not remove document' }, { status: 500 });
  }
}
