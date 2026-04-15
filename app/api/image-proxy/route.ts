import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';

export const runtime = 'edge';

// Validation schema for the image URL
const QuerySchema = z.object({
  url: z.string().url('Must be a valid URL').startsWith('https:', 'Only HTTPS URLs are allowed'),
});

/**
 * Image Proxy Route Handler
 * 
 * Fetches external images and serves them with aggressive cache headers
 * to enable Vercel Edge Network caching. Returns fallback or 404 for broken links.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get('url');

  // 1. Validation
  const validation = QuerySchema.safeParse({ url: imageUrl });
  
  if (!validation.success) {
    return new NextResponse(validation.error.issues[0].message, { 
      status: 400,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, max-age=3600',
      }
    });
  }

  const { url } = validation.data;

  try {
    // 2. Fetch with Timeout (2 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Radix-Community-Proxy/1.0',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn({ url, status: response.status, statusText: response.statusText }, 'Image proxy: external fetch failed');
      
      return new NextResponse(`Failed to fetch image: ${response.statusText}`, { 
        status: response.status,
        headers: {
          // Negative Caching: Store this failure for 1h to stop spamming broken links
          'Cache-Control': 'public, s-maxage=3600, max-age=3600, stale-while-revalidate=86400',
        }
      });
    }

    const contentType = response.headers.get('content-type');
    
    // 3. Safety check: ensure it's actually an image
    if (contentType && !contentType.startsWith('image/')) {
       logger.warn({ url, contentType }, 'Image proxy: URL does not point to an image');
       
       return new NextResponse('URL does not point to an image', { 
         status: 400,
         headers: {
           'Cache-Control': 'public, s-maxage=3600, max-age=3600',
         }
       });
    }

    // Capture the image data
    const blob = await response.blob();

    // 4. Serve with Vercel Edge caching headers
    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType || 'image/png',
        'Cache-Control': 'public, s-maxage=31536000, max-age=31536000, immutable',
        'X-Proxy-Source': url,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error({ url }, 'Image proxy: fetch timed out');
      return new NextResponse('Fetch timeout', { 
        status: 504,
        headers: { 'Cache-Control': 'no-store' } 
      });
    }

    logger.error({ url, error }, 'Image proxy error');
    return new NextResponse('Internal server error', { status: 500 });
  }
}
