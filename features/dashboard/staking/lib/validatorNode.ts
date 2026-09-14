/**
 * How a validator's node is described on screen: where it runs and what it
 * runs. Every card layout, the expanded card and the explorer read these two
 * through here, so the fallback from observed data to published metadata is
 * decided once.
 */
import { sanitizeText } from '@/utils/sanitize';
import { countryName, normalizeCountryCode } from '@/utils/country';
import type { Validator } from '@/types/radix';

export interface ValidatorLocation {
    /** ISO alpha-2 code, when known. */
    code: string | null;
    /** Name in the reader's language. */
    name: string;
}

export function validatorLocation(validator: Validator, locale = 'en'): ValidatorLocation | null {
    const code = normalizeCountryCode(validator.node?.countryCode ?? validator.countryCode);
    if (code) return { code, name: countryName(code, locale) };

    // Only free text from the validator's metadata: shown as published.
    const name = sanitizeText(validator.country);
    return name ? { code: null, name } : null;
}

export function validatorVersion(validator: Validator): string | null {
    return sanitizeText(validator.node?.version ?? validator.version) || null;
}

const RELEASE = /^v?(\d+(?:\.\d+){1,3})/i;

/**
 * The release part of a version string, for tight spaces: "v1.3.0.2" out of
 * "v1.3.0.2-6a5a9c9". Anything that does not look like a release is returned
 * whole.
 */
export function shortVersion(version: string): string {
    const match = RELEASE.exec(version.trim());
    return match ? `v${match[1]}` : version.trim();
}
