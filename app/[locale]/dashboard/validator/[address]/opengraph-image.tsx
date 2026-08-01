/**
 * Share card for a validator.
 *
 * The name on this card is on-ledger metadata, written by whoever registered
 * the validator, and some of them are bait: there is a live mainnet validator
 * called "Radix Giveaway Alert". Its name already reaches the link preview
 * through `og:title`, so withholding the artwork protects nothing; what the
 * figures do is answer it. "3 XRD staked, 0 delegators" is a far worse advert
 * for a scam than a blank card, and an unregistered validator is labelled as
 * such. Publishing the numbers alongside the name is the honest defence.
 *
 * Mainnet only, because it takes no search params and Stokenet pages are
 * noindex anyway.
 */
import { getValidatorsCached } from '@/services/gateway/validators';
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { ogCard, OG_SIZE, OG_CONTENT_TYPE, type OgStat } from '@/lib/og-card';
import logger from '@/lib/logger';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Radix Community';

function shorten(address: string): string {
  return address.length > 26 ? `${address.slice(0, 14)}…${address.slice(-6)}` : address;
}

function compactXrd(value: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)} XRD`;
}

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; address: string }>;
}) {
  const { locale, address: raw } = await params;
  const address = decodeURIComponent(raw);

  const t = await getFeatureDictionary(locale as Locale, ['dashboard', 'dashboardStaking']);
  const { card, details, status } = t.dashboard;
  const eyebrow = details.validator;

  const validator = await (async () => {
    try {
      const data = await getValidatorsCached('mainnet');
      return (data?.validators ?? []).find((v) => v.address === address) ?? null;
    } catch (error) {
      // A share card is never worth failing a request over.
      logger.error({ err: error }, '[og:validator] Failed to load validators');
      return null;
    }
  })();

  // Unknown or unreachable: still a valid card, just without the figures.
  if (!validator) {
    return ogCard({ eyebrow, title: shorten(address) });
  }

  const stats: OgStat[] = [
    {
      label: card.stake,
      value: compactXrd(validator.delegatedStake, locale),
    },
    {
      label: card.delegators,
      value: new Intl.NumberFormat(locale).format(validator.delegators),
    },
    {
      label: card.fee,
      value: `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
        validator.effectiveFee ?? validator.nominalFee,
      )}%`,
    },
    {
      label: card.uptime,
      value: `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
        validator.recentUptime,
      )}%`,
    },
  ];

  return ogCard({
    eyebrow: validator.registered ? `${eyebrow} · #${validator.rank}` : eyebrow,
    badge: validator.registered ? undefined : status.inactive,
    title: validator.name || shorten(address),
    subtitle: validator.description || undefined,
    stats,
  });
}
