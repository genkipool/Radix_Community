import { describe, it, expect } from 'vitest';

import {
  assessAccountSecurity,
  controllerConfigOf,
  ownerBadgeLocalId,
  ownerControlOf,
  pickSecurityWellKnown,
  summariseAccessRule,
  VERDICT_SEVERITY,
} from '@/features/console/lib/account-security';
import {
  accountAddressKind,
  addressNodeIdHex,
  inspectAddress,
} from '@/features/console/lib/address-inspect';
import { CONSOLE_TOOL_SLUGS } from '@/features/console/types/console.types';
import { CONSOLE_GROUPS, CONSOLE_TOOLS } from '@/features/console/data/consoleTools';
import { getMcpRegistry } from '@/services/mcp/tools';
import enLocale from '@/features/console/locales/en.json';
import esLocale from '@/features/console/locales/es.json';
import {
  CONTROLLER_DETAILS,
  KEY_CONTROLLED,
  SELF_HELD,
  SHIELDED,
  STOKENET_WELL_KNOWN,
} from '../fixtures/account-security';

const WELL_KNOWN = pickSecurityWellKnown(STOKENET_WELL_KNOWN);

interface Guide {
  guideDescription: string;
  guideSteps: string[];
  glossary: Array<{ term: string; definition: string }>;
}

const assess = (
  fixture: { address: string; ownerRule: unknown },
  holder?: string,
) =>
  assessAccountSecurity({
    address: fixture.address,
    ownerRule: fixture.ownerRule,
    wellKnown: WELL_KNOWN,
    badgeLocation: holder ? { holder } : null,
  });

/* ─── The address alone ──────────────────────────────────────────────────── */

describe('what an address says by itself', () => {
  it('reads the curve out of the entity type byte', () => {
    // Olympia-derived (secp256k1) and Babylon-native (ed25519) mainnet accounts.
    expect(
      accountAddressKind('account_rdx169490zsun80mg3y0j23ghccm2sw0a4f0rdshxnj2alqcj98ctuzhqw'),
    ).toBe('preallocated-secp256k1');
    expect(accountAddressKind(KEY_CONTROLLED.address)).toBe('preallocated-ed25519');
    // An account instantiated on ledger says nothing about its controller.
    expect(accountAddressKind(SHIELDED.address)).toBe('allocated');
  });

  it('refuses to decode an address whose checksum fails', () => {
    const typo = `${KEY_CONTROLLED.address.slice(0, -1)}x`;
    expect(addressNodeIdHex(typo)).toBeNull();
    expect(ownerBadgeLocalId(typo)).toBeNull();
    expect(inspectAddress(typo)?.checksumValid).toBe(false);
  });

  /*
   * The engine mints the account owner badge with the account's own node id
   * (`NonFungibleLocalId::bytes`), so the id is arithmetic, not a lookup — which
   * is what lets the check ask the Gateway one direct question.
   */
  it('derives the owner badge id from the address', () => {
    expect(ownerBadgeLocalId(SHIELDED.address)).toBe(
      '[c1bf606fa5f1a68f4dadace8ede1cb4b442ea476cbdde01be9c9849a934d]',
    );
    expect(ownerBadgeLocalId(SELF_HELD.address)).toBe(
      '[510f4b56bb07bd905e6282de378ea05a23e44c1cadfcd71fb5b1ffd9752f]',
    );
  });
});

/* ─── Reading rules ──────────────────────────────────────────────────────── */

describe('access rule summaries', () => {
  it('reads a single require', () => {
    const summary = summariseAccessRule(KEY_CONTROLLED.ownerRule);
    expect(summary).toMatchObject({ kind: 'require', threshold: 1 });
    expect(summary.badges).toHaveLength(1);
    expect(summary.badges[0].resource).toBe(WELL_KNOWN.ed25519SignatureVirtualBadge);
  });

  it('reads the composite rule a shield actually uses', () => {
    const primary = controllerConfigOf(SHIELDED.controller, CONTROLLER_DETAILS).roles.primary!;
    expect(primary.kind).toBe('countOf');
    expect(primary.threshold).toBe(1);
    expect(primary.badges).toHaveLength(3);
  });

  it('reads AllowAll and DenyAll without inventing badges', () => {
    expect(summariseAccessRule({ type: 'AllowAll' })).toEqual({
      kind: 'allowAll',
      threshold: null,
      badges: [],
    });
    expect(summariseAccessRule({ type: 'DenyAll' }).kind).toBe('denyAll');
    expect(summariseAccessRule(null).badges).toEqual([]);
    expect(summariseAccessRule('nonsense').kind).toBe('unknown');
  });
});

