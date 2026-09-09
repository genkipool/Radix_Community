/**
 * services/mcp/tools/validator.ts
 *
 * Validator tools: everything the console's validator section can do, exposed
 * to AI clients. MCP cannot sign, so the building tools return a ready
 * manifest plus the console URL where the user signs it with their wallet.
 *
 * The manifests come from the same `validator-operations` module the web forms
 * use, so an agent and the UI cannot drift apart — including the combination
 * rules, which are checked here because an agent, unlike the forms, can ask
 * for any mixture of operations.
 */

import { z } from 'zod';

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
import {
  epochOf,
  nonFungibleHoldingsOf,
  parseClaimNft,
  parseValidatorState,
  sortClaimNfts,
  validatorOfOwnerBadge,
  validatorOfResource,
  type NonFungibleDataItem,
} from '@/features/console/lib/validator-lookup';
import { RADIX_TOKEN_ADDRESSES } from '@/features/wallet/constants/radix-addresses';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { fetchEntityDetails, fetchNonFungibleDataCached } from '@/services/gateway/entities';
import type { Network } from '@/services/gateway/client';
import { defineMcpTool } from '../registry';
import { staticallyValidateManifest } from '@/services/ret';
import { signingSteps } from '../dapp';
import { cliBanner, cliCode, cliKeyValues, cliNext, cliRender, cliSection, cliTable } from '../cli';

const networkSchema = z
  .enum(['mainnet', 'stokenet'])
  .default('mainnet')
  .describe('Radix network: "mainnet" (production) or "stokenet" (testnet)');

const networkIdOf = (network: Network) =>
  network === 'stokenet' ? RadixNetworkId.Stokenet : RadixNetworkId.Mainnet;

/* ─── Owner badges ───────────────────────────────────────────────────────── */

/**
 * validator address → owner badge local id, for every validator the account
 * can act on. The owner-gated calls need this and nothing else: the badge is
 * the authority, so an account that holds none simply cannot run them.
 */
async function ownerBadgesOf(account: string, network: Network) {
  const badgeResource = RADIX_TOKEN_ADDRESSES[networkIdOf(network)].OWNER_BADGE;
  const details = await fetchEntityDetails(account, network);
  const held = nonFungibleHoldingsOf(details).find(
    (holding) => holding.resourceAddress === badgeResource,
  );
  if (!held?.ids.length) return {};

  const data = (await fetchNonFungibleDataCached(
    badgeResource,
    held.ids,
    network,
  )) as unknown as NonFungibleDataItem[];

  return Object.fromEntries(
    data.flatMap((item) => {
      const validator = validatorOfOwnerBadge(item);
      return validator ? [[validator, item.non_fungible_id] as const] : [];
    }),
  );
}

/* ─── Tools ──────────────────────────────────────────────────────────────── */

export const listValidatorOperationsTool = defineMcpTool({
  name: 'list_validator_operations',
  title: 'List validator operations',
  description:
    'Lists every operation a validator supports (register, unregister, change fee, change consensus key, open/close delegation, protocol update vote, public profile metadata, stake, unstake, claim, owner locked stake units, create validator) with whether it needs the owner badge and whether it can share a transaction with the others. Use it before build_validator_manifest.',
  category: 'console',
  inputSchema: z.object({}),
  handler: async () =>
    cliRender(
      cliBanner('Radix validator · operations'),
      VALIDATOR_OPERATION_GROUPS.map((group) =>
        cliTable(
          [`${group.id}`, 'Owner badge', 'Combines', 'Fields'],
          group.kinds.map((kind) => {
            const def = VALIDATOR_OPERATIONS[kind];
            return [
              kind,
              def.ownerOnly ? 'required' : 'no',
              def.combination === 'standalone' ? 'own transaction only' : 'freely',
              def.fields.map((f) => (f.optional ? `${f.key}?` : f.key)).join(', '),
            ];
          }),
        ),
      ).join('\n\n'),
      `${cliSection('Rules the ledger enforces')}
• create-validator travels alone: the address and owner badge it mints do not exist until it commits.
• unstake + claim-xrd on the SAME validator aborts the transaction (EpochUnlockHasNotOccurredYet).
• Contradictory calls (register + unregister, two update-fee) COMMIT, and the last one silently wins.
• apply_emission, apply_reward and get_protocol_update_readiness are engine-only: no manifest can call them.`,
    ),
});

export const getValidatorStateTool = defineMcpTool({
  name: 'get_validator_state',
  title: 'Read validator state',
  description:
    'Reads a validator from the ledger: whether it is registered, whether it accepts delegated stake, its fee factor, consensus public key, and the stake unit (LSU) and claim NFT resources it mints. Use it to know the current state before proposing a change.',
  category: 'console',
  inputSchema: z.object({
    validator: z.string().describe('Validator component address (validator_…)'),
    network: networkSchema,
  }),
  handler: async ({ validator, network }) => {
    const state = parseValidatorState(await fetchEntityDetails(validator, network));
    if (!state) {
      return cliRender(
        cliBanner('Radix validator · state'),
        `${validator} is not a validator on ${network}.`,
      );
    }

    return cliRender(
      cliBanner('Radix validator · state'),
      cliKeyValues([
        ['Address', validator],
        ['Registered', state.isRegistered ? 'yes' : 'no'],
        ['Accepts delegated stake', state.acceptsDelegatedStake ? 'yes' : 'no'],
        ['Fee factor', state.feeFactor],
        ['Consensus public key', state.publicKey],
        ['Stake unit resource', state.stakeUnitResource],
        ['Claim NFT resource', state.claimNftResource],
      ]),
    );
  },
});

