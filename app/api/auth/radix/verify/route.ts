import { NextResponse, type NextRequest } from 'next/server';
import { isValidChallenge } from '@/lib/auth/challenges';
import { supabaseAdmin } from '@/lib/supabase';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { verifyWalletProofs, walletProofsBodySchema } from '@/lib/auth/walletProofs';
import { RATE_LIMITS, clientIp, rateLimit, tooManyRequests } from '@/lib/rateLimit';
import {
  createSessionJWT,
  verifySessionJWT,
  buildSessionCookieHeader,
  type NetworkSessionData,
  type SessionPayload,
} from '@/lib/auth/session';

function networkLabel(id: number): 'mainnet' | 'stokenet' {
  return id === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';
}


// ─── POST /api/auth/radix/verify ────────────────────────────────────────────────

/**
 * Logs a persona in on one network. The wallet signed this site's one-time
 * challenge with the persona and with each account it shares; the session
 * holds the persona and only the accounts whose proof checks out.
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
    const { challenge, identityAddress, networkId, personaLabel } = body;

    // 1. The challenge was generated here, has not expired, and is used up now
    const challengeValid = await isValidChallenge(challenge);
    if (!challengeValid) {
      return NextResponse.json(
        { error: 'Invalid or expired challenge' },
        { status: 401 },
      );
    }

    // 2. The persona, and each shared account, signed it
    const proven = await verifyWalletProofs(body);
    if (!proven.personaProven) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 },
      );
    }
    const accounts = proven.accounts;

    // 4. UPSERT wallet session in Supabase
    const net = networkLabel(networkId);
    const { error: upsertError } = await supabaseAdmin
      .from('wallet_sessions')
      .upsert(
        {
          identity_address: identityAddress,
          network: net,
          persona_label: personaLabel || null,
          accounts: JSON.stringify(accounts),
          updated_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'identity_address,network' },
      );

    if (upsertError) {
      return NextResponse.json(
        { error: 'Failed to save session' },
        { status: 500 },
      );
    }

    // 5. Build JWT payload — preserve existing session for the OTHER network
    const existingToken = req.cookies.get('radix-session')?.value;
    let existingSession: SessionPayload | null = null;
    if (existingToken) {
      existingSession = await verifySessionJWT(existingToken);
    }

    const newNetworkSession: NetworkSessionData = {
      identityAddress,
      personaLabel: personaLabel || '',
      accounts,
    };

    const jwtPayload: Pick<SessionPayload, 'mainnet' | 'stokenet'> = {
      mainnet: existingSession?.mainnet ?? null,
      stokenet: existingSession?.stokenet ?? null,
    };
    jwtPayload[net] = newNetworkSession;

    // 6. Sign JWT and set cookie
    const token = await createSessionJWT(jwtPayload);
    const response = NextResponse.json({
      success: true,
      identityAddress,
      network: net,
    });
    response.headers.set('Set-Cookie', buildSessionCookieHeader(token));

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
