import { describe, it, expect } from 'vitest';

import {
  epochOf,
  parseClaimNft,
  parseValidatorState,
  sortClaimNfts,
  validatorOfOwnerBadge,
  validatorOfResource,
  type ClaimableNft,
  type NonFungibleDataItem,
} from '@/features/console/lib/validator-lookup';

const VALIDATOR = 'validator_rdx1sdtnujyn3720ymg8lakydkvc5tw4q3zecdj95akdwt9de362mvtd94';
const CLAIM_RESOURCE = 'resource_rdx1nt3pt0dyfrzptjyzcrgrfpe3hcuq3sgt8n2gcjfa2f6d4rf5nvxqt5';

/** The Gateway response shape, trimmed to the fields the parsers read. */
const validatorDetails = (state: Record<string, unknown>) => ({ details: { state } });

const nft = (id: string, amount: number, epoch: number): NonFungibleDataItem => ({
  non_fungible_id: id,
  data: {
    programmatic_json: {
      fields: [
        { field_name: 'claim_amount', value: String(amount) },
        { field_name: 'claim_epoch', value: String(epoch) },
      ],
    },
  },
});

describe('validator state parsing', () => {
  it('reads the fields the forms and the MCP need', () => {
    const state = parseValidatorState(
      validatorDetails({
        is_registered: true,
        accepts_delegated_stake: false,
        validator_fee_factor: 0.05,
        stake_unit_resource_address: 'resource_rdx1lsu',
        claim_token_resource_address: CLAIM_RESOURCE,
        public_key: { key_hex: '03aa' },
      }),
    );

    expect(state).toEqual({
      isRegistered: true,
      acceptsDelegatedStake: false,
      feeFactor: '0.05',
      stakeUnitResource: 'resource_rdx1lsu',
      claimNftResource: CLAIM_RESOURCE,
      publicKey: '03aa',
    });
  });

  it('returns null for an entity that is not a validator', () => {
    expect(parseValidatorState({ details: { state: {} } })).toBeNull();
    expect(parseValidatorState({})).toBeNull();
  });

  it('does not mistake an unregistered validator for a non-validator', () => {
    expect(parseValidatorState(validatorDetails({ is_registered: false }))?.isRegistered).toBe(
      false,
    );
  });
});

describe('badge and resource attribution', () => {
  it('reads the validator out of an owner badge', () => {
    expect(
      validatorOfOwnerBadge({
        non_fungible_id: '[aa]',
        data: { programmatic_json: { fields: [{ field_name: 'validator', value: VALIDATOR }] } },
      }),
    ).toBe(VALIDATOR);
  });

  it('ignores a badge whose data has no validator field', () => {
    expect(validatorOfOwnerBadge({ non_fungible_id: '[aa]' })).toBeUndefined();
  });

  it('reads the validator out of a claim NFT resource', () => {
    expect(
      validatorOfResource({ metadata: { items: [
        { key: 'validator', value: { typed: { type: 'GlobalAddress', value: VALIDATOR } } },
      ] } }),
    ).toBe(VALIDATOR);
  });

  it('gives no validator for a resource that carries none', () => {
    expect(validatorOfResource({ metadata: { items: [] } })).toBe('');
  });
});

describe('claim NFTs', () => {
  const parse = (id: string, amount: number, epoch: number, currentEpoch: number) =>
    parseClaimNft(nft(id, amount, epoch), {
      resourceAddress: CLAIM_RESOURCE,
      validatorAddress: VALIDATOR,
      validatorDetails: { metadata: { items: [
        { key: 'name', value: { typed: { type: 'String', value: 'Guepi' } } },
      ] } },
      currentEpoch,
    });

  it('attributes each NFT to its validator, by name where there is one', () => {
    const claim = parse('{a}', 120.5, 100, 100);
    expect(claim.validatorAddress).toBe(VALIDATOR);
    expect(claim.validatorName).toBe('Guepi');
    expect(claim.amount).toBe(120.5);
  });

  it('falls back to the address when the validator has no name', () => {
    const claim = parseClaimNft(nft('{a}', 1, 1), {
      resourceAddress: CLAIM_RESOURCE,
      validatorAddress: VALIDATOR,
      validatorDetails: null,
      currentEpoch: 1,
    });
    expect(claim.validatorName).toBe(VALIDATOR);
  });

  it('is claimable from its epoch onward, not before', () => {
    expect(parse('{a}', 1, 100, 99).isClaimable).toBe(false);
    expect(parse('{a}', 1, 100, 100).isClaimable).toBe(true);
    expect(parse('{a}', 1, 100, 101).isClaimable).toBe(true);
  });

  it('sorts redeemable first, then by how soon the rest mature', () => {
    const make = (localId: string, claimEpoch: number, isClaimable: boolean) =>
      ({ localId, claimEpoch, isClaimable }) as ClaimableNft;
    const sorted = sortClaimNfts([
      make('later', 300, false),
      make('soon', 200, false),
      make('ready', 100, true),
    ]);
    expect(sorted.map((entry) => entry.localId)).toEqual(['ready', 'soon', 'later']);
  });
});

describe('ledger state', () => {
  it('reads the current epoch, defaulting to zero', () => {
    expect(epochOf({ ledger_state: { epoch: 42 } })).toBe(42);
    expect(epochOf({})).toBe(0);
  });
});
