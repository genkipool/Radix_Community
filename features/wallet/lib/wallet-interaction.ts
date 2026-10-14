/**
 * features/wallet/lib/wallet-interaction.ts
 *
 * Builds the exact `items` of a Radix Wallet interaction (wallet interaction
 * schema v2) for every data, login and proof request a dApp can make. Pure and
 * dependency-free, so the same builder drives the wallet playground (preview +
 * what is really sent) and the MCP server (the JSON an agent hands to the
 * local connector).
 *
 * Shapes follow `WalletUnauthorizedRequestItems` / `WalletAuthorizedRequestItems`
 * of @radixdlt/radix-dapp-toolkit; `__tests__/wallet/wallet-interaction.test.ts`
 * checks them against the toolkit's own transformer.
 */

export type Quantifier = 'atLeast' | 'exactly';

export interface NumberOfValues {
  quantifier: Quantifier;
  quantity: number;
}

/**
 * - `none`: one-time request, no persona involved (unauthorizedRequest).
 * - `loginWithChallenge`: the user picks a persona and it signs the challenge.
 * - `loginWithoutChallenge`: the user picks a persona, nothing is signed.
 * - `usePersona`: reuse a persona the dApp is already logged in with.
 */
export type WalletAuthMode = 'none' | 'loginWithChallenge' | 'loginWithoutChallenge' | 'usePersona';

export type DataScope = 'oneTime' | 'ongoing';

export interface WalletRequestSpec {
  auth: WalletAuthMode;
  /** Persona to reuse with `usePersona` (identity_…). */
  identityAddress?: string;
  accounts?: NumberOfValues & { scope: DataScope; withProof: boolean };
  personaData?: {
    scope: DataScope;
    fullName: boolean;
    emailAddresses?: NumberOfValues;
    phoneNumbers?: NumberOfValues;
  };
  /** Ask the wallet to forget what it already shares with the dApp. */
  reset?: { accounts: boolean; personaData: boolean };
  /** Sign the challenge with these known entities (no picking involved). */
  proofOfOwnership?: { accountAddresses: string[]; proveIdentity: boolean };
}

export type WalletRequestIssue =
  | 'empty'
  | 'personaDataEmpty'
  | 'ongoingNeedsPersona'
  | 'resetNeedsPersona'
  | 'proofNeedsPersona'
  | 'proofEmpty'
  | 'proofPersonaNeedsAccount'
  | 'identityMissing'
  | 'challengeMissing';

/* ─── Wire shapes ─────────────────────────────────────────────────────────── */

interface AccountsRequestItem {
  challenge?: string;
  numberOfAccounts: NumberOfValues;
}

interface PersonaDataRequestItem {
  isRequestingName?: boolean;
  numberOfRequestedEmailAddresses?: NumberOfValues;
  numberOfRequestedPhoneNumbers?: NumberOfValues;
}

export type WalletAuthItem =
  | { discriminator: 'loginWithChallenge'; challenge: string }
  | { discriminator: 'loginWithoutChallenge' }
  | { discriminator: 'usePersona'; identityAddress: string };

export interface UnauthorizedRequestItems {
  discriminator: 'unauthorizedRequest';
  oneTimeAccounts?: AccountsRequestItem;
  oneTimePersonaData?: PersonaDataRequestItem;
}

export interface AuthorizedRequestItems {
  discriminator: 'authorizedRequest';
  auth: WalletAuthItem;
  reset?: { accounts: boolean; personaData: boolean };
  proofOfOwnership?: { challenge: string; identityAddress?: string; accountAddresses?: string[] };
  oneTimeAccounts?: AccountsRequestItem;
  ongoingAccounts?: AccountsRequestItem;
  oneTimePersonaData?: PersonaDataRequestItem;
  ongoingPersonaData?: PersonaDataRequestItem;
}

export type WalletRequestItems = UnauthorizedRequestItems | AuthorizedRequestItems;

export interface WalletInteraction {
  interactionId: string;
  metadata: { version: 2; networkId: number; dAppDefinitionAddress: string; origin: string };
  items: WalletRequestItems;
}

