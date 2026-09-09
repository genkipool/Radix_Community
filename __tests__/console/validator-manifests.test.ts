import { describe, it, expect } from 'vitest';

import {
  createValidatorInstruction,
  registerValidatorInstruction,
  unregisterValidatorInstruction,
  updateAcceptDelegatedStakeInstruction,
  updateValidatorFeeInstruction,
  updateValidatorKeyInstruction,
  validatorProfileInstructions,
} from '@/features/console/lib/validator-manifests';
import { MANIFEST_TEMPLATES, isTemplateComplete } from '@/features/console/lib/manifest-templates';
import {
  BLOCK_DEFS,
  BLOCK_CATEGORIES,
  buildManifestFromBlocks,
  createBlock,
  type BlockInstance,
} from '@/features/console/lib/manifest-blocks';
import enLocale from '@/features/console/locales/en.json';
import esLocale from '@/features/console/locales/es.json';

const VALIDATOR = 'validator_rdx1sdtnujyn3720ymg8lakydkvc5tw4q3zecdj95akdwt9de362mvtd94';
const ACCOUNT = 'account_rdx1283u6e8r2jnz4a3jwv0hnrqfr8aq7kapg7q8h9d4f560g2f8wq7y4l';
const OWNER_BADGE = 'resource_rdx1nfxxxxxxxxxxvdrwnrxxxxxxxxx004365253834xxxxxxxxxvdrwnr';
const XRD = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';
const KEY = '0333f9189597447e1530aef81747778f683d9a04d55445374de95d364e48c2e784';
const LSU = 'resource_rdx1thnhmstrn255f3g5fmqm2rlnvxc9lhu6vhpsnkyc75dpfnkyuk8t8n';

const CTX = { xrdAddress: XRD, poolPackage: '', validatorOwnerBadge: OWNER_BADGE };

const template = (id: string) => {
  const found = MANIFEST_TEMPLATES.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`template ${id} not found`);
  return found;
};

describe('validator instructions', () => {
  it('registers and unregisters through the validator component', () => {
    expect(registerValidatorInstruction(VALIDATOR)).toContain(`Address("${VALIDATOR}")`);
    expect(registerValidatorInstruction(VALIDATOR)).toContain('"register"');
    expect(unregisterValidatorInstruction(VALIDATOR)).toContain('"unregister"');
  });

  it('emits CREATE_VALIDATOR with key, fee factor and payment bucket in order', () => {
    const manifest = createValidatorInstruction({
      publicKeyHex: KEY,
      feeFactor: '0.05',
      paymentBucket: 'validator_creation_fee',
    });
    expect(manifest).toContain('CREATE_VALIDATOR');
    expect(manifest.indexOf(`Bytes("${KEY}")`)).toBeLessThan(manifest.indexOf('Decimal("0.05")'));
    expect(manifest.indexOf('Decimal("0.05")')).toBeLessThan(
      manifest.indexOf('Bucket("validator_creation_fee")'),
    );
  });

  it('writes accept_delegated_stake as a bare manifest bool, not a string', () => {
    expect(updateAcceptDelegatedStakeInstruction(VALIDATOR, true)).toMatch(/\n {4}true\n/);
    expect(updateAcceptDelegatedStakeInstruction(VALIDATOR, false)).toMatch(/\n {4}false\n/);
  });

  it('passes the fee factor as a Decimal and the key as Bytes', () => {
    expect(updateValidatorFeeInstruction(VALIDATOR, '0.1')).toContain('Decimal("0.1")');
    expect(updateValidatorKeyInstruction(VALIDATOR, KEY)).toContain(`Bytes("${KEY}")`);
  });

  it('escapes quotes coming from user input', () => {
    const manifest = validatorProfileInstructions(VALIDATOR, { name: 'The "best" node' });
    expect(manifest).toContain('The \\"best\\" node');
  });

  it('only emits profile keys that were filled in, with the right SBOR types', () => {
    const manifest = validatorProfileInstructions(VALIDATOR, {
      name: 'Guepi',
      iconUrl: 'https://example.test/icon.png',
      description: '   ',
    });
    expect(manifest).toContain('"name"');
    expect(manifest).toContain('Enum<Metadata::String>("Guepi")');
    expect(manifest).toContain('Enum<Metadata::Url>("https://example.test/icon.png")');
    expect(manifest).not.toContain('"description"');
    expect(manifest).not.toContain('"info_url"');
  });

});

