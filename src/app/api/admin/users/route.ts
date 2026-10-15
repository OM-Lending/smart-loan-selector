import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { requireAdmin } from '@/server/lib/admin-auth';

const QuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export async function GET(request: Request) {
  const access = await requireAdmin();
  if (!access.ok) return access.response;

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({ q: url.searchParams.get('q') ?? undefined, page: url.searchParams.get('page') ?? 1 });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });

  const { q, page } = parsed.data;
  const where = {
    deletedAt: null,
    ...(q ? { OR: [
      { email: { contains: q, mode: 'insensitive' as const } },
      { fullName: { contains: q, mode: 'insensitive' as const } },
    ] } : {}),
  };
  const pageSize = 50;
  const [total, profiles] = await Promise.all([
    prisma.profile.count({ where }),
    prisma.profile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        _count: { select: { applications: true } },
        applications: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            goal: true,
            propertyPostcode: true,
            currentStage: true,
            createdAt: true,
            recommendationRuns: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              select: { status: true, _count: { select: { quotes: true } } },
            },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    page,
    pageSize,
    total,
    users: profiles.map(profile => ({
      id: profile.id,
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      role: profile.role,
      createdAt: profile.createdAt.toISOString(),
      applicationCount: profile._count.applications,
      applications: profile.applications.map(application => ({
        id: application.id,
        goal: application.goal,
        propertyPostcode: application.propertyPostcode,
        currentStage: application.currentStage,
        createdAt: application.createdAt.toISOString(),
        recommendationStatus: application.recommendationRuns[0]?.status ?? 'PENDING',
        matchCount: application.recommendationRuns[0]?._count.quotes ?? 0,
      })),
    })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
