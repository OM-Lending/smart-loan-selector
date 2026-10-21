import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/server/lib/prisma';
import { getAuthenticatedProfile } from '@/server/lib/auth';
import { privateStorageRequest } from '@/server/lib/private-storage';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const TYPES = {
  'application/pdf': { extension: 'pdf', signature: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(0, 4)) === '%PDF' },
  'image/jpeg': { extension: 'jpg', signature: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  'image/png': { extension: 'png', signature: (bytes: Uint8Array) => bytes[0] === 0x89 && String.fromCharCode(...bytes.slice(1, 4)) === 'PNG' },
} as const;
const CATEGORIES = new Set(['identity', 'income', 'bank_statements', 'liabilities', 'property', 'refinance', 'other']);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const identity = await getAuthenticatedProfile();
    if (!identity?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    const form = await request.formData();
    const file = form.get('file');
    const category = form.get('category');
    if (!(file instanceof File) || typeof category !== 'string' || !CATEGORIES.has(category)) return NextResponse.json({ error: 'Choose a document type and file.' }, { status: 400 });
    if (!file.size || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Files must be no larger than 10 MB.' }, { status: 413 });
    const type = TYPES[file.type as keyof typeof TYPES];
    if (!type) return NextResponse.json({ error: 'Upload a PDF, JPG or PNG file.' }, { status: 415 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!type.signature(bytes)) return NextResponse.json({ error: 'The file contents do not match the selected file type.' }, { status: 415 });

    const continuation = await prisma.applicationContinuation.findFirst({
      where: {
        applicationId: id,
        application: { userId: identity.profile.id },
        OR: [
          { status: 'DRAFT' },
          { status: 'SUBMITTED', reviewStatus: 'NEEDS_INFORMATION' },
        ],
      },
      select: { id: true },
    });
    if (!continuation) return NextResponse.json({ error: 'Save your application draft before uploading documents.' }, { status: 404 });
    const objectPath = `${continuation.id}/${randomUUID()}.${type.extension}`;
    let uploadResponse: Response;
    try {
      uploadResponse = await privateStorageRequest(objectPath, { method: 'POST', body: bytes, headers: { 'Content-Type': file.type, 'x-upsert': 'false' } });
    } catch (error) {
      if (error instanceof Error && error.message === 'PRIVATE_STORAGE_NOT_CONFIGURED') return NextResponse.json({ error: 'Secure document storage is not configured yet. Please save your draft and contact support to arrange document upload.' }, { status: 503 });
      throw error;
    }
    if (!uploadResponse.ok) {
      console.error('Private document upload failed:', uploadResponse.status, await uploadResponse.text());
      return NextResponse.json({ error: 'Secure document upload failed. Please try again.' }, { status: 502 });
    }
    const safeName = file.name.replace(/[\\/\0-\x1f]/g, '_').slice(0, 255) || `document.${type.extension}`;
    try {
      const saved = await prisma.applicationDocument.create({ data: {
        continuationId: continuation.id,
        category,
        fileName: safeName,
        contentType: file.type,
        sizeBytes: file.size,
        storagePath: objectPath,
      }, select: { id: true, category: true, fileName: true, contentType: true, sizeBytes: true, uploadedAt: true } });
      return NextResponse.json({ success: true, document: saved }, { status: 201 });
    } catch (error) {
      await privateStorageRequest(objectPath, { method: 'DELETE' }).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    console.error('Failed to upload application document:', error);
    return NextResponse.json({ error: 'Could not upload document' }, { status: 500 });
  }
}
