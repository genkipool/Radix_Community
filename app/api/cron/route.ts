import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const url = new URL(request.url);
  const secretFromUrl = url.searchParams.get('secret');
  
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured on the server' }, { status: 500 });
  }

  // Allows two authentication methods:
  // 1. Native Vercel sending "Bearer <CRON_SECRET>"
  // 2. UptimeRobot and cron-job.org using the secure URL parameter "?secret=<CRON_SECRET>"
  const isValidCron = authHeader === `Bearer ${expectedSecret}` || secretFromUrl === expectedSecret;

  if (!isValidCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Purge the cache globally across Vercel
    // @ts-expect-error - Next.js 15 type definitions experimental
    revalidateTag('validators');
    // @ts-expect-error - Next.js 15 type definitions experimental
    revalidateTag('transactions');
    // @ts-expect-error - Next.js 15 type definitions experimental
    revalidateTag('entities');
    // @ts-expect-error - Next.js 15 type definitions experimental
    revalidateTag('stake-history');

    return NextResponse.json({ 
      success: true, 
      message: 'Radix cache revalidated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (_error) {
    return NextResponse.json({ error: 'There was an error revalidating the cache' }, { status: 500 });
  }
}
