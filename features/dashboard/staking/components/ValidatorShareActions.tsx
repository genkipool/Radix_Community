'use client';

/**
 * Sharing a validator: WhatsApp, Telegram and its link.
 *
 * The link is the validator's own page, the one whose Open Graph card renders
 * its figures, so what lands in a chat previews this validator rather than the
 * dashboard it was shared from. It is built against the canonical host and not
 * `window.location`, so a link copied from a preview deploy still points at the
 * site.
 *
 * Two presentations, because the card has two amounts of room. A wide layout
 * gives the three icons a row under the photo; from four columns up there is no
 * such room, so they live behind a dots menu that opens on hover.
 */
import { ShareMenu, ShareTargets } from '@/components/ui/ShareTargets';
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
    size = 'card',
    variant = 'row',
    className = 'flex w-full items-center justify-center',
}: {
    validator: Validator;
    dt?: Partial<DashboardDict>;
    locale?: string;
    network?: Network;
    /** Icon size of the row (ignored by the menu, whose popup is always inline). */
    size?: 'inline' | 'panel' | 'cardSmall' | 'card' | 'cardWide';
    /** `row` shows the three icons; `menu` hides them behind the dots button. */
    variant?: 'row' | 'menu';
    className?: string;
}) => {
    const url = validatorPageUrl(validator.address, locale, network);
    const text = sanitizeText(validator.name);
    const copyLabel = dt?.card?.copy_link ?? 'Copy link';
    const copiedLabel = dt?.card?.copied ?? 'Copied';

    return (
        // The card expands on click; these controls are not that click.
        <div
            className={className}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
        >
            {variant === 'menu' ? (
                <ShareMenu
                    url={url}
                    text={text}
                    copyLabel={copyLabel}
                    copiedLabel={copiedLabel}
                    label={dt?.card?.share_actions ?? 'Share this validator'}
                />
            ) : (
                <ShareTargets
                    url={url}
                    text={text}
                    copyLabel={copyLabel}
                    copiedLabel={copiedLabel}
                    size={size}
                />
            )}
        </div>
    );
};

ValidatorShareActions.displayName = 'ValidatorShareActions';
