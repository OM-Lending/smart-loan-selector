import { NextResponse } from 'next/server';

// This legacy endpoint writes fields from the retired application schema.
// Keep it explicit for any old client while directing current clients to the
// authenticated questionnaire submission endpoint.
export async function POST() {
  return NextResponse.json(
    { error: 'This legacy endpoint is no longer supported. Submit the questionnaire through /api/application/create.' },
    { status: 410 }
  );
}
