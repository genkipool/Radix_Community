import { NextResponse, type NextRequest } from 'next/server';
import {
  verifySessionJWT,
  createSessionJWT,
  buildSessionCookieHeader,
  buildClearSessionCookieHeader,
  type SessionPayload,
} from '@/lib/auth/session';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface LogoutRequestBody {
  network?: 'mainnet' | 'stokenet' | 'all';
}

// ─── POST /api/auth/radix/logout ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body: LogoutRequestBody = await req.json();
    const network = body.network || 'all';

    const existingToken = req.cookies.get('radix-session')?.value;
    if (!existingToken) {
      // No session to clear — still return success
      const response = NextResponse.json({ success: true });
      response.headers.set('Set-Cookie', buildClearSessionCookieHeader());
      return response;
    }

    const session = await verifySessionJWT(existingToken);

    // If disconnecting all, or session is invalid, or single network left → clear cookie
    if (network === 'all' || !session) {
      const response = NextResponse.json({ success: true });
      response.headers.set('Set-Cookie', buildClearSessionCookieHeader());
      return response;
    }

    // Disconnect only one network
    const updated: Pick<SessionPayload, 'mainnet' | 'stokenet'> = {
      mainnet: network === 'mainnet' ? null : session.mainnet,
      stokenet: network === 'stokenet' ? null : session.stokenet,
    };

    // If both are now null, clear the cookie entirely
    if (!updated.mainnet && !updated.stokenet) {
      const response = NextResponse.json({ success: true });
      response.headers.set('Set-Cookie', buildClearSessionCookieHeader());
      return response;
    }

    // Otherwise, issue updated JWT with remaining network
    const token = await createSessionJWT(updated);
    const response = NextResponse.json({ success: true });
    response.headers.set('Set-Cookie', buildSessionCookieHeader(token));
    return response;
  } catch {
    // Even on error, clear the cookie to prevent stuck sessions
    const response = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
    response.headers.set('Set-Cookie', buildClearSessionCookieHeader());
    return response;
  }
}
