import { NextRequest, NextResponse } from 'next/server';
import { DAO_NOTICE_ATTACHMENTS } from '@/features/radix-dao/data/radixDaoData';

/**
 * Strictly allowlisted inline PDF proxy for the official Radix DAO notice
 * attachments (hosted on GitHub user-attachments without CORS headers).
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug') ?? '';
  const attachment = DAO_NOTICE_ATTACHMENTS[slug];

  if (!attachment) {
    return NextResponse.json({ error: 'Notice PDF not found' }, { status: 404 });
  }

  try {
    const upstream = await fetch(attachment.pdfUrl, {
      redirect: 'follow',
      next: { revalidate: 86400 },
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: 'Upstream PDF unavailable' }, { status: 502 });
    }

    const buffer = await upstream.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${attachment.pdfName}"`,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load PDF' }, { status: 502 });
  }
}
