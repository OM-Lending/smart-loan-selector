import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/server/lib/supabase';
import { generateRecommendations, NotFoundError, ValidationError } from '@/server/services/recommendation.service';

const ParamsSchema = z.object({ id: z.string().uuid() });

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawParams = await context.params;

    const { id } = ParamsSchema.parse(rawParams);
    console.log(`[API] Triggering recommendation for Application ID: ${id}`);

    const result = await generateRecommendations({ applicationId: id, userId: user.id });
    console.log(`[API] Recommendation Success. Returned ${result.count} quotes.`);
    
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Recommendation Engine Error:', error);

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError || error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input parameters' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}