export const listClaimableStakeNftsTool = defineMcpTool({
  name: 'list_claimable_stake_nfts',
  title: 'List stake claim NFTs',
  description:
    'Lists the stake claim NFTs an account holds, each attributed to the validator that minted it, with the XRD it redeems for and whether it has matured. Feed the matured ones to build_validator_manifest as a claim-xrd operation.',
  category: 'console',
  inputSchema: z.object({
    account: z.string().describe('Account address (account_…)'),
    network: networkSchema,
  }),
  handler: async ({ account, network }) => {
    const accountDetails = await fetchEntityDetails(account, network);
    const currentEpoch = epochOf(accountDetails);

    const perResource = await Promise.all(
      nonFungibleHoldingsOf(accountDetails).map(async (holding) => {
        const resource = await fetchEntityDetails(holding.resourceAddress, network);
        const validatorAddress = validatorOfResource(resource);
        if (!validatorAddress) return [];

        const [validatorDetails, data] = await Promise.all([
          fetchEntityDetails(validatorAddress, network).catch(() => null),
          fetchNonFungibleDataCached(holding.resourceAddress, holding.ids, network),
        ]);

        return (data as unknown as NonFungibleDataItem[]).map((item) =>
          parseClaimNft(item, {
            resourceAddress: holding.resourceAddress,
            validatorAddress,
            validatorDetails,
            currentEpoch,
          }),
        );
      }),
    );

    const nfts = sortClaimNfts(perResource.flat());
    if (nfts.length === 0) {
      return cliRender(
        cliBanner('Radix validator · stake claims'),
        `${account} holds no stake claim NFTs on ${network}.`,
      );
    }

    return cliRender(
      cliBanner('Radix validator · stake claims'),
      cliTable(
        ['Validator', 'XRD', 'Claim epoch', 'Status', 'Id'],
        nfts.map((nft) => [
          nft.validatorName,
          String(nft.amount),
          String(nft.claimEpoch),
          nft.isClaimable ? 'redeemable' : `waiting (epoch ${currentEpoch})`,
          nft.localId,
        ]),
      ),
      cliKeyValues([
        ['Account', account],
        ['Current epoch', String(currentEpoch)],
      ]),
    );
  },
});

const operationSchema = z.object({
  kind: z
    .enum(VALIDATOR_OPERATION_KINDS as unknown as [ValidatorOperationKind, ...ValidatorOperationKind[]])
    .describe('Operation name, from list_validator_operations'),
  values: z
    .record(z.string(), z.string())
    .describe(
      'Field values for the operation, e.g. { "validator": "validator_…", "feeFactor": "0.05" }. Field names come from list_validator_operations.',
    ),
});

export const buildValidatorManifestTool = defineMcpTool({
  name: 'build_validator_manifest',
  title: 'Build validator manifest',
  description:
    'Builds one transaction manifest out of one or more validator operations, resolving the owner badges the account holds and composing a single proof for all of them. Refuses combinations the ledger would garble. Returns the manifest for the user to sign in their Radix wallet.',
  category: 'console',
  inputSchema: z.object({
    account: z.string().describe('Account that signs, pays the fee and presents the owner badges'),
    operations: z.array(operationSchema).min(1).describe('Operations to combine in one transaction'),
    network: networkSchema,
  }),
  handler: async ({ account, operations, network }, ctx) => {
    const badgeIdByValidator = await ownerBadgesOf(account, network);
    const built: ValidatorOperation[] = operations.map((operation) =>
      createValidatorOperation(operation.kind, operation.values),
    );

    const incomplete = built.filter((operation) => !isOperationComplete(operation));
    const issues = validateValidatorBatch(built, badgeIdByValidator);

    if (incomplete.length || issues.length) {
      return cliRender(
        cliBanner('Radix validator · manifest not built'),
        cliTable(
          ['Problem', 'Operations'],
          [
            ...incomplete.map((operation) => [
              'missing required fields',
              `${operation.kind} (needs ${VALIDATOR_OPERATIONS[operation.kind].fields
                .filter((f) => !f.optional)
                .map((f) => f.key)
                .join(', ')})`,
            ]),
            ...issues.map((issue) => [
              issue.code,
              issue.operationIds
                .map((id) => built.find((operation) => operation.id === id)?.kind ?? id)
                .join(' + '),
            ]),
          ],
        ),
        cliNext([
          'standalone: send create-validator on its own.',
          'exclusive: two operations write the same setting; keep one.',
          'aborts: unstake and claim-xrd on the same validator must be separate transactions.',
          'missing-badge: this account does not hold the validator owner badge.',
        ]),
      );
    }

    const addresses = RADIX_TOKEN_ADDRESSES[networkIdOf(network)];
    const manifest = buildValidatorBatchManifest(built, {
      account,
      xrdAddress: addresses.XRD,
      ownerBadgeResource: addresses.OWNER_BADGE,
      badgeIdByValidator,
    });

    const validation = await staticallyValidateManifest(manifest, network);
    const badgesPresented = new Set(
      built
        .filter((operation) => VALIDATOR_OPERATIONS[operation.kind].ownerOnly)
        .map((operation) => badgeIdByValidator[operation.values.validator])
        .filter(Boolean),
    ).size;

    return cliRender(
      cliBanner('Radix validator · transaction manifest'),
      cliCode(manifest),
      cliKeyValues([
        ['Account', account],
        ['Network', network],
        ['Static validation', validation.valid ? 'VALID' : `INVALID — ${validation.error}`],
        ['Operations', built.map((operation) => operation.kind).join(', ')],
        ['Owner badges presented', String(badgesPresented)],
      ]),
      cliNext(signingSteps(ctx.origin, network, 'en', validation)),
    );
  },
});

export const validatorTools = [
  listValidatorOperationsTool,
  getValidatorStateTool,
  listClaimableStakeNftsTool,
  buildValidatorManifestTool,
];
