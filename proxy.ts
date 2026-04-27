import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const locales = ['en', 'es'];
const defaultLocale = 'en';

function getLocale(request: NextRequest) {
    const langCookie = request.cookies.get('lang')?.value;
    if (langCookie && locales.includes(langCookie)) {
        return langCookie;
    }

    const country =
        request.headers.get('cf-ipcountry') ||
        request.headers.get('x-vercel-ip-country');
    if (country === 'ES') {
        return 'es';
    }

    const acceptLanguage = request.headers.get('accept-language');
    if (acceptLanguage && acceptLanguage.toLowerCase().startsWith('es')) {
        return 'es';
    }
    return defaultLocale;
}

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const pathnameHasLocale = locales.some(
        (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
    );

    if (pathnameHasLocale) {
        return NextResponse.next();
    }

    const locale = getLocale(request);
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;

    return NextResponse.redirect(redirectUrl, { status: 308 });
}

export const config = {
    matcher: [
        '/((?!_next|api|.*\\..*).*)',
    ],
};