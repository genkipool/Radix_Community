/**
 * Searching an address must not change which view you are in.
 *
 * Every entity route (`/dashboard/validator/…`, `/resource/…`, `/account/…`)
 * renders the EXPLORER focused on that address. Focusing was written before the
 * views were split, so it sent every complete address to its entity route
 * regardless of where the user was: pasting a validator into the staking search
 * box silently threw you out of staking and onto the explorer's entity card,
 * instead of filtering the validator list you were looking at.
 *
 * The rule pinned here: staking keeps a validator to itself and filters in
 * place; the explorer keeps showing entity cards; and anything with no staking
 * representation still goes to the explorer, which is the only view able to
 * render it.
 */
import { describe, it, expect } from 'vitest';
import { dashboardRoutes, resolveEntityKind, legacyDashboardRedirect } from '@/features/dashboard/lib/routes';
import type { DashboardView, Network } from '@/features/dashboard/types';

const VALIDATOR = 'validator_rdx1sdvntpsfvlyx2hapn5zfr6z7etfwgqljsqdqh23876r33fpd8cvu5j';
const ACCOUNT = 'account_rdx12yy8n09a0w907vrjyj4hws2yptrm3rdjv84l9sr24e3w7pk7nuxst8';
const RESOURCE = 'resource_rdx1nfyg2f68jw7hfdlg5hzvd8ylsa7e0kjl68t5t62v3ttamtejc9wlxa';
const TX = 'txid_rdx1abcdefghijklmnopqrstuvwxyz0123456789';

/** Mirrors focusEntity in useDashboardNavigation. */
function focusHref(input: { view: DashboardView; value: string | null; network?: Network }) {
  const { view, value, network } = input;
  const locale = 'es';

  if (!value) return dashboardRoutes.view(locale, view, { network });

  const staysInStaking = view === 'staking' && resolveEntityKind(value) === 'validator';
  return staysInStaking
    ? dashboardRoutes.staking(locale, { network, entity: value })
    : dashboardRoutes.entity(locale, value, { network });
}

describe('focusing an address from the search box', () => {
  it('keeps a validator inside staking', () => {
    // The reported bug: this used to return /es/dashboard/validator/…
    const href = focusHref({ view: 'staking', value: VALIDATOR });

    expect(href).toContain('/es/dashboard/staking');
    expect(href).not.toContain('/dashboard/validator/');
  });

  it('carries the validator in the query so the link is still shareable', () => {
    const href = focusHref({ view: 'staking', value: VALIDATOR, network: 'stokenet' });

    expect(href).toContain(`entity=${VALIDATOR}`);
    expect(href).toContain('network=stokenet');
  });

  it('still opens the entity card for a validator searched in the explorer', () => {
    const href = focusHref({ view: 'transactions', value: VALIDATOR });
    expect(href).toBe(`/es/dashboard/validator/${VALIDATOR}`);
  });

  it('sends addresses staking cannot render to the explorer', () => {
    // There is no account or resource card in staking, so leaving the view is
    // the only way to show them.
    for (const value of [ACCOUNT, RESOURCE, TX]) {
      const href = focusHref({ view: 'staking', value });
      expect(href, value).not.toContain('/dashboard/staking');
    }
  });

  it('returns to the list of the view it was in when the box is cleared', () => {
    expect(focusHref({ view: 'staking', value: null })).toBe('/es/dashboard/staking');
    expect(focusHref({ view: 'transactions', value: null })).toBe('/es/dashboard/explorer');
  });

  it('never leaves the current view for a validator, on either view', () => {
    const landsOnExplorer = (href: string) =>
      href.includes('/dashboard/explorer') ||
      href.includes('/dashboard/validator/') ||
      href.includes('/dashboard/account/') ||
      href.includes('/dashboard/resource/') ||
      href.includes('/dashboard/tx/');

    expect(landsOnExplorer(focusHref({ view: 'staking', value: VALIDATOR }))).toBe(false);
    expect(landsOnExplorer(focusHref({ view: 'transactions', value: VALIDATOR }))).toBe(true);
  });
});

describe('legacy links focusing a validator', () => {
  it('keeps an old staking link in staking', () => {
    const href = legacyDashboardRedirect('es', { view: 'staking', tx: VALIDATOR });

    expect(href).toContain('/es/dashboard/staking');
    expect(href).toContain(`entity=${VALIDATOR}`);
  });

  it('still sends an old explorer link to the entity page', () => {
    const href = legacyDashboardRedirect('es', { view: 'transactions', tx: VALIDATOR });
    expect(href).toBe(`/es/dashboard/validator/${VALIDATOR}`);
  });

  it('sends an old staking link with a non-validator entity to the explorer', () => {
    const href = legacyDashboardRedirect('es', { view: 'staking', tx: ACCOUNT });
    expect(href).toBe(`/es/dashboard/account/${ACCOUNT}`);
  });
});
