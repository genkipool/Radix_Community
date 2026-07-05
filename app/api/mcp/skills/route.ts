/**
 * app/api/mcp/skills/route.ts
 *
 * Downloadable SKILL.md for AI agents — generated from the live MCP tool
 * registry so it never drifts from the actual server capabilities.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateSkillMarkdown } from '@/services/mcp/skills';

export async function GET(request: NextRequest) {
  const markdown = generateSkillMarkdown(request.nextUrl.origin);
  const download = request.nextUrl.searchParams.get('download') === 'true';

  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
      ...(download ? { 'Content-Disposition': 'attachment; filename="radix-community-SKILL.md"' } : {}),
    },
  });
}
