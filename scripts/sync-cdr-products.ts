import { prisma } from '../src/server/lib/prisma';
import { syncCdrProductsService } from '../src/server/services/sync.service';

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be configured to run the CDR sync.');
  }

  const syncStartedAt = new Date(Date.now() - 5_000);

  try {
    const syncedProducts = await syncCdrProductsService();
    const runs = await prisma.lenderSyncRun.findMany({
      where: { startedAt: { gte: syncStartedAt } },
      select: {
        status: true,
        startedAt: true,
        completedAt: true,
        productsSeen: true,
        ratesSeen: true,
        errorMessage: true,
        lender: { select: { name: true } },
      },
      orderBy: { startedAt: 'asc' },
    });

    console.log(`CDR sync processed ${syncedProducts} products across ${runs.length} lender runs.`);
    for (const run of runs) {
      const durationSeconds = run.completedAt
        ? Math.round((run.completedAt.getTime() - run.startedAt.getTime()) / 1000)
        : null;
      console.log(JSON.stringify({
        lender: run.lender.name,
        status: run.status,
        durationSeconds,
        productsSeen: run.productsSeen,
        ratesSeen: run.ratesSeen,
        errorMessage: run.errorMessage,
      }));
    }

    if (runs.length === 0) {
      throw new Error('The sync completed without creating any lender sync run records.');
    }

    const unsuccessfulRuns = runs.filter(run => run.status !== 'SUCCESS');
    if (unsuccessfulRuns.length > 0) {
      throw new Error(`${unsuccessfulRuns.length} lender sync run(s) were not successful.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error('CDR product sync failed:', error);
  process.exitCode = 1;
});