describe('validator templates', () => {
  it('prefixes every owner-gated template with the owner badge proof', () => {
    const values = { account: ACCOUNT, validator: VALIDATOR, ownerBadgeId: '[abcd]' };
    for (const candidate of MANIFEST_TEMPLATES.filter((t) => t.validatorOwner)) {
      const manifest = candidate.build(values, CTX);
      expect(manifest, candidate.id).toContain('"create_proof_of_non_fungibles"');
      expect(manifest, candidate.id).toContain(`Address("${OWNER_BADGE}")`);
      expect(manifest, candidate.id).toContain('NonFungibleLocalId("[abcd]")');
    }
  });

  it('names the account, validator and badge fields its binding declares', () => {
    for (const candidate of MANIFEST_TEMPLATES.filter((t) => t.validatorOwner)) {
      const binding = candidate.validatorOwner!;
      const keys = candidate.fields.map((field) => field.key);
      expect(keys, candidate.id).toContain(binding.accountField);
      expect(keys, candidate.id).toContain(binding.validatorField);
      expect(keys, candidate.id).toContain(binding.badgeIdField);
    }
  });

  it('no longer asks for the owner badge resource — it comes from the network', () => {
    for (const candidate of MANIFEST_TEMPLATES) {
      expect(candidate.fields.map((f) => f.key), candidate.id).not.toContain('ownerBadge');
    }
  });

  it('builds the create-validator flow: withdraw, take, create, deposit', () => {
    const manifest = template('create-validator').build(
      { account: ACCOUNT, publicKey: KEY, feeFactor: '0.05', payment: '2000' },
      CTX,
    );
    const order = [
      '"withdraw"',
      'TAKE_FROM_WORKTOP',
      'CREATE_VALIDATOR',
      '"try_deposit_batch_or_abort"',
    ];
    const positions = order.map((needle) => manifest.indexOf(needle));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    // The payment is named in the take, so the bucket holds exactly what the
    // form asked for even if something else left XRD on the worktop.
    expect(manifest).toContain('Decimal("2000")');
    expect(manifest).not.toContain('TAKE_ALL_FROM_WORKTOP');
  });

  it('names the amount in every staking template take', () => {
    const staking = ['stake', 'unstake', 'stake-owner', 'unstake-owner', 'lock-owner-stake'];
    for (const id of staking) {
      const built = template(id).build(
        {
          account: ACCOUNT,
          validator: VALIDATOR,
          ownerBadgeId: '[ab]',
          lsuResource: LSU,
          amount: '42',
        },
        CTX,
      );
      expect(built, id).not.toContain('TAKE_ALL_FROM_WORKTOP');
      expect(built, id).toMatch(/TAKE_FROM_WORKTOP\n {4}Address\("[^"]+"\)\n {4}Decimal\("42"\)/);
    }
  });

  it('takes the claim NFTs by id in the claim template', () => {
    const built = template('claim-stake').build(
      { account: ACCOUNT, validator: VALIDATOR, claimNft: LSU, claimNftId: '#7#' },
      CTX,
    );
    expect(built).toContain('TAKE_NON_FUNGIBLES_FROM_WORKTOP');
    expect(built).toContain('NonFungibleLocalId("#7#")');
    expect(built).not.toContain('TAKE_ALL_FROM_WORKTOP');
  });

  it('treats the delegation toggle as false only when explicitly false', () => {
    const build = (accept: string) =>
      template('accept-delegated-stake').build(
        { account: ACCOUNT, validator: VALIDATOR, ownerBadgeId: '[ab]', accept },
        CTX,
      );
    expect(build('true')).toMatch(/\n {4}true\n/);
    expect(build('false')).toMatch(/\n {4}false\n/);
  });

  it('treats the profile fields as optional so a partial update is complete', () => {
    const profile = template('validator-profile');
    expect(
      isTemplateComplete(profile, {
        account: ACCOUNT,
        validator: VALIDATOR,
        ownerBadgeId: '[ab]',
        name: 'Guepi',
      }),
    ).toBe(true);
  });
});

describe('validator blocks', () => {
  const block = (type: Parameters<typeof createBlock>[0], values: Record<string, string>): BlockInstance => ({
    ...createBlock(type),
    values: { ...createBlock(type).values, ...values },
  });

  it('renders register and unregister blocks', () => {
    const { manifest } = buildManifestFromBlocks([
      block('validatorRegister', { validator: VALIDATOR }),
      block('validatorUnregister', { validator: VALIDATOR }),
    ]);
    expect(manifest).toContain('"register"');
    expect(manifest).toContain('"unregister"');
  });

  it('seeds a choice field so the toggle matches what the manifest encodes', () => {
    const created = createBlock('validatorAcceptDelegatedStake');
    expect(created.values.accept).toBe('true');
  });

  it('produces identical instructions from a block and from a template', () => {
    const { manifest } = buildManifestFromBlocks([
      block('validatorUpdateFee', { validator: VALIDATOR, feeFactor: '0.1' }),
    ]);
    expect(manifest.trim()).toBe(updateValidatorFeeInstruction(VALIDATOR, '0.1').trim());
  });

  it('does not offer a named bucket for calls that return to the worktop', () => {
    for (const type of ['validatorStake', 'validatorUnstake', 'validatorClaimXrd'] as const) {
      expect(BLOCK_DEFS[type].producesBucket, type).toBeFalsy();
    }
  });

  it('groups every validator block under one palette category', () => {
    const category = BLOCK_CATEGORIES.find((entry) => entry.id === 'validator');
    expect(category).toBeDefined();
    const validatorBlocks = Object.values(BLOCK_DEFS)
      .filter((def) => def.type.startsWith('validator') || def.type === 'createValidator' || def.type === 'signalProtocolUpdate')
      .map((def) => def.type);
    expect([...category!.blocks].sort()).toEqual([...validatorBlocks].sort());
  });
});

describe('validator locales', () => {
  const bm = (locale: typeof enLocale) => locale.console.buildManifest;

  it('labels every field of every validator template in both languages', () => {
    for (const locale of [enLocale, esLocale]) {
      const templates = bm(locale).templates as Record<string, { fields: Record<string, string> }>;
      for (const candidate of MANIFEST_TEMPLATES.filter((t) => t.validatorOwner)) {
        for (const field of candidate.fields) {
          expect(templates[candidate.id]?.fields?.[field.key], `${candidate.id}.${field.key}`).toBeTruthy();
        }
      }
    }
  });

  it('labels every validator block field in both languages', () => {
    const category = BLOCK_CATEGORIES.find((entry) => entry.id === 'validator')!;
    for (const locale of [enLocale, esLocale]) {
      const blocks = bm(locale).blocks as Record<string, { fields: Record<string, string> }>;
      for (const type of category.blocks) {
        for (const field of BLOCK_DEFS[type].fields) {
          expect(blocks[type]?.fields?.[field.key], `${type}.${field.key}`).toBeTruthy();
        }
      }
    }
  });
});
