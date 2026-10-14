import { describe, expect, it } from 'vitest';
import { toWalletRequest, walletDataDefault, type DataRequestState, type WalletData } from '@radixdlt/radix-dapp-toolkit';
import {
  buildWalletRequestItems,
  needsChallenge,
  validateWalletRequest,
  type WalletRequestSpec,
} from '@/features/wallet/lib/wallet-interaction';

const CHALLENGE = 'ab'.repeat(32);
const IDENTITY = 'identity_tdx_2_12xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const ACCOUNT = 'account_tdx_2_12xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

/** What the dApp toolkit itself sends for the same request. */
function toolkitItems(
  state: Record<string, unknown>,
  { oneTime, persona }: { oneTime: boolean; persona?: { identityAddress: string; label: string } },
) {
  const result = toWalletRequest({
    dataRequestState: state as DataRequestState,
    isConnect: false,
    oneTime,
    challenge: CHALLENGE,
    walletData: { ...walletDataDefault, persona } as WalletData,
  });
  if (result.isErr()) throw new Error('toolkit refused the request');
  return JSON.parse(JSON.stringify(result.value));
}

describe('buildWalletRequestItems matches the dApp toolkit', () => {
  it('one-time accounts with proof and persona data', () => {
    const spec: WalletRequestSpec = {
      auth: 'none',
      accounts: { scope: 'oneTime', quantifier: 'exactly', quantity: 2, withProof: true },
      personaData: {
        scope: 'oneTime',
        fullName: true,
        emailAddresses: { quantifier: 'atLeast', quantity: 1 },
        phoneNumbers: { quantifier: 'exactly', quantity: 1 },
      },
    };
    expect(buildWalletRequestItems(spec, CHALLENGE)).toEqual(
      toolkitItems(
        {
          accounts: { numberOfAccounts: { quantifier: 'exactly', quantity: 2 }, withProof: true },
          personaData: {
            fullName: true,
            emailAddresses: { quantifier: 'atLeast', quantity: 1 },
            phoneNumbers: { quantifier: 'exactly', quantity: 1 },
          },
        },
        { oneTime: true },
      ),
    );
  });

  it('persona login with challenge, ongoing accounts and data', () => {
    const spec: WalletRequestSpec = {
      auth: 'loginWithChallenge',
      accounts: { scope: 'ongoing', quantifier: 'atLeast', quantity: 1, withProof: true },
      personaData: { scope: 'ongoing', fullName: true },
    };
    expect(buildWalletRequestItems(spec, CHALLENGE)).toEqual(
      toolkitItems(
        {
          persona: { withProof: true },
          accounts: { numberOfAccounts: { quantifier: 'atLeast', quantity: 1 }, withProof: true },
          personaData: { fullName: true },
        },
        { oneTime: false },
      ),
    );
  });

  it('proof of ownership of known accounts and the persona', () => {
    const spec: WalletRequestSpec = {
      auth: 'usePersona',
      identityAddress: IDENTITY,
      proofOfOwnership: { accountAddresses: [ACCOUNT], proveIdentity: true },
    };
    expect(buildWalletRequestItems(spec, CHALLENGE)).toEqual(
      toolkitItems(
        { proofOfOwnership: { accountAddresses: [ACCOUNT], identityAddress: IDENTITY } },
        { oneTime: true, persona: { identityAddress: IDENTITY, label: 'Me' } },
      ),
    );
  });
});

describe('requests without any address', () => {
  it('a persona login signs a challenge and shares no account', () => {
    const items = buildWalletRequestItems({ auth: 'loginWithChallenge' }, CHALLENGE);
    expect(items).toEqual({
      discriminator: 'authorizedRequest',
      auth: { discriminator: 'loginWithChallenge', challenge: CHALLENGE },
      reset: { accounts: false, personaData: false },
    });
  });

  it('a proof of the persona alone is refused: the Android wallet never completes it', () => {
    expect(
      validateWalletRequest({ auth: 'usePersona', identityAddress: IDENTITY, proofOfOwnership: { accountAddresses: [], proveIdentity: true } }),
    ).toEqual(['proofPersonaNeedsAccount']);
  });

  it('zero accounts are left out of the request, not sent as quantity 0', () => {
    const items = buildWalletRequestItems({
      auth: 'none',
      accounts: { scope: 'oneTime', quantifier: 'atLeast', quantity: 0, withProof: true },
      personaData: { scope: 'oneTime', fullName: true },
    });
    expect(items).toEqual({ discriminator: 'unauthorizedRequest', oneTimePersonaData: { isRequestingName: true } });
  });
});

describe('validation', () => {
  it('reports what the wallet would refuse', () => {
    expect(validateWalletRequest({ auth: 'none' })).toEqual(['empty']);
    expect(
      validateWalletRequest({ auth: 'none', accounts: { scope: 'ongoing', quantifier: 'atLeast', quantity: 1, withProof: false } }),
    ).toEqual(['ongoingNeedsPersona']);
    expect(validateWalletRequest({ auth: 'usePersona' })).toEqual(['identityMissing']);
    expect(
      validateWalletRequest({
        auth: 'usePersona',
        identityAddress: IDENTITY,
        proofOfOwnership: { accountAddresses: [], proveIdentity: false },
      }),
    ).toEqual(['proofEmpty']);
    expect(validateWalletRequest({ auth: 'none', personaData: { scope: 'oneTime', fullName: false } })).toEqual([
      'personaDataEmpty',
      'empty',
    ]);
  });

  it('knows when a challenge is signed', () => {
    expect(needsChallenge({ auth: 'loginWithoutChallenge' })).toBe(false);
    expect(needsChallenge({ auth: 'loginWithChallenge' })).toBe(true);
    expect(() => buildWalletRequestItems({ auth: 'loginWithChallenge' })).toThrow(/challengeMissing/);
  });
});
