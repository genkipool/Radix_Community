import { describe, it, expect } from 'vitest';

import {
  VALIDATOR_OPERATIONS,
  VALIDATOR_OPERATION_GROUPS,
  VALIDATOR_OPERATION_KINDS,
  buildValidatorBatchManifest,
  createValidatorOperation,
  isOperationComplete,
  validateValidatorBatch,
  type ValidatorOperation,
  type ValidatorOperationKind,
} from '@/features/console/lib/validator-operations';
import { CONSOLE_TOOL_SLUGS } from '@/features/console/types/console.types';
import { CONSOLE_GROUPS } from '@/features/console/data/consoleTools';
import enLocale from '@/features/console/locales/en.json';
import esLocale from '@/features/console/locales/es.json';

const ACCOUNT = 'account_rdx1283u6e8r2jnz4a3jwv0hnrqfr8aq7kapg7q8h9d4f560g2f8wq7y4l';
const V1 = 'validator_rdx1sdtnujyn3720ymg8lakydkvc5tw4q3zecdj95akdwt9de362mvtd94';
const V2 = 'validator_rdx1sd5368vqdmjk0y2w7ymdts02cz9c52858gpyny56xdvzuheafey2yq';
const XRD = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';
const BADGE = 'resource_rdx1nfxxxxxxxxxxvdrwnrxxxxxxxxx004365253834xxxxxxxxxvdrwnr';
const LSU = 'resource_rdx1thnhmstrn255f3g5fmqm2rlnvxc9lhu6vhpsnkyc75dpfnkyuk8t8n';

const BADGES = { [V1]: '[aa]', [V2]: '[bb]' };
const CTX = {
  account: ACCOUNT,
  xrdAddress: XRD,
  ownerBadgeResource: BADGE,
  badgeIdByValidator: BADGES,
  feeLock: '10',
};

const op = (kind: ValidatorOperationKind, values: Record<string, string> = {}) =>
  createValidatorOperation(kind, values);

const build = (operations: ValidatorOperation[]) => buildValidatorBatchManifest(operations, CTX);

