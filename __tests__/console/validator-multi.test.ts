import { describe, it, expect } from 'vitest';

import {
  buildValidatorBatchManifest,
  createValidatorOperation,
  validateValidatorBatch,
} from '@/features/console/lib/validator-operations';
import { staticallyValidateManifest } from '@/services/ret';

/* Four real Stokenet validators and the account that would own their badges. */
const ACCOUNT = 'account_tdx_2_16x0x4xa8ysve6h536vkywe00mlc0ms8qmr8quugf2nl8fg3ng8eyjf';
const XRD = 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc';
const OWNER_BADGE = 'resource_tdx_2_1nfxxxxxxxxxxvdrwnrxxxxxxxxx004365253834xxxxxxxxxyerzzk';

const VALIDATORS = [
  'validator_tdx_2_1sdtnujyn3720ymg8lakydkvc5tw4q3zecdj95akdwt9de362mvtd94',
  'validator_tdx_2_1sdvlm4e2x0mjr7mxkpfejz8m0tfwk0j937lxsw74t9lw3evhj5tlwk',
  'validator_tdx_2_1svr6rmtd9ts5zx8d3euwmmp6mmjdtcj2q7zlmd8xjrn4qx7q5snkas',
  'validator_tdx_2_1sdlkptcwjpajqawnuya8r2mgl3eqt89hw27ww6du8kxmx3thmyu8l4',
];

const BADGES = {
  [VALIDATORS[0]]: '[8307a1ed6d2ae14118ed8e78edec3adee4d5e24a0785fdb4e690e7501bc0]',
  [VALIDATORS[1]]: '[837f60af0e907b2075d3e13a71ab68fc72059cb772bce769bc3d8db34577]',
  [VALIDATORS[2]]: '[83573e48938f94f26d07ff6c46d998a2dd504459c3645a76cd72cadcc74a]',
  [VALIDATORS[3]]: '[8359fdd72a33f721fb66b0539908fb7ad2eb3e458fbe683bd5597ee8e597]',
};

/** Exactly 32 characters, as the engine demands. */
const VOTE = 'c0d928cf271e039ecuttlefish-part2';

const CTX = {
  account: ACCOUNT,
  xrdAddress: XRD,
  ownerBadgeResource: OWNER_BADGE,
  badgeIdByValidator: BADGES,
  feeLock: '50',
};

/** What the registration form emits with N validators switched on. */
const voteOn = (validators: string[]) =>
  validators.map((validator) =>
    createValidatorOperation('signal-protocol-update', { validator, version: VOTE }),
  );

describe('one transaction across several validators', () => {
  it('emits a single proof carrying every badge, then one call per validator', () => {
    const manifest = buildValidatorBatchManifest(voteOn(VALIDATORS), CTX);

    expect(manifest.match(/create_proof_of_non_fungibles/g)).toHaveLength(1);
    expect(manifest.match(/"lock_fee"/g)).toHaveLength(1);
    expect(manifest.match(/signal_protocol_update_readiness/g)).toHaveLength(4);

    for (const badge of Object.values(BADGES)) {
      expect(manifest).toContain(`NonFungibleLocalId("${badge}")`);
    }
    for (const validator of VALIDATORS) {
      expect(manifest).toContain(`Address("${validator}")`);
    }
  });

  it('keeps the proof before every call that depends on it', () => {
    const manifest = buildValidatorBatchManifest(voteOn(VALIDATORS), CTX);
    const proofAt = manifest.indexOf('create_proof_of_non_fungibles');
    expect(proofAt).toBeGreaterThan(-1);
    expect(manifest.indexOf('signal_protocol_update_readiness')).toBeGreaterThan(proofAt);
  });

  it('validates against the Radix Engine Toolkit', async () => {
    const manifest = buildValidatorBatchManifest(voteOn(VALIDATORS), CTX);
    const result = await staticallyValidateManifest(manifest, 'stokenet');
    expect(result.valid, result.error).toBe(true);
  });

  it('does not flag the same setting on different validators as a conflict', () => {
    expect(validateValidatorBatch(voteOn(VALIDATORS), BADGES)).toEqual([]);
  });

  it('still catches the same setting twice on ONE validator', () => {
    const issues = validateValidatorBatch(voteOn([VALIDATORS[0], VALIDATORS[0]]), BADGES);
    expect(issues.map((issue) => issue.code)).toEqual(['exclusive']);
  });

  it('adds a badge to the proof only for the owner-gated calls', () => {
    const mixed = [
      ...voteOn([VALIDATORS[0]]),
      // public: needs no badge of its own
      createValidatorOperation('stake', { validator: VALIDATORS[1], amount: '100' }),
    ];
    const manifest = buildValidatorBatchManifest(mixed, CTX);
    expect(manifest).toContain(BADGES[VALIDATORS[0]]);
    expect(manifest).not.toContain(BADGES[VALIDATORS[1]]);
  });

  it('deduplicates the badge when one validator gets several operations', () => {
    const manifest = buildValidatorBatchManifest(
      [
        createValidatorOperation('register', { validator: VALIDATORS[0] }),
        createValidatorOperation('update-fee', { validator: VALIDATORS[0], feeFactor: '0.05' }),
      ],
      CTX,
    );
    expect(manifest.match(new RegExp(BADGES[VALIDATORS[0]].replace(/[[\]]/g, '\\$&'), 'g'))).toHaveLength(1);
  });
});
