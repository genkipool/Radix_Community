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
import { mapHoldings } from '@/features/console/lib/account-holdings';
import { fetchAllHolders, type GatewayPost } from '@/features/console/lib/resource-holders';
import { gatewayPost } from '@/services/gateway/bases';
import { RADIX_TOKEN_ADDRESSES } from '@/features/wallet/constants/radix-addresses';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import {
  fetchEntityDetails,
  fetchEntityDetailsLive,
  fetchNonFungibleDataCached,
} from '@/services/gateway/entities';
import type { Network } from '@/services/gateway/client';
import { getValidatorsCached } from '@/services/gateway/validators';
import type { Validator } from '@/types/radix';
import { defineMcpTool } from '../registry';
import { staticallyValidateManifest } from '@/services/ret';
import { signingSteps } from '../dapp';
import { cliBanner, cliCode, cliKeyValues, cliNext, cliRender, cliSection, cliTable } from '../cli';

/** Largest stakers listed per validator. */
const MAX_STAKERS = 10;

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
  const details = await fetchEntityDetailsLive(account, network);
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

/** Every stake claim NFT the account holds, attributed to the validator that minted it. */
async function fetchClaimNfts(account: string, network: Network) {
  const accountDetails = await fetchEntityDetailsLive(account, network);
  const currentEpoch = epochOf(accountDetails);

  const perResource = await Promise.all(
    nonFungibleHoldingsOf(accountDetails).map(async (holding) => {
      const resource = await fetchEntityDetails(holding.resourceAddress, network);
      const validatorAddress = validatorOfResource(resource);
      if (!validatorAddress) return [];

      const [validatorDetails, data] = await Promise.all([
        fetchEntityDetailsLive(validatorAddress, network).catch(() => null),
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
  return { nfts: sortClaimNfts(perResource.flat()), currentEpoch, accountDetails };
}

const pct = (value: number) => `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} %`;
const xrd = (value: number) => `${value.toLocaleString('en-US', { maximumFractionDigits: 4 })} XRD`;

export const getValidatorStateTool = defineMcpTool({
  name: 'get_validator_state',
  title: 'Read validator info',
  description:
    'Reads one or several validators, the same profile the console\'s "Validator info" section shows: name, website, whether it is registered, in the active set, accepting delegated stake and online, its fee and any pending fee change, total stake with share and rank, uptime, estimated APY, operator stake, delegators, the value of one LSU, its largest stakers (LSU holders with share and XRD value), the stake unit and claim NFT resources, plus warnings (not registered, fee at 100 %, fee going up, node down). With an account, also its position: LSUs and their XRD value, withdrawals ready to claim and those still waiting for their epoch, and whether it owns the validator.',
  category: 'console',
  inputSchema: z.object({
    validator: z
      .union([z.string(), z.array(z.string()).min(1).max(10)])
      .describe('Validator component address (validator_…), or a list of up to 10'),
    account: z.string().optional().describe('Optional account: its stake, pending withdrawals and ownership'),
    network: networkSchema,
  }),
  handler: async ({ validator, account, network }, ctx) => {
    const addresses = [validator].flat();
    const [list, claims] = await Promise.all([
      getValidatorsCached(network).then((r) => (r as { validators: Validator[] }).validators).catch(() => [] as Validator[]),
      account ? fetchClaimNfts(account, network) : null,
    ]);
    const holdings = claims ? mapHoldings(claims.accountDetails as Record<string, unknown>) : null;
    const ownerBadge = RADIX_TOKEN_ADDRESSES[networkIdOf(network)].OWNER_BADGE;
    const ownedIds = holdings?.nonFungibles.find((n) => n.resourceAddress === ownerBadge)?.ids ?? [];
    const owned =
      ownedIds.length > 0
        ? ((await fetchNonFungibleDataCached(ownerBadge, ownedIds, network)) as unknown as NonFungibleDataItem[])
            .map(validatorOfOwnerBadge)
            .filter(Boolean)
        : [];

    const results = await Promise.all(
      addresses.map(async (address) => {
        const details = await fetchEntityDetailsLive(address, network).catch(() => null);
        const state = details ? parseValidatorState(details) : null;
        if (!state) return { address, error: `${address} is not a validator on ${network}.` } as const;
        const v = list.find((entry) => entry.address === address);
        const fee = v?.nominalFee ?? Number(state.feeFactor) * 100;
        const warnings = [
          !state.isRegistered && 'Not registered: it is outside the active set and earns no rewards.',
          !state.acceptsDelegatedStake && 'Closed to delegated stake: only its owner can add stake.',
          fee >= 100 && 'Fee is 100 %: it keeps every reward, stakers earn nothing.',
          v?.hasPendingFeeChange && v.upcomingFee !== undefined && v.upcomingFee > fee && `Fee goes UP to ${v.upcomingFee} % at the next epoch.`,
          v?.onlineStatus === false && 'The node is down: it is missing proposals and rewards.',
        ].filter((w): w is string => !!w);
        const lsu = Number(holdings?.fungibles.find((f) => f.resourceAddress === state.stakeUnitResource)?.amount ?? 0);
        const mine = (claims?.nfts ?? []).filter((n) => n.validatorAddress === address);
        const position = claims
          ? {
              lsu,
              lsuXrd: v && v.lsu2xrdFactor > 0 ? lsu * v.lsu2xrdFactor : null,
              readyXrd: mine.filter((n) => n.isClaimable).reduce((sum, n) => sum + n.amount, 0),
              waiting: mine.filter((n) => !n.isClaimable).map((n) => ({ xrd: n.amount, epoch: n.claimEpoch })),
              owner: owned.includes(address),
            }
          : null;
        // Who holds its LSUs: the largest stakers, with their share and XRD value.
        const post: GatewayPost = (path, body) => gatewayPost(network, path, body);
        const holders = await fetchAllHolders(post, state.stakeUnitResource, { max: MAX_STAKERS }).catch(() => null);
        const lsuSupply = v && v.lsu2xrdFactor > 0 ? v.delegatedStake / v.lsu2xrdFactor : 0;
        const topStakers = (holders?.holders ?? []).slice(0, MAX_STAKERS).map((h) => ({
          address: h.address,
          lsu: Number(h.amount),
          share: lsuSupply > 0 ? Number(h.amount) / lsuSupply : null,
          xrd: v && v.lsu2xrdFactor > 0 ? Number(h.amount) * v.lsu2xrdFactor : null,
        }));
        return { address, state, v, fee, warnings, position, topStakers, stakerCount: holders?.total ?? topStakers.length };
      }),
    );

    const sections = results.map((r) => {
      if ('error' in r) return `${cliSection(r.address)}\n${r.error}`;
      const { state, v, position } = r;
      return cliRender(
        cliSection(v?.name || r.address),
        r.warnings.length > 0 && r.warnings.map((w) => `⚠ ${w}`).join('\n'),
        cliKeyValues([
          ['Address', r.address],
          ...(v?.website ? ([['Website', v.website]] as Array<[string, string]>) : []),
          ['Registered', state.isRegistered ? 'yes' : 'no'],
          ...(v ? ([['Active set', v.status === 'active' ? 'yes' : 'no']] as Array<[string, string]>) : []),
          ['Accepts delegated stake', state.acceptsDelegatedStake ? 'yes' : 'no'],
          ...(v && v.onlineStatus !== null ? ([['Online', v.onlineStatus ? 'yes' : 'no']] as Array<[string, string]>) : []),
          ['Fee', pct(r.fee)],
          ...(v?.hasPendingFeeChange && v.upcomingFee !== undefined ? ([['Pending fee', pct(v.upcomingFee)]] as Array<[string, string]>) : []),
          ...(v
            ? ([
                ['Total stake', `${xrd(v.delegatedStake)} (${pct(v.delegatedStakePercent)} of the network, rank ${v.rank})`],
                ['Uptime', `${pct(v.recentUptime)} last 14 days, ${pct(v.totalUptime)} since Babylon`],
                ['Estimated APY', pct(v.apy)],
                ['Operator stake', xrd(v.ownerDelegation)],
                ['Delegators', String(v.delegators)],
                ['1 LSU', xrd(v.lsu2xrdFactor)],
              ] as Array<[string, string]>)
            : []),
          ['Stake unit resource', state.stakeUnitResource],
          ['Claim NFT resource', state.claimNftResource],
          ['Consensus public key', state.publicKey],
          ...(position
            ? ([
                ['Account LSUs', `${position.lsu}${position.lsuXrd !== null ? ` (≈ ${xrd(position.lsuXrd)})` : ''}`],
                ['Ready to claim', xrd(position.readyXrd)],
                ...position.waiting.map((w): [string, string] => [`Waiting until epoch ${w.epoch}`, xrd(w.xrd)]),
                ['Account owns it', position.owner ? 'yes' : 'no'],
              ] as Array<[string, string]>)
            : []),
        ]),
        r.topStakers.length > 0 &&
          cliTable(
            ['Largest stakers', 'LSU', 'Share', 'XRD'],
            r.topStakers.map((x) => [x.address, String(x.lsu), x.share !== null ? pct(x.share * 100) : '-', x.xrd !== null ? xrd(x.xrd) : '-']),
          ),
      );
    });

    const structuredOf = (r: (typeof results)[number]) =>
      'error' in r
        ? r
        : {
            validator: r.address,
            name: r.v?.name ?? null,
            website: r.v?.website ?? null,
            isRegistered: r.state.isRegistered,
            activeSet: r.v ? r.v.status === 'active' : null,
            acceptsDelegatedStake: r.state.acceptsDelegatedStake,
            online: r.v?.onlineStatus ?? null,
            feePercent: r.fee,
            pendingFeePercent: r.v?.hasPendingFeeChange ? (r.v.upcomingFee ?? null) : null,
            totalStakeXrd: r.v?.delegatedStake ?? null,
            stakePercent: r.v?.delegatedStakePercent ?? null,
            rank: r.v?.rank ?? null,
            uptime14d: r.v?.recentUptime ?? null,
            uptimeTotal: r.v?.totalUptime ?? null,
            apy: r.v?.apy ?? null,
            operatorStakeXrd: r.v?.ownerDelegation ?? null,
            delegators: r.v?.delegators ?? null,
            lsuToXrd: r.v?.lsu2xrdFactor ?? null,
            stakeUnitResource: r.state.stakeUnitResource,
            claimNftResource: r.state.claimNftResource,
            publicKey: r.state.publicKey,
            warnings: r.warnings,
            stakerCount: r.stakerCount,
            topStakers: r.topStakers,
            ...(r.position ? { position: r.position } : {}),
          };

    return {
      text: cliRender(
        cliBanner(addresses.length > 1 ? `Radix validators · ${addresses.length}` : 'Radix validator · info'),
        ...sections,
        cliNext([`Same view in the console (wallet required): ${ctx.origin}/en/console/validator-info?validator=${addresses.join(',')}`]),
      ),
      structured: typeof validator === 'string' ? structuredOf(results[0]) : { validators: results.map(structuredOf) },
    };
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
    const { nfts, currentEpoch } = await fetchClaimNfts(account, network);
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