/** A fresh random 32-byte ROLA challenge, as hex. */
export function generateRolaChallenge(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/* ─── Validation ──────────────────────────────────────────────────────────── */

const wantsPersonaData = (data: WalletRequestSpec['personaData']) =>
  !!data && (data.fullName || !!data.emailAddresses || !!data.phoneNumbers);

/** True when the request makes the wallet sign the challenge. */
export function needsChallenge(spec: WalletRequestSpec): boolean {
  return (
    spec.auth === 'loginWithChallenge' ||
    (!!spec.accounts && spec.accounts.withProof && spec.accounts.quantity > 0) ||
    !!spec.proofOfOwnership
  );
}

/** Problems that would make the wallet reject (or ignore) the request. */
export function validateWalletRequest(spec: WalletRequestSpec): WalletRequestIssue[] {
  const issues: WalletRequestIssue[] = [];
  const accounts = spec.accounts && spec.accounts.quantity > 0 ? spec.accounts : undefined;
  const personaData = spec.personaData;
  const authorized = spec.auth !== 'none';

  if (personaData && !wantsPersonaData(personaData)) issues.push('personaDataEmpty');
  if (!authorized) {
    if (!accounts && !wantsPersonaData(personaData)) issues.push('empty');
    if (accounts?.scope === 'ongoing' || personaData?.scope === 'ongoing') {
      issues.push('ongoingNeedsPersona');
    }
    if (spec.reset?.accounts || spec.reset?.personaData) issues.push('resetNeedsPersona');
    if (spec.proofOfOwnership) issues.push('proofNeedsPersona');
  }
  if (spec.auth === 'usePersona' && !spec.identityAddress) issues.push('identityMissing');
  if (spec.proofOfOwnership) {
    if (spec.auth !== 'usePersona') issues.push('proofNeedsPersona');
    const { accountAddresses, proveIdentity } = spec.proofOfOwnership;
    if (accountAddresses.length === 0 && !proveIdentity) issues.push('proofEmpty');
    // The Android wallet never completes a proof of the persona alone: after the
    // persona signs it only moves on when accounts follow, so "Verify persona"
    // comes back forever. A login with challenge proves just the persona instead.
    if (accountAddresses.length === 0 && proveIdentity) issues.push('proofPersonaNeedsAccount');
  }
  return [...new Set(issues)];
}

/* ─── Builder ─────────────────────────────────────────────────────────────── */

function accountsItem(
  accounts: NonNullable<WalletRequestSpec['accounts']>,
  challenge: string | undefined,
): AccountsRequestItem {
  return {
    ...(accounts.withProof && challenge ? { challenge } : {}),
    numberOfAccounts: { quantifier: accounts.quantifier, quantity: accounts.quantity },
  };
}

function personaDataItem(data: NonNullable<WalletRequestSpec['personaData']>): PersonaDataRequestItem {
  return {
    ...(data.fullName ? { isRequestingName: true } : {}),
    ...(data.emailAddresses ? { numberOfRequestedEmailAddresses: data.emailAddresses } : {}),
    ...(data.phoneNumbers ? { numberOfRequestedPhoneNumbers: data.phoneNumbers } : {}),
  };
}

/**
 * The `items` of the wallet interaction for a request. `challenge` (32 bytes,
 * hex) is required whenever `needsChallenge(spec)`; throws on an invalid spec.
 */
export function buildWalletRequestItems(spec: WalletRequestSpec, challenge?: string): WalletRequestItems {
  const issues = validateWalletRequest(spec);
  if (needsChallenge(spec) && !challenge) issues.push('challengeMissing');
  if (issues.length > 0) throw new Error(`Invalid wallet request: ${issues.join(', ')}`);

  const accounts = spec.accounts && spec.accounts.quantity > 0 ? spec.accounts : undefined;
  const personaData = wantsPersonaData(spec.personaData) ? spec.personaData : undefined;

  if (spec.auth === 'none') {
    return {
      discriminator: 'unauthorizedRequest',
      ...(accounts ? { oneTimeAccounts: accountsItem(accounts, challenge) } : {}),
      ...(personaData ? { oneTimePersonaData: personaDataItem(personaData) } : {}),
    };
  }

  const auth: WalletAuthItem =
    spec.auth === 'loginWithChallenge'
      ? { discriminator: 'loginWithChallenge', challenge: challenge! }
      : spec.auth === 'usePersona'
        ? { discriminator: 'usePersona', identityAddress: spec.identityAddress! }
        : { discriminator: 'loginWithoutChallenge' };

  // The toolkit always states the reset flags, so the wallet sees them explicitly.
  const items: AuthorizedRequestItems = {
    discriminator: 'authorizedRequest',
    auth,
    reset: { accounts: !!spec.reset?.accounts, personaData: !!spec.reset?.personaData },
  };
  if (spec.proofOfOwnership) {
    const { accountAddresses, proveIdentity } = spec.proofOfOwnership;
    items.proofOfOwnership = {
      challenge: challenge!,
      ...(proveIdentity ? { identityAddress: spec.identityAddress } : {}),
      ...(accountAddresses.length > 0 ? { accountAddresses } : {}),
    };
  }
  if (accounts) {
    items[accounts.scope === 'ongoing' ? 'ongoingAccounts' : 'oneTimeAccounts'] = accountsItem(accounts, challenge);
  }
  if (personaData) {
    items[personaData.scope === 'ongoing' ? 'ongoingPersonaData' : 'oneTimePersonaData'] =
      personaDataItem(personaData);
  }
  return items;
}

/** Wraps request items in the full interaction the dApp sends. */
export function buildWalletInteraction(input: {
  items: WalletRequestItems;
  networkId: number;
  dAppDefinitionAddress: string;
  origin: string;
  interactionId: string;
}): WalletInteraction {
  return {
    interactionId: input.interactionId,
    metadata: {
      version: 2,
      networkId: input.networkId,
      dAppDefinitionAddress: input.dAppDefinitionAddress,
      origin: input.origin,
    },
    items: input.items,
  };
}
