import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { requireAdmin } from '@/server/lib/admin-auth';

const ProductId = z.string().uuid();
const UpdateBody = z.object({
  recommendationStatus: z.enum(['INCLUDED', 'EXCLUDED']),
  note: z.string().trim().max(1000).default(''),
  sourceUri: z.union([z.string().url(), z.literal('')]).default(''),
});

export async function PATCH(request: Request, context: { params: Promise<{ productId: string }> }) {
  const access = await requireAdmin();
  if (!access.ok) return access.response;

  try {
    const { productId } = await context.params;
    if (!ProductId.safeParse(productId).success) return NextResponse.json({ error: 'Invalid product id.' }, { status: 400 });
    const form = UpdateBody.parse(await request.json());
    if (form.recommendationStatus === 'EXCLUDED' && !form.note) {
      return NextResponse.json({ error: 'Add a reason before excluding this product.' }, { status: 400 });
    }
    const exists = await prisma.loanProduct.findFirst({ where: { id: productId, isActive: true, lender: { isActive: true } }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: 'Active loan product not found.' }, { status: 404 });

    const product = await prisma.loanProduct.update({
      where: { id: productId },
      data: {
        recommendationStatus: form.recommendationStatus,
        recommendationNote: form.recommendationStatus === 'EXCLUDED' ? form.note : null,
        recommendationSourceUri: form.recommendationStatus === 'EXCLUDED' ? form.sourceUri || null : null,
        recommendationReviewedAt: new Date(),
        recommendationReviewedById: access.identity.profile!.id,
      },
      select: { id: true, recommendationStatus: true, recommendationReviewedAt: true },
    });
    return NextResponse.json({ success: true, product });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid product recommendation settings.', details: error.flatten().fieldErrors }, { status: 400 });
    console.error('Failed to update product recommendation status:', error);
    return NextResponse.json({ error: 'Could not update this product.' }, { status: 500 });
  }
}
