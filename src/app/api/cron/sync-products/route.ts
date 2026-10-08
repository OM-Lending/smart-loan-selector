import { NextResponse } from 'next/server';
import { syncCdrProductsService } from '@/server/services/sync.service';

export const maxDuration = 300; 

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const syncedCount = await syncCdrProductsService();
    
    console.log(`[SYNC] Complete. Successfully synced ${syncedCount} products.`);
    return NextResponse.json({ success: true, syncedProducts: syncedCount });

  } catch (error) {
    console.error('[SYNC] Critical error during CDR sync:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}