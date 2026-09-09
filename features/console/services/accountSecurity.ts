/**
 * The account-security check, as a sequence of ledger reads.
 *
 * The decisions all live in `lib/account-security`; this is the part that has
 * to talk to a Gateway, and it is written against three injected reads instead
 * of a client. The console runs it in the browser through the dashboard's API
 * routes, the MCP server runs it in Node through the cached gateway services,
 * and both get the same verdict from the same code. That is the point: an
 * agent must not be able to answer this question differently from the UI.
 *
 * It also keeps the reads to the minimum the answer needs: the owner rule
 * first, the badge's whereabouts only if the account turned out to be
 * securified, the controller only if the badge is in one.
 */

import {
  assessAccountSecurity,
  controllerConfigOf,
  expectedBadgeFor,
  needsBadgeLocation,
  ownerControlOf,
  pickSecurityWellKnown,
  type AccountSecurity,
  type BadgeLocation,
  type ControllerConfig,
} from '../lib/account-security';
import { inspectAddress } from '../lib/address-inspect';

/** The three reads the check needs, whoever performs them. */
export interface SecurityProbe {
  /** Gateway `/state/entity/details` for one address, unwrapped to its item. */
  entityDetails(address: string): Promise<unknown>;
  /** Gateway `/status/network-configuration` well-known addresses. */
  wellKnownAddresses(): Promise<Record<string, string>>;
  /** Gateway `/state/non-fungible/location` for one id. */
  badgeLocation(resource: string, localId: string): Promise<BadgeLocation | null>;
}

export interface AccountSecurityReport extends AccountSecurity {
  /** Present only when the badge lives in an Access Controller. */
  controllerConfig: ControllerConfig | null;
}

export class NotAnAccountError extends Error {}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

/** Pulls `details.role_assignments.owner.rule` out of an entity item. */
function ownerRuleOf(item: unknown): unknown {
  const detail = asRecord(asRecord(item).details);
  return asRecord(asRecord(detail.role_assignments).owner).rule;
}

/**
 * Runs the whole check for one account address.
 *
 * Throws `NotAnAccountError` for input that is not a valid account address.
 * A typo must never come back as a reassuring verdict.
 */
export async function probeAccountSecurity(
  rawAddress: string,
  probe: SecurityProbe,
): Promise<AccountSecurityReport> {
  const address = rawAddress.trim();
  const inspection = inspectAddress(address);
  if (!inspection?.checksumValid || inspection.entityType !== 'account') {
    throw new NotAnAccountError(
      'Not a valid account address. Expected account_rdx1… or account_tdx_2_1… with a correct checksum.',
    );
  }

  const [details, wellKnownMap] = await Promise.all([
    probe.entityDetails(address),
    probe.wellKnownAddresses(),
  ]);
  const wellKnown = pickSecurityWellKnown(wellKnownMap);
  const ownerRule = ownerRuleOf(details);

  // Only a securified account has a badge worth locating.
  const control = ownerControlOf(ownerRule, address, wellKnown);
  let badgeLocation: BadgeLocation | null = null;
  if (needsBadgeLocation(control)) {
    const badge = expectedBadgeFor(address, wellKnown);
    if (badge?.localId) {
      badgeLocation = await probe.badgeLocation(badge.resource, badge.localId);
    }
  }

  const security = assessAccountSecurity({ address, ownerRule, wellKnown, badgeLocation });

  const controllerConfig = security.controller
    ? controllerConfigOf(security.controller, await probe.entityDetails(security.controller))
    : null;

  return { ...security, controllerConfig };
}
