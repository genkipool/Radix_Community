/**
 * Server-rendered identity header for a validator page.
 *
 * Why this exists: the validator route was in the sitemap, but the name, the
 * stake, the fee and the uptime were all painted on the client. The initial
 * HTML contained the address and a list of transaction hashes and nothing
 * else, so a page titled "SRWA" never said "SRWA" anywhere a crawler reading
 * the raw HTML could see it. ~290 validator pages were therefore near-
 * duplicates of each other and could not rank for the one query they exist to
 * answer, which is the validator's own name.
 *
 * Everything here comes from `getValidatorsCached`, the same cached list the
 * shell already fetches for its aggregates, so this costs no extra round trip.
 * It renders as a real page header rather than hidden text: the content is for
 * readers first, and it happens to be what a crawler needs too.
 */
import { getValidatorsCached } from '@/services/gateway/validators';
import type { Validator } from '@/types/radix';
import type { Network } from '@/features/dashboard/types';
import logger from '@/lib/logger';

interface ValidatorSummaryProps {
  address: string;
  network: Network;
  locale: string;
  /** Dashboard dictionary, already loaded by the route. */
  t: {
    dashboard?: {
      card?: Record<string, unknown>;
      details?: Record<string, unknown>;
    };
  };
}

/** Reads a label from the dashboard dictionary, falling back to English. */
function label(
  t: ValidatorSummaryProps['t'],
  group: 'card' | 'details',
  key: string,
  fallback: string,
): string {
  const value = t?.dashboard?.[group]?.[key];
  return typeof value === 'string' ? value : fallback;
}

function formatXrd(value: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)} XRD`;
}

function formatPercent(value: number, locale: string, digits = 2): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value)}%`;
}

/**
 * On-ledger `description` is written by whoever registered the validator, so
 * it is rendered as plain text (never as markup) and capped at a length that
 * cannot push the rest of the page off screen.
 */
function safeDescription(raw: string | undefined): string | null {
  const text = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > 400 ? `${text.slice(0, 400).trimEnd()}…` : text;
}

/**
 * A validator's `website` is also attacker-controlled, so the link is
 * `nofollow ugc` (no ranking signal passed on) and only http(s) is accepted.
 */
function safeWebsite(raw: string | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

async function findValidator(
  address: string,
  network: Network,
): Promise<Validator | null> {
  try {
    const data = await getValidatorsCached(network);
    return (data?.validators ?? []).find((v) => v.address === address) ?? null;
  } catch (error) {
    // Non-fatal: without it the page is what it was before, and the client
    // still renders the interactive card.
    logger.error({ err: error }, '[ValidatorSummary] Failed to load validators');
    return null;
  }
}

export async function ValidatorSummary({
  address,
  network,
  locale,
  t,
}: ValidatorSummaryProps) {
  const validator = await findValidator(address, network);
  if (!validator) return null;

  const description = safeDescription(validator.description);
  const website = safeWebsite(validator.website);

  const stats: { label: string; value: string }[] = [
    {
      label: label(t, 'card', 'stake', 'Total Stake'),
      value: formatXrd(validator.delegatedStake, locale),
    },
    {
      label: label(t, 'card', 'fee', 'Fee'),
      value: formatPercent(validator.effectiveFee ?? validator.nominalFee, locale),
    },
    {
      label: label(t, 'card', 'apy', 'APY'),
      value: formatPercent(validator.apyProjection, locale),
    },
    {
      label: label(t, 'card', 'uptime', 'Uptime'),
      value: formatPercent(validator.recentUptime, locale, 3),
    },
    {
      label: label(t, 'card', 'delegators', 'Delegators'),
      value: new Intl.NumberFormat(locale).format(validator.delegators),
    },
    {
      label: label(t, 'details', 'rank', 'Rank'),
      value: `#${validator.rank}`,
    },
  ];

  return (
    <section
      aria-labelledby="validator-summary-heading"
      className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6"
    >
      <div className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-surface)] p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
          {label(t, 'details', 'validator', 'Radix Validator')}
        </p>

        <h1
          id="validator-summary-heading"
          className="mt-1 text-2xl font-bold tracking-tight text-[var(--color-text-main)] sm:text-3xl"
        >
          {validator.name}
        </h1>

        <p className="mt-2 break-all font-mono text-xs text-[var(--color-text-secondary)]">
          {validator.address}
        </p>

        {description && (
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
            {description}
          </p>
        )}

        {website && (
          <p className="mt-3 text-sm">
            <a
              href={website}
              target="_blank"
              rel="nofollow ugc noopener noreferrer"
              className="font-medium text-[var(--color-primary)] hover:underline"
            >
              {label(t, 'card', 'website', 'Website')}
            </a>
          </p>
        )}

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                {stat.label}
              </dt>
              <dd className="mt-1 text-base font-semibold text-[var(--color-text-main)]">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
