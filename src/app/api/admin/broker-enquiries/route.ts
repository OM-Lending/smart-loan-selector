import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/lib/prisma';
import { requireAdmin } from '@/server/lib/admin-auth';
import { ENQUIRY_STATUSES } from '@/lib/validations/broker-enquiry';

const Query = z.object({ search: z.string().trim().max(120).default(''), status: z.enum(ENQUIRY_STATUSES).optional(), page: z.coerce.number().int().min(1).max(10000).default(1), sort: z.enum(['newest', 'oldest']).default('newest') });
export async function GET(request: Request) {
  const access = await requireAdmin();
  if (!access.ok) return access.response;
  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid enquiry filters.' }, { status: 400 });
  const { search, status, page, sort } = parsed.data;
  const where: Prisma.BrokerEnquiryWhereInput = { ...(status ? { status } : {}), ...(search ? { OR: ['fullName', 'email', 'phone'].map(key => ({ [key]: { contains: search, mode: 'insensitive' } })) } : {}) };
  const [items, total] = await Promise.all([
    prisma.brokerEnquiry.findMany({ where, orderBy: [{ createdAt: sort === 'newest' ? 'desc' : 'asc' }, { id: 'asc' }], skip: (page - 1) * 20, take: 20,
      select: { id: true, fullName: true, email: true, phone: true, status: true, createdAt: true, assignedTo: { select: { fullName: true, email: true } } } }),
    prisma.brokerEnquiry.count({ where }),
  ]);
  return NextResponse.json({ items, total, page, pageSize: 20 }, { headers: { 'Cache-Control': 'no-store' } });
}
