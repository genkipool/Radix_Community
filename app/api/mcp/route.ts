/**
 * app/api/mcp/route.ts
 *
 * MCP (Model Context Protocol) endpoint — Streamable HTTP transport,
 * stateless JSON responses. AI clients (Claude Code, Claude Desktop, Cursor,
 * Antigravity, …) connect here to use the site's tools.
 *
 * Protocol handling lives in services/mcp; this file only maps HTTP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleMcpBody } from '@/services/mcp/protocol';
import { getMcpRegistry } from '@/services/mcp/tools';
import { RATE_LIMITS, clientIp, rateLimit, type RateLimitResult } from '@/lib/rateLimit';
import { JSON_RPC_ERRORS } from '@/services/mcp/types';

/** CORS headers so browser-based MCP clients can connect too. */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
};

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: CORS_HEADERS });

/** Largest body accepted: tool arguments are small, and a big one only costs us. */
const MAX_BODY_BYTES = 256 * 1024;
/**
 * Messages accepted in one legacy JSON-RPC batch (the 2025-06-18 protocol has
 * none). Each counts against the rate limit like a request of its own.
 */
const MAX_BATCH = 20;

const rpcError = (code: number, message: string, status: number, headers: HeadersInit = {}) =>
  NextResponse.json(
    { jsonrpc: '2.0', id: null, error: { code, message } },
    { status, headers: { ...CORS_HEADERS, ...headers } },
  );

const rateLimited = ({ retryAfterSeconds }: RateLimitResult) =>
  rpcError(JSON_RPC_ERRORS.INTERNAL_ERROR, 'Rate limit exceeded. Slow down.', 429, {
    'Retry-After': String(retryAfterSeconds),
  });

export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers);
  const rate = await rateLimit(RATE_LIMITS.mcp, ip);
  if (!rate.allowed) return rateLimited(rate);

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return rpcError(JSON_RPC_ERRORS.INVALID_REQUEST, 'Body too large', 413);
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return rpcError(JSON_RPC_ERRORS.INVALID_REQUEST, 'Body too large', 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return rpcError(JSON_RPC_ERRORS.PARSE_ERROR, 'Body is not valid JSON', 400);
  }

  if (Array.isArray(body)) {
    if (body.length > MAX_BATCH) {
      return rpcError(JSON_RPC_ERRORS.INVALID_REQUEST, `At most ${MAX_BATCH} messages per batch`, 400);
    }
    // The request already counted once; the rest of the batch counts too.
    const batch = await rateLimit(RATE_LIMITS.mcp, ip, body.length - 1);
    if (body.length > 1 && !batch.allowed) return rateLimited(batch);
  }

  const result = await handleMcpBody(body, getMcpRegistry(), {
    origin: request.nextUrl.origin,
  });

  // Notifications produce no response body — acknowledge with 202.
  if (result === null) {
    return new NextResponse(null, { status: 202, headers: CORS_HEADERS });
  }
  return json(result);
}

/** This server does not push server-initiated messages (no SSE stream). */
export async function GET() {
  return json(
    { error: 'Method Not Allowed. Send MCP JSON-RPC messages via POST.' },
    405,
  );
}

/** Session termination — stateless server, nothing to clean up. */
export async function DELETE() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
