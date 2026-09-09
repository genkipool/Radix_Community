import { describe, it, expect } from 'vitest';

import { getMcpRegistry } from '@/services/mcp/tools';
import { generateSkillMarkdown } from '@/services/mcp/skills';
import {
  VALIDATOR_OPERATION_KINDS,
  buildValidatorBatchManifest,
  createValidatorOperation,
} from '@/features/console/lib/validator-operations';
import { staticallyValidateManifest } from '@/services/ret';

/* Real Stokenet entities, so the toolkit checks addresses as well as syntax. */
const ACCOUNT = 'account_tdx_2_12xned60hq7pu6t83nvadgj0jx3wnjhgwlvxfsd7829v2p9fjxlqfxd';
const VALIDATOR = 'validator_tdx_2_1sdtnujyn3720ymg8lakydkvc5tw4q3zecdj95akdwt9de362mvtd94';
const LSU = 'resource_tdx_2_1t45l9ku3r5mwxazht2qutmhhk3660hqqvxkkyl8rxs20n9k2zv0w7t';
const CLAIM = 'resource_tdx_2_1ng3g2nj5pfpmdphgz0nrh8z0gtqcxx5z5dn48t85ar0z0zjhefufaw';
const XRD = 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc';
const OWNER_BADGE = 'resource_tdx_2_1nfxxxxxxxxxxvdrwnrxxxxxxxxx004365253834xxxxxxxxxyerzzk';
const KEY = '02951f7415bc6e531917354d5fd2f1821fd77df43ad55f0bd2b8288cf6f97befd3';
const CLAIM_ID = '{1d1f7bfa2ab26d61-99a2a6ad60fbcbc4-a90dcbbf4d3f45f1-8ae1e5c8dbf5b6e4}';

const CTX = {
  account: ACCOUNT,
  xrdAddress: XRD,
  ownerBadgeResource: OWNER_BADGE,
  badgeIdByValidator: { [VALIDATOR]: '[aabb]' },
};

const validate = async (operations: Parameters<typeof buildValidatorBatchManifest>[0]) => {
  const manifest = buildValidatorBatchManifest(operations, CTX);
  const result = await staticallyValidateManifest(manifest, 'stokenet');
  return { manifest, ...result };
};

describe('validator MCP tools', () => {
  const tools = getMcpRegistry().list();
  const names = tools.map((tool) => tool.name);

  it('registers the four validator tools', () => {
    for (const name of [
      'list_validator_operations',
      'get_validator_state',
      'list_claimable_stake_nfts',
      'build_validator_manifest',
    ]) {
      expect(names, name).toContain(name);
    }
  });

  it('accepts every operation the console offers, so the two cannot diverge', () => {
    const builder = tools.find((tool) => tool.name === 'build_validator_manifest');
    const parsed = builder!.inputSchema.safeParse({
      account: ACCOUNT,
      operations: VALIDATOR_OPERATION_KINDS.map((kind) => ({ kind, values: {} })),
      network: 'stokenet',
    });
    expect(parsed.success).toBe(true);
  });

  it('documents them in the generated skill, with the rules the ledger enforces', () => {
    const markdown = generateSkillMarkdown('https://example.test');
    expect(markdown).toContain('### `build_validator_manifest`');
    expect(markdown).toContain('### `list_claimable_stake_nfts`');
    // The two silent failures an agent would otherwise walk into.
    expect(markdown).toContain('register + unregister');
    expect(markdown).toContain('unstake + claim-xrd on the same validator');
    expect(markdown).toContain('create-validator');
  });
});

describe('validator manifests are valid to the Radix Engine Toolkit', () => {
  it('validates a mixed owner batch: register, fee, key, delegation, profile', async () => {
    const target = { validator: VALIDATOR };
    const result = await validate([
      createValidatorOperation('register', target),
      createValidatorOperation('update-fee', { ...target, feeFactor: '0.05' }),
      createValidatorOperation('update-key', { ...target, publicKey: KEY }),
      createValidatorOperation('accept-delegated-stake', { ...target, accept: 'true' }),
      createValidatorOperation('profile', { ...target, name: 'Guepi', infoUrl: 'https://guepi.test' }),
    ]);
    expect(result.valid, result.error).toBe(true);
    // One proof covers every owner call in the transaction.
    expect(result.manifest.match(/create_proof_of_non_fungibles/g)).toHaveLength(1);
  });

  it('validates the funded operations, which move buckets around', async () => {
    const target = { validator: VALIDATOR };
    const result = await validate([
      createValidatorOperation('stake-as-owner', { ...target, amount: '1000' }),
      createValidatorOperation('unstake', { ...target, stakeUnitResource: LSU, amount: '10' }),
      createValidatorOperation('lock-owner-stake-units', {
        ...target,
        stakeUnitResource: LSU,
        amount: '5',
      }),
      createValidatorOperation('start-unlock-owner-stake-units', { ...target, amount: '1' }),
      createValidatorOperation('finish-unlock-owner-stake-units', target),
    ]);
    expect(result.valid, result.error).toBe(true);
  });

  it('validates a claim built from picked NFT ids', async () => {
    const result = await validate([
      createValidatorOperation('claim-xrd', {
        validator: VALIDATOR,
        claimNftResource: CLAIM,
        claimNftIds: CLAIM_ID,
      }),
    ]);
    expect(result.valid, result.error).toBe(true);
    expect(result.manifest).toContain('"withdraw_non_fungibles"');
  });

  it('validates the standalone creation manifest', async () => {
    const result = await validate([
      createValidatorOperation('create-validator', {
        publicKey: KEY,
        feeFactor: '0.05',
        payment: '2000',
      }),
    ]);
    expect(result.valid, result.error).toBe(true);
    expect(result.manifest).toContain('CREATE_VALIDATOR');
  });
});
