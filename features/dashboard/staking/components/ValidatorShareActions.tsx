'use client';

/**
 * Share row under a validator's photo: WhatsApp, Telegram and its link.
 *
 * The link is the validator's own page, the one whose Open Graph card renders
 * its figures, so what lands in a chat previews this validator rather than the
 * dashboard it was shared from. It is built against the canonical host and not
 * `window.location`, so a link copied from a preview deploy still points at the
 * site.
 */
import { ShareTargets } from '@/components/ui/ShareTargets';
import { BASE_URL } from '@/lib/seo';
import { sanitizeText } from '@/utils/sanitize';
import type { DashboardDict, Network } from '@/features/dashboard/types';
import type { Validator } from '@/types/radix';

/** Stokenet is not the default, so a testnet link has to say so. */
export const validatorPageUrl = (address: string, locale: string, network: Network = 'mainnet') =>
    `${BASE_URL}/${locale}/dashboard/validator/${address}${network === 'stokenet' ? '?network=stokenet' : ''}`;

export const ValidatorShareActions = ({
    validator,
    dt,
    locale = 'en',
    network = 'mainnet',
    wide = false,
}: {
    validator: Validator;
    dt?: DashboardDict;
    locale?: string;
    network?: Network;
    /** The one-column layout has a full sidebar to fill. */
    wide?: boolean;
}) => (
    // The card expands on click; these controls are not that click.
    <div
        className="flex w-full items-center justify-center"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
    >
        <ShareTargets
            url={validatorPageUrl(validator.address, locale, network)}
            text={sanitizeText(validator.name)}
            copyLabel={dt?.card?.copy_link ?? 'Copy link'}
            copiedLabel={dt?.card?.copied ?? 'Copied'}
            size={wide ? 'cardWide' : 'card'}
        />
    </div>
);

ValidatorShareActions.displayName = 'ValidatorShareActions';
