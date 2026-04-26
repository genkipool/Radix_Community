import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const locales = ['en', 'es'];
const defaultLocale = 'en';

function getLocale(request: NextRequest) {
    // 1. Respect the user's explicit language choice (saved in cookie)
    const langCookie = request.cookies.get('lang')?.value;
    if (langCookie && locales.includes(langCookie)) {
        return langCookie;
    }

    // 2. Geolocation: Spain → Spanish
    const country =
        request.headers.get('cf-ipcountry') ||
        request.headers.get('x-vercel-ip-country');
    if (country === 'ES') {
        return 'es';
    }

    // 3. Browser accept-language header
    const acceptLanguage = request.headers.get('accept-language');
    if (acceptLanguage) {
        if (acceptLanguage.toLowerCase().startsWith('es')) {
            return 'es';
        }
    }
    return defaultLocale;
}

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Check if there is any supported locale in the pathname
    const pathnameHasLocale = locales.some(
        (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
    );

    if (pathnameHasLocale) {
        const response = NextResponse.next();
        response.headers.set('Cache-Control', 'no-cache, must-revalidate');
        return response;
    }

    // Redirect if there is no locale
    const locale = getLocale(request);

    // Clone the URL instead of mutating request.nextUrl
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;

    return NextResponse.redirect(redirectUrl);
}

export const config = {
    matcher: [
        // Match all paths except those starting with `_next`, `api`, or files with extensions
        '/((?!_next|api|.*\\..*).*)',
    ],
};