import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { requireAdmin } from '@/server/lib/admin-auth';

const Params = z.object({ snapshotId: z.string().uuid() });
const Form = z.object({
  action: z.enum(['PUBLISH', 'IGNORE']),
  name: z.string().trim().max(200).default(''),
  amount: z.string().trim().default(''),
  requiredGoal: z.enum(['BUY', 'REFINANCE', '']).default(''),
  minimumLoanAmount: z.string().trim().default(''),
  maximumLoanAmount: z.string().trim().default(''),
  firstHomeBuyerOnly: z.boolean().default(false),
  applicationWindowStart: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/).default(''),
  applicationWindowEnd: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/).default(''),
  settlementWithinDays: z.string().regex(/^\d*$/).default(''),
  drawdownWithinDays: z.string().regex(/^\d*$/).default(''),
  validFrom: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/).default(''),
  validUntil: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/).default(''),
  terms: z.string().trim().max(10000).default(''),
});

function optionalAmount(value: string, label: string) {
  if (!value) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`${label} must be a valid non-negative amount.`);
  return new Prisma.Decimal(amount);
}
function optionalDays(value: string, label: string) {
  if (!value) return null;
  const days = Number(value);
  if (!Number.isInteger(days) || days < 0 || days > 3650) throw new Error(`${label} must be between 0 and 3650 days.`);
  return days;
}
function optionalDate(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ snapshotId: string }> }) {
  const access = await requireAdmin();
  if (!access.ok) return access.response;
  try {
    const { snapshotId } = Params.parse(await context.params);
    const form = Form.parse(await request.json());
    const snapshot = await prisma.promotionSourceSnapshot.findUnique({ where: { id: snapshotId } });
    if (!snapshot || !snapshot.isCurrent) return NextResponse.json({ error: 'This bank offer revision is no longer current. Refresh the review list.' }, { status: 404 });

    if (form.action === 'IGNORE') {
      await prisma.promotionSourceSnapshot.update({
        where: { id: snapshotId },
        data: { reviewStatus: 'IGNORED', reviewedAt: new Date(), reviewedBy: access.identity.profile!.id },
      });
      return NextResponse.json({ success: true, action: 'IGNORED' });
    }

    if (snapshot.changeType === 'REMOVED') return NextResponse.json({ error: 'A removed bank offer cannot be published.' }, { status: 400 });
    if (!form.name) return NextResponse.json({ error: 'Enter a name for this cashback offer.' }, { status: 400 });
    const amount = optionalAmount(form.amount, 'Cashback amount');
    if (!amount || amount.lte(0)) return NextResponse.json({ error: 'Enter a cashback amount greater than zero.' }, { status: 400 });
    const minimumLoanAmount = optionalAmount(form.minimumLoanAmount, 'Minimum loan amount');
    const maximumLoanAmount = optionalAmount(form.maximumLoanAmount, 'Maximum loan amount');
    if (minimumLoanAmount && maximumLoanAmount && minimumLoanAmount.gt(maximumLoanAmount)) return NextResponse.json({ error: 'Minimum loan amount cannot exceed maximum loan amount.' }, { status: 400 });
    const applicationWindowStart = optionalDate(form.applicationWindowStart);
    const applicationWindowEnd = optionalDate(form.applicationWindowEnd);
    const validFrom = optionalDate(form.validFrom);
    const validUntil = optionalDate(form.validUntil);
    if (applicationWindowStart && applicationWindowEnd && applicationWindowStart > applicationWindowEnd) return NextResponse.json({ error: 'Application window end must be on or after its start.' }, { status: 400 });
    if (validFrom && validUntil && validFrom > validUntil) return NextResponse.json({ error: 'Offer end date must be on or after its start date.' }, { status: 400 });
    const settlementWithinDays = optionalDays(form.settlementWithinDays, 'Settlement deadline');
    const drawdownWithinDays = optionalDays(form.drawdownWithinDays, 'Drawdown deadline');

    const promotion = await prisma.$transaction(async tx => {
      const current = await tx.promotionSourceSnapshot.findUnique({ where: { id: snapshotId } });
      if (!current?.isCurrent || current.changeType === 'REMOVED') throw new Error('This bank offer revision is no longer available to publish.');
      const versions = await tx.promotion.findMany({ where: { sourceSnapshotId: snapshotId }, select: { version: true, status: true } });
      await tx.promotion.updateMany({ where: { sourceSnapshotId: snapshotId, status: 'PUBLISHED' }, data: { status: 'PAUSED' } });
      const version = versions.reduce((maximum, row) => Math.max(maximum, row.version), 0) + 1;
      const created = await tx.promotion.create({ data: {
        sourceSnapshotId: snapshotId,
        version,
        promotionType: 'CASHBACK',
        name: form.name,
        amount,
        currency: 'AUD',
        requiredGoal: form.requiredGoal || null,
        minimumLoanAmount,
        maximumLoanAmount,
        firstHomeBuyerOnly: form.firstHomeBuyerOnly,
        applicationWindowStart,
        applicationWindowEnd,
        settlementWithinDays,
        drawdownWithinDays,
        terms: form.terms || null,
        validFrom,
        validUntil,
        status: 'PUBLISHED',
        parseStatus: 'PARSED',
        reviewedAt: new Date(),
        reviewedBy: access.identity.profile!.id,
      } });
      await tx.promotionSourceSnapshot.update({ where: { id: snapshotId }, data: { reviewStatus: 'REVIEWED', reviewedAt: new Date(), reviewedBy: access.identity.profile!.id } });
      return created;
    });
    return NextResponse.json({ success: true, action: 'PUBLISHED', promotionId: promotion.id, version: promotion.version });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid cashback review data.' }, { status: 400 });
    if (error instanceof Error && (error.message.includes('amount') || error.message.includes('days') || error.message.includes('no longer'))) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Failed to update cashback promotion:', error);
    return NextResponse.json({ error: 'Could not save this cashback review.' }, { status: 500 });
  }
}
