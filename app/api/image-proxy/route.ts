import { NextRequest, NextResponse } from 'next/server';

/**
 * Image Proxy Route Handler
 * 
 * Fetches external images and serves them with aggressive cache headers
 * to enable Vercel Edge Network caching.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    // Basic validation: must be a valid absolute HTTPS URL
    const url = new URL(imageUrl);
    if (url.protocol !== 'https:') {
      return new NextResponse('Only HTTPS URLs are allowed', { status: 400 });
    }

    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Radix-Community-Proxy/1.0',
      },
      // Ensure we don't follow too many redirects
      redirect: 'follow',
    });

    if (!response.ok) {
      return new NextResponse(`Failed to fetch image: ${response.statusText}`, { status: response.status });
    }

    const contentType = response.headers.get('content-type');
    
    // Safety check: ensure it's actually an image
    if (contentType && !contentType.startsWith('image/')) {
       // We'll allow it if content-type is missing but be cautious
       // but if it's explicitly not an image, we reject it
       return new NextResponse('URL does not point to an image', { status: 400 });
    }

    // Capture the image data
    const blob = await response.blob();

    // Serve with Vercel Edge caching headers
    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType || 'image/png',
        'Cache-Control': 'public, s-maxage=31536000, max-age=31536000, immutable',
        'X-Proxy-Source': imageUrl,
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
