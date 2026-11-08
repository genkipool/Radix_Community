/**
 * lib/cronAuth.ts
 *
 * Whether a request carries the cron secret: as Vercel sends it
 * (`Authorization: Bearer <CRON_SECRET>`) or as the external pingers do
 * (`?secret=<CRON_SECRET>`). Compared in constant time, so the answer's timing
 * tells nothing about the secret.
 */
import crypto from 'crypto';

export function sameSecret(given: string | null, expected: string): boolean {
    if (given === null) return false;
    const a = crypto.createHash('sha256').update(given).digest();
    const b = crypto.createHash('sha256').update(expected).digest();
    return crypto.timingSafeEqual(a, b);
}

