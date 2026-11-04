import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be configured.');
  const { prisma } = await import('../src/server/lib/prisma');
  try {
    const { processAdminNotifications } = await import('../src/server/services/notifications/notification.service');
    const result = await processAdminNotifications(undefined, 40);
    console.log(JSON.stringify(result));
    if (!result.configured) throw new Error('Email notifications are disabled or configuration is incomplete.');
    if (result.failed) throw new Error(`${result.failed} email deliveries failed; inspect the admin notification history.`);
  } finally { await prisma.$disconnect(); }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Notification processing failed.');
  process.exitCode = 1;
});
