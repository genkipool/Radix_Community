import { describe, it, expect } from 'vitest';

import {
  buildBatchClaimManifest,
  buildBatchUnstakeManifest,
  buildClaimManifest,
  buildOwnerStakeManifest,
  buildStakeManifest,
  buildUnstakeManifest,
} from '@/features/wallet/lib/manifest-builders';

const ACCOUNT = 'account_rdx1283u6e8r2jnz4a3jwv0hnrqfr8aq7kapg7q8h9d4f560g2f8wq7y4l';
const V1 = 'validator_rdx1sdtnujyn3720ymg8lakydkvc5tw4q3zecdj95akdwt9de362mvtd94';
const V2 = 'validator_rdx1sd5368vqdmjk0y2w7ymdts02cz9c52858gpyny56xdvzuheafey2yq';
const XRD = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';
const LSU = 'resource_rdx1thnhmstrn255f3g5fmqm2rlnvxc9lhu6vhpsnkyc75dpfnkyuk8t8n';
const CLAIM = 'resource_rdx1ngekvyag42r0xkhy2ds08fcl7f2ncgc0g74yg6wpeeyc4vtj03sa9f';
const BADGE = 'resource_rdx1nfxxxxxxxxxxvdrwnrxxxxxxxxx004365253834xxxxxxxxxvdrwnr';

/*
 * Every take names what it is taking, so a bucket can only hold what its own
 * withdrawal put on the worktop. Measured on resim 1.3.1: a claim of 500 XRD
 * sharing a transaction with a stake of 100 XRD staked 600 when the take was
 * TAKE_ALL_FROM_WORKTOP, and 100 once the amount was named.
 */
describe('wallet manifest builders', () => {
  it('names the amount in the stake and unstake takes', () => {
    const stake = buildStakeManifest(ACCOUNT, V1, 100, XRD);
    expect(stake).not.toContain('TAKE_ALL_FROM_WORKTOP');
    expect(stake.match(/Decimal\("100"\)/g)).toHaveLength(2);

    const unstake = buildUnstakeManifest(ACCOUNT, V1, 42, LSU);
    expect(unstake).not.toContain('TAKE_ALL_FROM_WORKTOP');
    expect(unstake.match(/Decimal\("42"\)/g)).toHaveLength(2);
  });

  it('takes the claim NFTs by id', () => {
    const manifest = buildClaimManifest(ACCOUNT, V1, ['#1#', '#2#'], CLAIM);
    expect(manifest).toContain('TAKE_NON_FUNGIBLES_FROM_WORKTOP');
    expect(manifest).not.toContain('TAKE_ALL_FROM_WORKTOP');
    expect(manifest.match(/NonFungibleLocalId\("#1#"\)/g)).toHaveLength(2);
  });

  it('keeps two claims on one resource in separate buckets', () => {
    // Both withdrawals run before either take, so a TAKE_ALL for the first
    // item would have swallowed the second item's NFT as well.
    const manifest = buildBatchClaimManifest(ACCOUNT, [
      { validatorAddress: V1, claimNftResourceAddress: CLAIM, claimNftLocalIds: ['#1#'] },
      { validatorAddress: V2, claimNftResourceAddress: CLAIM, claimNftLocalIds: ['#2#'] },
    ]);
    expect(manifest).not.toContain('TAKE_ALL_FROM_WORKTOP');
    expect(manifest.match(/TAKE_NON_FUNGIBLES_FROM_WORKTOP/g)).toHaveLength(2);
    expect(manifest.match(/NonFungibleLocalId\("#1#"\)/g)).toHaveLength(2);
    expect(manifest.match(/NonFungibleLocalId\("#2#"\)/g)).toHaveLength(2);
  });

  it('gives each unstake in a batch the amount it withdrew', () => {
    const manifest = buildBatchUnstakeManifest(ACCOUNT, [
      { validatorAddress: V1, amountLsu: 10, lsuResourceAddress: LSU },
      { validatorAddress: V2, amountLsu: 20, lsuResourceAddress: LSU },
    ]);
    expect(manifest).not.toContain('TAKE_ALL_FROM_WORKTOP');
    expect(manifest.match(/Decimal\("10"\)/g)).toHaveLength(2);
    expect(manifest.match(/Decimal\("20"\)/g)).toHaveLength(2);
  });

  it('takes all only for the stake units stake_as_owner hands back', () => {
    const manifest = buildOwnerStakeManifest(ACCOUNT, V1, 500, XRD, LSU, '[ab]', BADGE);
    // The XRD leg is a withdrawal, so its amount is known.
    expect(manifest).toContain(`TAKE_FROM_WORKTOP\n    Address("${XRD}")\n    Decimal("500")`);
    // The LSU leg is the validator's output at its exchange rate: no amount to name.
    expect(manifest).toContain(`TAKE_ALL_FROM_WORKTOP\n    Address("${LSU}")`);
  });
});