describe('owner control', () => {
  it('names the curve and checks the key hash against the address', () => {
    const control = ownerControlOf(KEY_CONTROLLED.ownerRule, KEY_CONTROLLED.address, WELL_KNOWN);
    expect(control).toMatchObject({ kind: 'signature', curve: 'ed25519', matchesAddress: true });
  });

  /*
   * A preallocated address IS the hash of its key, so the rule and the address
   * cannot disagree unless something is wrong. Reading one account's rule
   * against another's address must not silently pass.
   */
  it('flags a rule whose key hash is not the one the address encodes', () => {
    const control = ownerControlOf(KEY_CONTROLLED.ownerRule, SELF_HELD.address, WELL_KNOWN);
    expect(control).toMatchObject({ kind: 'signature', matchesAddress: false });
  });

  it('recognises the account owner badge', () => {
    expect(ownerControlOf(SHIELDED.ownerRule, SHIELDED.address, WELL_KNOWN)).toMatchObject({
      kind: 'ownerBadge',
      resource: WELL_KNOWN.accountOwnerBadge,
    });
  });
});

/* ─── Verdicts ───────────────────────────────────────────────────────────── */

describe('verdicts', () => {
  it('calls a key-controlled account what it is', () => {
    const result = assess(KEY_CONTROLLED);
    expect(result.verdict).toBe('key');
    expect(result.controller).toBeNull();
    expect(result.notes).not.toContain('addressRuleMismatch');
  });

  it('marks an Olympia-derived address, whatever its owner rule', () => {
    const result = assessAccountSecurity({
      address: 'account_rdx169490zsun80mg3y0j23ghccm2sw0a4f0rdshxnj2alqcj98ctuzhqw',
      ownerRule: KEY_CONTROLLED.ownerRule,
      wellKnown: WELL_KNOWN,
    });
    expect(result.notes).toContain('olympiaDerived');
  });

  it('reports a badge in an Access Controller, and which one', () => {
    const result = assess(SHIELDED, SHIELDED.controller);
    expect(result.verdict).toBe('accessController');
    expect(result.controller).toBe(SHIELDED.controller);
    expect(result.notes).not.toContain('singleTransferableBadge');
  });

  /*
   * Securified but with the badge loose in an account is not the same as
   * shielded: the account is then one transferable NFT, with no recovery and
   * no second factor. It has to read differently from the controller case.
   */
  it('separates a loose owner badge from a shielded one', () => {
    const result = assess(SELF_HELD, SELF_HELD.address);
    expect(result.verdict).toBe('badgeInAccount');
    expect(result.notes).toContain('singleTransferableBadge');
    expect(result.notes).toContain('badgeHeldBySelf');
  });

  it('says so instead of guessing when the badge cannot be located', () => {
    expect(assess(SHIELDED).verdict).toBe('badgeUnknown');
    expect(assess(SHIELDED, undefined).controller).toBeNull();
  });

  it('reports an open account and an unreadable one apart', () => {
    const open = assessAccountSecurity({
      address: KEY_CONTROLLED.address,
      ownerRule: { type: 'AllowAll' },
      wellKnown: WELL_KNOWN,
    });
    expect(open.verdict).toBe('open');

    const unreadable = assessAccountSecurity({
      address: KEY_CONTROLLED.address,
      ownerRule: {},
      wellKnown: WELL_KNOWN,
    });
    expect(unreadable.verdict).toBe('unknown');
  });

  it('never crashes on an address that is not an account', () => {
    const result = assessAccountSecurity({
      address: 'resource_tdx_2_1nfxxxxxxxxxxaccwnrxxxxxxxxx006664022062xxxxxxxxx4vczzk',
      ownerRule: null,
      wellKnown: WELL_KNOWN,
    });
    expect(result.accountKind).toBeNull();
    expect(result.verdict).toBe('unknown');
  });
});

/* ─── Controller configuration ───────────────────────────────────────────── */

