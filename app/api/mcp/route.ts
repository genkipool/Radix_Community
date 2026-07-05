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

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: JSON_RPC_ERRORS.PARSE_ERROR, message: 'Body is not valid JSON' },
      },
      400,
    );
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
