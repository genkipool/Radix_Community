import { NextResponse, type NextRequest } from 'next/server';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { supabaseAdmin } from '@/lib/supabase';
import { isValidChallenge } from '@/lib/auth/challenges';
import { verifyWalletProofs, walletProofsBodySchema } from '@/lib/auth/walletProofs';
import { RATE_LIMITS, clientIp, rateLimit, tooManyRequests } from '@/lib/rateLimit';
import {
  createSessionJWT,
  verifySessionJWT,
  buildSessionCookieHeader,
  type NetworkSessionData,
  type SessionPayload,
} from '@/lib/auth/session';



// ─── Helpers ────────────────────────────────────────────────────────────────────

function networkLabel(id: number): 'mainnet' | 'stokenet' {
  return id === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';
}

// ─── POST /api/auth/radix/update ────────────────────────────────────────────────

/**
 * Replaces the accounts a logged-in persona shares. Each account signed this
 * site's one-time challenge; only those whose proof checks out are kept.
 */
export async function POST(req: NextRequest) {
  const rate = await rateLimit(RATE_LIMITS.auth, clientIp(req.headers));
  if (!rate.allowed) return tooManyRequests(rate);

  try {
    const parsed = walletProofsBodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const body = parsed.data;
    const { identityAddress, networkId } = body;

    // 1. Validate the current session cookie
    const token = req.cookies.get('radix-session')?.value;
    const currentSession = token ? await verifySessionJWT(token) : null;
    if (!currentSession) {
      return NextResponse.json({ error: 'No active session to update' }, { status: 401 });
    }

    const net = networkLabel(networkId);
    const existingNetworkData = currentSession[net];

    if (!existingNetworkData || existingNetworkData.identityAddress !== identityAddress) {
      return NextResponse.json({ error: 'Session mismatch' }, { status: 401 });
    }

    if (!(await isValidChallenge(body.challenge))) {
      return NextResponse.json({ error: 'Invalid or expired challenge' }, { status: 401 });
    }
    const { accounts } = await verifyWalletProofs(body);

    // 2. Update the session in the database
    const { error: updateError } = await supabaseAdmin
      .from('wallet_sessions')
      .update({ accounts })
      .eq('identity_address', identityAddress)
      .eq('network', net);

    if (updateError) {
      console.error('Failed to update session in DB:', updateError);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }

    // 3. Update the cookie
    const newNetworkData: NetworkSessionData = {
      ...existingNetworkData,
      accounts,
    };

    const newSessionPayload: SessionPayload = {
      ...currentSession,
      [net]: newNetworkData,
    };

    const newJwt = await createSessionJWT(newSessionPayload);
    const cookieHeader = buildSessionCookieHeader(newJwt);

    return NextResponse.json({ success: true }, {
      headers: { 'Set-Cookie': cookieHeader },
    });
  } catch (error) {
    console.error('Radix Update Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
