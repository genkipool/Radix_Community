/**
 * Which validator pages are worth submitting to a search engine.
 *
 * All ~290 mainnet validators used to go into the sitemap. Three quarters of
 * them publish no on-ledger description, so their pages differed from each
 * other only in numbers inside an otherwise identical template: textbook thin
 * content, and the crawl budget spent re-fetching them came out of the pages
 * that actually rank. Submitting fewer, better URLs is not a loss of coverage,
 * because the rest stay reachable (and indexable) through the validator list.
 *
 * Nothing here marks a page `noindex`. Every validator page is still fully
 * crawlable and linkable; this only decides what the sitemap actively asks
 * Google to come and look at.
 */
import type { Validator } from '@/types/radix';

/**
 * Validators ranked this high by stake are worth submitting even without a
 * description: they are the ones people search for by name.
 */
export const TOP_VALIDATOR_RANK = 50;

/**
 * A validator's on-ledger `name` is set by whoever registered it, and the site
 * turns that name into the page `<title>` and `og:title`. Names built to bait
 * (there are live examples on mainnet) are kept out of the sitemap so the site
 * does not ask Google to index someone else's scam copy under this domain.
 *
 * Deliberately narrow. It must not catch a legitimate operator: "Financial
 * Freedom 0% fee" and "free for re-use" are real validators and both pass.
 */
const BAIT_NAME = /giveaway|air\s*drop|free\s*xrd|claim\s+(your|now|free)|double\s+your|guaranteed\s+(return|profit)|100%\s*bonus|\bx2\b/i;

export function hasBaitName(name: string | undefined): boolean {
  return BAIT_NAME.test(name ?? '');
}

/** True when the operator published a description on the ledger. */
function isSelfDescribed(validator: Validator): boolean {
  return Boolean(validator.description?.trim());
}

/**
 * Decides whether a validator's page goes into the sitemap.
 *
 * Unregistered validators are excluded outright: nobody can stake to them, so
 * the page has no audience and no query to win.
 */
export function isIndexableValidator(validator: Validator): boolean {
  if (!validator.registered) return false;
  if (hasBaitName(validator.name)) return false;
  return isSelfDescribed(validator) || validator.rank <= TOP_VALIDATOR_RANK;
}

/** Applies {@link isIndexableValidator} to a list, dropping malformed entries. */
export function selectIndexableValidators(validators: Validator[]): Validator[] {
  return validators.filter(
    (validator) =>
      typeof validator?.address === 'string' &&
      validator.address.length > 0 &&
      isIndexableValidator(validator),
  );
}