describe('controller configuration', () => {
  it('reads the real controller state', () => {
    const config = controllerConfigOf(SHIELDED.controller, CONTROLLER_DETAILS);
    expect(config).toMatchObject({
      address: SHIELDED.controller,
      timedRecoveryDelayMinutes: 1440,
      recoveryInProgress: false,
      badgeWithdrawAttempt: false,
      primaryRoleLocked: false,
      hasFeeVault: false,
    });
    expect(config.roles.recovery?.badges).toHaveLength(3);
    expect(config.roles.confirmation?.threshold).toBe(1);
  });

  /*
   * A recovery or a badge withdrawal in flight is someone taking the account
   * away from you right now, so it must survive a reshaped state rather than
   * being lost with it.
   */
  it('surfaces an attempt in flight', () => {
    const attacked = {
      state: {
        ...(CONTROLLER_DETAILS.state as Record<string, unknown>),
        recovery_role_recovery_attempt: { epoch: 1 },
        has_primary_role_badge_withdraw_attempt: true,
      },
    };
    const config = controllerConfigOf(SHIELDED.controller, attacked);
    expect(config.recoveryInProgress).toBe(true);
    expect(config.badgeWithdrawAttempt).toBe(true);
  });

  it('degrades to nulls instead of throwing on an unreadable state', () => {
    const config = controllerConfigOf(SHIELDED.controller, { details: { state: 'nope' } });
    expect(config.timedRecoveryDelayMinutes).toBeNull();
    expect(config.roles.primary).toBeNull();
    expect(config.recoveryInProgress).toBe(false);
  });
});

/* ─── Wiring ─────────────────────────────────────────────────────────────── */

describe('account security section wiring', () => {
  const SLUG = 'account-security';

  it('registers the tool in the console and in a sidebar group', () => {
    expect(CONSOLE_TOOL_SLUGS).toContain(SLUG);
    expect(CONSOLE_TOOLS[SLUG]?.requiresWallet, 'read-only: no wallet needed').toBe(false);
    const groups = CONSOLE_GROUPS.filter((group) => group.tools.includes(SLUG));
    expect(groups.map((group) => group.id)).toEqual(['utilities']);
  });

  it('names and documents the tool in both languages', () => {
    for (const locale of [enLocale, esLocale]) {
      const tool = (locale.console.tools as unknown as Record<string, { title: string; description: string; guide?: Guide }>)[SLUG];
      expect(tool?.title).toBeTruthy();
      expect(tool?.description).toBeTruthy();
      expect(tool?.guide?.guideDescription.length).toBeGreaterThan(80);
      expect(tool?.guide?.guideSteps.length).toBeGreaterThanOrEqual(4);
      expect(tool?.guide?.glossary.length).toBeGreaterThanOrEqual(3);
    }
  });

  /*
   * The UI reads a label per verdict and per finding. A verdict with no string
   * would render blank exactly when the answer matters most, so the dictionary
   * has to cover the unions rather than the cases someone remembered.
   */
  it('carries a label for every verdict and every finding, in both languages', () => {
    const verdicts = Object.keys(VERDICT_SEVERITY);
    const notes = [
      'addressRuleMismatch',
      'badgeHeldBySelf',
      'singleTransferableBadge',
      'olympiaDerived',
      'holderUnresolved',
    ];
    for (const locale of [enLocale, esLocale]) {
      const section = locale.console.accountSecurity;
      for (const verdict of verdicts) {
        const entry = (section.verdicts as Record<string, { label: string; meaning: string }>)[verdict];
        expect(entry?.label, verdict).toBeTruthy();
        expect(entry?.meaning, verdict).toBeTruthy();
      }
      for (const note of notes) {
        expect((section.notes as Record<string, string>)[note], note).toBeTruthy();
      }
      for (const kind of ['preallocated-secp256k1', 'preallocated-ed25519', 'allocated', 'unknown']) {
        expect((section.addressKind as Record<string, string>)[kind], kind).toBeTruthy();
      }
    }
  });

  it('exposes the same check over MCP', () => {
    const tool = getMcpRegistry()
      .list()
      .find((entry) => entry.name === 'verify_account_security');
    expect(tool, 'verify_account_security must be registered').toBeDefined();
    expect(tool!.readOnly, 'the check never signs anything').not.toBe(false);
  });
});
