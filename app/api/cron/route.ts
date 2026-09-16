import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { advanceVoteTail } from '@/services/gateway/protocolVotes';

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
    // Purge the cache globally across Vercel using background revalidation (Next.js 15+ standard)
    revalidateTag('validators', 'max');
    revalidateTag('transactions', 'max');
    revalidateTag('entities', 'max');
    revalidateTag('stake-history', 'max');
    revalidateTag('round-proposer', 'max');

    /*
     * Protocol-update votes, as a safety net. The tail is normally advanced by
     * whoever reads the validator list, so this only matters when nobody has
     * looked in a while, and it needs no schedule of its own: this route is
     * already being pinged. It does nothing when no update is open.
     */
    const votes = await Promise.all([
      advanceVoteTail('mainnet'),
      advanceVoteTail('stokenet'),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Radix cache revalidated successfully',
      votes: { mainnet: votes[0], stokenet: votes[1] },
      timestamp: new Date().toISOString()
    });
  } catch (_error) {
    return NextResponse.json({ error: 'There was an error revalidating the cache' }, { status: 500 });
  }
}
