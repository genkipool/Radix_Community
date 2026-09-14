import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { PATHNAME_HEADER } from '@/lib/structured-data';
import {
    SESSION_COOKIE_NAME,
    buildSessionCookieHeader,
    renewSessionToken,
} from '@/lib/auth/sessionToken';

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

/**
 * Keeps a wallet session alive while it is used: a page request carrying a
 * session issued more than a day ago gets it back signed for another six
 * months. A renewal that fails never costs the page; the session simply stays
 * as it was.
 */
async function withRenewedSession(request: NextRequest, response: NextResponse) {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return response;
    try {
        const renewed = await renewSessionToken(token);
        if (renewed) response.headers.append('Set-Cookie', buildSessionCookieHeader(renewed));
    } catch {
        // Missing secret or a signing error: serve the page with the session untouched.
    }
    return response;
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const pathnameHasLocale = locales.some(
        (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
    );

    if (pathnameHasLocale) {
        // The layout builds the BreadcrumbList from the path, and a layout only
        // receives its own segment (`[locale]`), never the rest. Passing the
        // full pathname as a request header keeps the breadcrumb in ONE place
        // instead of every page having to remember to render its own.
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set(PATHNAME_HEADER, pathname);
        return withRenewedSession(request, NextResponse.next({ request: { headers: requestHeaders } }));
    }

    const locale = getLocale(request);
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;

    return withRenewedSession(request, NextResponse.redirect(redirectUrl, { status: 308 }));
}

export const config = {
    matcher: [
        '/((?!_next|api|.*\\..*).*)',
    ],
};