describe('validator operation catalogue', () => {
  it('places every kind in exactly one palette group', () => {
    const grouped = VALIDATOR_OPERATION_GROUPS.flatMap((group) => group.kinds);
    expect([...grouped].sort()).toEqual([...VALIDATOR_OPERATION_KINDS].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it('seeds choice fields so the form matches the manifest from the first render', () => {
    expect(op('accept-delegated-stake').values.accept).toBe('true');
  });

  it('leaves the engine-only methods out: no manifest can ever call them', () => {
    expect(VALIDATOR_OPERATIONS).not.toHaveProperty('apply_emission');
    expect(VALIDATOR_OPERATIONS).not.toHaveProperty('apply_reward');
    expect(VALIDATOR_OPERATIONS).not.toHaveProperty('get_protocol_update_readiness');
    expect(VALIDATOR_OPERATIONS.unregister.ownerOnly).toBe(true);
    expect(VALIDATOR_OPERATIONS.stake.ownerOnly).toBe(false);
  });

  it('treats a profile with every field blank as incomplete', () => {
    expect(isOperationComplete(op('profile', { validator: V1 }))).toBe(false);
    expect(isOperationComplete(op('profile', { validator: V1, name: 'Guepi' }))).toBe(true);
  });
});

describe('batch assembly', () => {
  it('emits one proof carrying every badge the batch needs, not one per call', () => {
    const manifest = build([
      op('register', { validator: V1 }),
      op('update-fee', { validator: V1, feeFactor: '0.1' }),
      op('unregister', { validator: V2 }),
    ]);
    expect(manifest.match(/create_proof_of_non_fungibles/g)).toHaveLength(1);
    // Both badges live in that one proof; the layout of the array is not the point.
    expect(manifest).toContain('NonFungibleLocalId("[aa]")');
    expect(manifest).toContain('NonFungibleLocalId("[bb]")');
  });

  it('locks the fee once, at the top', () => {
    const manifest = build([op('register', { validator: V1 }), op('register', { validator: V2 })]);
    expect(manifest.match(/"lock_fee"/g)).toHaveLength(1);
    expect(manifest.indexOf('"lock_fee"')).toBeLessThan(manifest.indexOf('"register"'));
  });

  it('omits the proof entirely when nothing in the batch is owner-gated', () => {
    const manifest = build([op('stake', { validator: V1, amount: '100' })]);
    expect(manifest).not.toContain('create_proof_of_non_fungibles');
  });

  it('deposits once at the end, only when something returns to the worktop', () => {
    const plain = build([op('register', { validator: V1 })]);
    expect(plain).not.toContain('try_deposit_batch_or_abort');

    const funded = build([
      op('stake-as-owner', { validator: V1, amount: '10' }),
      op('unstake', { validator: V1, stakeUnitResource: LSU, amount: '5' }),
    ]);
    expect(funded.match(/try_deposit_batch_or_abort/g)).toHaveLength(1);
    expect(funded.trimEnd().endsWith(';')).toBe(true);
  });

  it('gives each funded operation its own bucket', () => {
    const manifest = build([
      op('stake-as-owner', { validator: V1, amount: '10' }),
      op('stake-as-owner', { validator: V2, amount: '20' }),
    ]);
    expect(manifest).toContain('Bucket("bucket1")');
    expect(manifest).toContain('Bucket("bucket2")');
  });

  it('keeps the operator order', () => {
    const manifest = build([
      op('update-fee', { validator: V1, feeFactor: '0.1' }),
      op('register', { validator: V1 }),
    ]);
    expect(manifest.indexOf('"update_fee"')).toBeLessThan(manifest.indexOf('"register"'));
  });

  it('leaves incomplete operations out instead of emitting a broken call', () => {
    const manifest = build([
      op('register', { validator: V1 }),
      op('update-fee', { validator: V1 }),
    ]);
    expect(manifest).toContain('"register"');
    expect(manifest).not.toContain('"update_fee"');
  });

  it('builds nothing without an account', () => {
    expect(
      buildValidatorBatchManifest([op('register', { validator: V1 })], { ...CTX, account: '' }),
    ).toBe('');
  });
});

/*
 * Each rule below was established by running the combination against the
 * engine; the comments name what the engine actually did.
 */
describe('batch validation', () => {
  it('accepts a large mixed batch across two validators', () => {
    const issues = validateValidatorBatch(
      [
        op('register', { validator: V1 }),
        op('update-fee', { validator: V1, feeFactor: '0.09' }),
        op('accept-delegated-stake', { validator: V1, accept: 'true' }),
        op('profile', { validator: V1, name: 'Guepi' }),
        op('stake-as-owner', { validator: V1, amount: '50' }),
        op('register', { validator: V2 }),
      ],
      BADGES,
    );
    expect(issues).toEqual([]);
  });

  // Engine: commits both, the last one silently wins.
  it('flags two operations writing the same setting on one validator', () => {
    const issues = validateValidatorBatch(
      [op('register', { validator: V1 }), op('unregister', { validator: V1 })],
      BADGES,
    );
    expect(issues.map((issue) => issue.code)).toEqual(['exclusive']);
  });

  it('allows the same setting on two different validators', () => {
    const issues = validateValidatorBatch(
      [op('register', { validator: V1 }), op('unregister', { validator: V2 })],
      BADGES,
    );
    expect(issues).toEqual([]);
  });

  // Engine: ApplicationError(ValidatorError(EpochUnlockHasNotOccurredYet)).
  it('flags unstake combined with claim on the same validator, once', () => {
    const issues = validateValidatorBatch(
      [
        op('unstake', { validator: V1, stakeUnitResource: LSU, amount: '1' }),
        op('claim-xrd', { validator: V1, claimNftResource: LSU, claimNftIds: '#1#' }),
      ],
      BADGES,
    );
    expect(issues.map((issue) => issue.code)).toEqual(['aborts']);
  });

  it('allows unstake and claim on different validators', () => {
    const issues = validateValidatorBatch(
      [
        op('unstake', { validator: V1, stakeUnitResource: LSU, amount: '1' }),
        op('claim-xrd', { validator: V2, claimNftResource: LSU, claimNftIds: '#1#' }),
      ],
      BADGES,
    );
    expect(issues).toEqual([]);
  });

  // The created validator has no address until the transaction commits.
  it('flags create-validator sharing a transaction, but not on its own', () => {
    expect(
      validateValidatorBatch(
        [op('create-validator', { publicKey: 'aa', feeFactor: '0.1', payment: '2000' })],
        BADGES,
      ),
    ).toEqual([]);
    expect(
      validateValidatorBatch(
        [
          op('create-validator', { publicKey: 'aa', feeFactor: '0.1', payment: '2000' }),
          op('register', { validator: V1 }),
        ],
        BADGES,
      ).map((issue) => issue.code),
    ).toEqual(['standalone']);
  });

  it('flags an owner call with no badge for that validator', () => {
    const issues = validateValidatorBatch([op('register', { validator: V1 })], {});
    expect(issues.map((issue) => issue.code)).toEqual(['missing-badge']);
  });

  it('does not demand a badge for the public operations', () => {
    const issues = validateValidatorBatch([op('stake', { validator: V1, amount: '1' })], {});
    expect(issues).toEqual([]);
  });
});

describe('validator section wiring', () => {
  const SLUGS = [
    'validator-registration',
    'validator-profile',
    'validator-staking',
    'validator-create',
  ] as const;

  it('registers the four forms as console tools', () => {
    for (const slug of SLUGS) expect(CONSOLE_TOOL_SLUGS).toContain(slug);
  });

  it('gives the validator section its own sidebar group holding exactly those forms', () => {
    const group = CONSOLE_GROUPS.find((entry) => entry.id === 'validator');
    expect(group, 'validator group').toBeDefined();
    expect([...group!.tools].sort()).toEqual([...SLUGS].sort());

    // and it is no longer buried inside another group
    const others = CONSOLE_GROUPS.filter((entry) => entry.id !== 'validator');
    for (const slug of SLUGS) {
      expect(others.flatMap((entry) => entry.tools), slug).not.toContain(slug);
    }
  });

  it('names the section and every form in both languages', () => {
    for (const locale of [enLocale, esLocale]) {
      expect((locale.console.groups as Record<string, string>).validator).toBeTruthy();
      for (const slug of SLUGS) {
        const tool = (locale.console.tools as Record<string, { title: string; description: string }>)[slug];
        expect(tool?.title, slug).toBeTruthy();
        expect(tool?.description, slug).toBeTruthy();
      }
      const forms = locale.console.validator.forms;
      for (const key of ['registration', 'profile', 'staking', 'create'] as const) {
        expect(forms[key]?.title, key).toBeTruthy();
        expect(forms[key]?.hint, key).toBeTruthy();
      }
    }
  });

  it('keeps the measured rules visible to the operator', () => {
    for (const locale of [enLocale, esLocale]) {
      // create_validator travels alone
      expect(locale.console.validator.forms.create.standaloneNote).toBeTruthy();
      // unstake + claim aborts on-ledger
      expect(locale.console.validator.forms.staking.claim.lockedByUnstake).toBeTruthy();
      // the protocol version name is length-checked by the engine
      expect(locale.console.validator.forms.registration.voteLengthError).toBeTruthy();
    }
  });
});
