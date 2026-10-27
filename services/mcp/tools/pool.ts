/**
 * services/mcp/tools/pool.ts
 *
 * Native pool tools: everything the console's Pools section can do, exposed
 * to AI clients. MCP cannot sign, so the building tool returns a ready
 * manifest plus the console URL where the user signs it with their wallet.
 *
 * The manifests come from the same `pool-manifests` module the web forms use,
 * and the pool is read with the same `pool-lookup` parser, so an agent and the
 * UI cannot drift apart. In particular neither can create a pool whose manager
 * is AllowAll: that pool could be drained by anyone.
 */

import { z } from 'zod';

import { mapHoldings } from '@/features/console/lib/account-holdings';
import { fetchPoolContributions } from '@/features/console/lib/pool-history';
import { fetchAllHolders, type GatewayPost } from '@/features/console/lib/resource-holders';
import { isPositiveDecimal } from '@/features/console/lib/decimal';
import { findGlobalCaller } from '@/features/console/lib/caller-badge';
import { badgeProblems, isXrd, reserveRisks, type BadgeProblem } from '@/features/console/lib/pool-safety';
import { poolFindings } from '@/features/console/lib/pool-security';
import { gatherPoolSecurity } from '@/features/console/lib/security-data';
import { getKnownTokensCached } from '@/services/gateway/knownTokens';
import { heldBadgeFor, isDrainable, metadataTags, parsePoolState, redemptionValue, type PoolRule, type PoolState } from '@/features/console/lib/pool-lookup';
import {
  POOL_BLUEPRINTS,
  POOL_KINDS,
  RETIRED_TAG,
  contributeManifest,
  createPoolManifest,
  managePoolManifest,
  poolProfileManifest,
  poolResourceCount,
  reserveMovesManifest,
  redeemManifest,
  type PoolBadgeProof,
} from '@/features/console/lib/pool-manifests';
import type { Network } from '@/services/gateway/client';
import { fetchEntityDetailsLive } from '@/services/gateway/entities';
import { fetchKnownAddresses } from '@/services/gateway/knownAddresses';
import { gatewayPost } from '@/services/gateway/bases';
import { getKnownPoolsCached } from '@/services/gateway/knownPools';
import { findLedgerEntities, type LedgerEntityKind } from '@/features/console/lib/ledger-entities';
import { staticallyValidateManifest } from '@/services/ret';
import { cliBanner, cliCode, cliKeyValues, cliNext, cliRender, cliSection } from '../cli';
import { callerOf, findingLines, permissionRows, permissionsOut, poolFindingsOut, ruleText } from '../security';
import { signingSteps } from '../dapp';
import { defineMcpTool } from '../registry';
import { assertAddressOnNetwork } from './console';
import { networkSchema, localeSchema } from './schemas';

async function readPool(pool: string, network: Network): Promise<PoolState> {
  const state = parsePoolState(await fetchEntityDetailsLive(pool, network));
  if (!state) throw new Error(`${pool} is not a native pool on ${network}.`);
  return state;
}

const BADGE_PROBLEMS: Record<BadgeProblem, string> = {
  xrd: 'XRD cannot guard a pool: every account holds some, so anyone could drain it.',
  notHeld: 'the account does not hold it, so the pool would belong to whoever does.',
  sharedSupply: 'other accounts hold part of its supply, and any of them could drain the pool. The account must hold the whole supply.',
  mintable: 'it can still be minted, so whoever can mint it could become a manager and drain the pool.',
};

/** Warnings for reserve tokens whose issuer can recall or freeze them. */
async function reserveNotes(resources: string[], network: Network): Promise<Array<[string, string]>> {
  const details = await Promise.all(resources.map((r) => fetchEntityDetailsLive(r, network).catch(() => null)));
  return resources.flatMap((resource, i) =>
    reserveRisks(details[i]).map((risk): [string, string] => [
      '⚠ Reserve risk',
      `${resource}: its issuer can ${risk === 'recallable' ? 'recall it from' : 'freeze it in'} the pool's vaults`,
    ]),
  );
}

/** The proof an account can present for a rule, or null. */
async function proofFor(account: string, rule: PoolRule, network: Network): Promise<PoolBadgeProof | null> {
  const holdings = mapHoldings((await fetchEntityDetailsLive(account, network)) as Record<string, unknown>);
  const badge = heldBadgeFor(rule, holdings.fungibles, holdings.nonFungibles);
  return badge ? { account, resource: badge.resource, nonFungibleId: badge.localId } : null;
}

const consoleUrl = (origin: string, locale: string, slug: string, pool?: string) =>
  `${origin}/${locale}/console/${slug}${pool ? `?pool=${pool}` : ''}`;

/* ─── Tools ──────────────────────────────────────────────────────────────── */

/** One address or several, for the read-only "info" tools. */
const oneOrMany = (what: string) =>
  z
    .union([z.string(), z.array(z.string()).min(1).max(10)])
    .describe(`${what} address, or a list of up to 10 to read them all at once`);

type ProfileMetadata = { items?: { key: string; value?: { typed?: { value?: unknown } } }[] };

/** name / description / icon_url / info_url of several entities, in one request. */
async function readProfiles(addresses: string[], network: Network) {
  const data = await gatewayPost<{ items: { address: string; explicit_metadata?: ProfileMetadata }[] }>(
    network,
    '/state/entity/details',
    { addresses, opt_ins: { explicit_metadata: ['name', 'description', 'icon_url', 'info_url'] } },
  );
  const read = (list: ProfileMetadata | undefined, key: string) => {
    const value = list?.items?.find((m) => m.key === key)?.value?.typed?.value;
    return typeof value === 'string' ? value : '';
  };
  return Object.fromEntries(
    data.items.map((i) => [
      i.address,
      {
        name: read(i.explicit_metadata, 'name'),
        description: read(i.explicit_metadata, 'description'),
        infoUrl: read(i.explicit_metadata, 'info_url'),
      },
    ]),
  );
}

/** Largest participants listed per pool. */
const MAX_PARTICIPANTS = 10;

const fmtUnits = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 8 });

export const getPoolStateTool = defineMcpTool({
  name: 'get_pool_state',
  title: 'Read native pool info',
  description:
    'Reads one or several native Radix pools (OneResourcePool, TwoResourcePool, MultiResourcePool), the same profile the console\'s "Pool info" section shows: name, description and link, whether it is retired, resources, reserves, pool unit and its supply, what one unit is worth, who holds the manager and owner roles, and its largest participants (units, share, what each put in and took out, from the pool\'s history). Includes the console\'s security analysis (findings worst first: AllowAll or XRD manager, a badge that can be minted or has several units, reserve tokens that imitate a known token or that their issuer can recall, freeze or restrict, whether the managing component belongs to a verified dApp and who controls it, reserves moved by a manager badge, whether the profile can change) and every role of the pool with whether it can change. These check permissions, not code. Flags pools whose manager role is AllowAll: anyone can drain those with protected_withdraw. With an account, also its position (units, share of the pool, what redeeming would return, what it put in and took out, and the result) and whether it holds the manager / owner badge. Use it before build_pool_manifest.',
  category: 'console',
  inputSchema: z.object({
    pool: oneOrMany('Pool component (pool_…)'),
    account: z.string().optional().describe('Optional account: its position and badge ownership'),
    network: networkSchema,
  }),
  handler: async ({ pool, account, network }, ctx) => {
    const pools = [pool].flat();
    if (account) assertAddressOnNetwork('account', account, network);
    const holdings = account ? mapHoldings((await fetchEntityDetailsLive(account, network)) as Record<string, unknown>) : null;

    const read = async (address: string) => {
      // One bad address is reported in its own section instead of failing the rest.
      try {
        assertAddressOnNetwork('pool', address, network);
      } catch (error) {
        return { address, error: error instanceof Error ? error.message : String(error) } as const;
      }
      const details = await fetchEntityDetailsLive(address, network).catch(() => null);
      const state = details ? parsePoolState(details) : null;
      if (!state) return { address, error: `${address} is not a native pool on ${network}.` } as const;
      const post: GatewayPost = (path, body) => gatewayPost(network, path, body);
      const [unitDetails, profiles, holders, history, callers, knownTokens] = await Promise.all([
        fetchEntityDetailsLive(state.poolUnit, network),
        readProfiles([address, state.poolUnit], network).catch(() => ({}) as Awaited<ReturnType<typeof readProfiles>>),
        fetchAllHolders(post, state.poolUnit, { max: MAX_PARTICIPANTS }).catch(() => null),
        fetchPoolContributions(post, state).catch(() => null),
        findGlobalCaller(post, address, [state.manager, state.owner]).catch(() => ({}) as Record<string, string>),
        getKnownTokensCached(network).catch(() => ({})),
      ]);
      const supply = Number((unitDetails as { details?: { total_supply?: string } } | null)?.details?.total_supply ?? 0);
      // The same analysis the console's pool card shows.
      const largest = holders?.holders[0];
      const findings = poolFindingsOut(
        poolFindings(
          await gatherPoolSecurity(post, state, {
            callers,
            knownTokens,
            managerMoves: history?.managerMoves,
            topShare: largest && supply > 0 ? Number(largest.amount) / supply : null,
          }),
        ),
      );
      const profile = profiles[address]?.name ? profiles[address] : profiles[state.poolUnit];
      const unitValue = supply > 0
        ? Object.fromEntries(state.resources.map((r) => [r, Number(state.reserves[r] ?? 0) / supply]))
        : {};
      const heldUnits = Number(holdings?.fungibles.find((f) => f.resourceAddress === state.poolUnit)?.amount ?? 0);
      const position =
        holdings && heldUnits > 0 && supply > 0
          ? { units: heldUnits, share: heldUnits / supply, redeemsFor: redemptionValue(state.reserves, heldUnits, supply) }
          : null;
      const holds = (rule: PoolRule) => (holdings ? !!heldBadgeFor(rule, holdings.fungibles, holdings.nonFungibles) : undefined);
      const flowsOf = (who: string) => history?.byAccount[who] ?? { putIn: {}, takenOut: {} };
      const participants = (holders?.holders ?? []).slice(0, MAX_PARTICIPANTS).map((h) => ({
        address: h.address,
        units: Number(h.amount),
        share: supply > 0 ? Number(h.amount) / supply : 0,
        ...flowsOf(h.address),
      }));
      // What the account's position earned or lost: worth now + taken out - put in.
      const flows = account ? flowsOf(account) : null;
      const result =
        flows && position
          ? Object.fromEntries(
              state.resources.map((r) => [r, (position.redeemsFor[r] ?? 0) + Number(flows.takenOut[r] ?? 0) - Number(flows.putIn[r] ?? 0)]),
            )
          : null;
      return {
        address,
        state,
        supply,
        profile,
        unitValue,
        position,
        flows,
        result,
        participants,
        participantCount: holders?.total ?? participants.length,
        historyTruncated: history?.truncated ?? false,
        holdsManager: holds(state.manager),
        holdsOwner: holds(state.owner),
        findings,
        callers,
      };
    };
    const results = await Promise.all(pools.map(read));

    const sections = results.map((r) => {
      if ('error' in r) return `${cliSection(r.address)}\n${r.error}`;
      const { state } = r;
      const drainable = isDrainable(state);
      return cliRender(
        cliSection(r.profile?.name || state.address),
        drainable &&
          `⚠ DRAINABLE: the manager role is AllowAll, so ANY account can call protected_withdraw and take the reserves. The owner role ${state.ownerUpdatable ? 'can still be changed' : 'is fixed, so this cannot be repaired'}. Tell the user to redeem their pool units now and move to a new pool guarded by a badge.`,
        `Security (permissions, not code):\n${findingLines(r.findings)}`,
        cliKeyValues([
          ['Pool', state.address],
          ['Type', POOL_BLUEPRINTS[state.kind]],
          ...(state.tags.includes(RETIRED_TAG) ? ([['Status', 'retired by its owner']] as Array<[string, string]>) : []),
          ...(r.profile?.description ? ([['Description', r.profile.description]] as Array<[string, string]>) : []),
          ...(r.profile?.infoUrl ? ([['Website', r.profile.infoUrl]] as Array<[string, string]>) : []),
          ...state.resources.map((res): [string, string] => [`Reserve ${res}`, state.reserves[res] ?? '0']),
          ['Pool unit', state.poolUnit],
          ['Pool unit supply', fmtUnits(r.supply)],
          ...Object.entries(r.unitValue).map(([res, v]): [string, string] => [`1 unit ≈ ${res}`, fmtUnits(v)]),
          ['Manager role', ruleText(state.manager, r.callers)],
          ['Owner role', `${ruleText(state.owner, r.callers)}${state.ownerUpdatable ? '' : ' (fixed)'}`],
          ...(account
            ? ([
                ['Account units', fmtUnits(r.position?.units ?? 0)],
                ...(r.position
                  ? ([
                      ['Share of the pool', `${fmtUnits(r.position.share * 100)} %`],
                      ...Object.entries(r.position.redeemsFor).map(([res, v]): [string, string] => [`Redeems for ${res}`, fmtUnits(v)]),
                    ] as Array<[string, string]>)
                  : []),
                ...(r.flows
                  ? ([
                      ...Object.entries(r.flows.putIn).map(([res, v]): [string, string] => [`Put in ${res}`, v]),
                      ...Object.entries(r.flows.takenOut).map(([res, v]): [string, string] => [`Taken out ${res}`, v]),
                      ...Object.entries(r.result ?? {}).map(([res, v]): [string, string] => [`Result ${res}`, `${v > 0 ? '+' : ''}${fmtUnits(v)}`]),
                    ] as Array<[string, string]>)
                  : []),
                ['Holds manager badge', r.holdsManager ? 'yes' : 'no'],
                ['Holds owner badge', r.holdsOwner ? 'yes' : 'no'],
              ] as Array<[string, string]>)
            : []),
        ]),
        `Permissions:\n${cliKeyValues(permissionRows(state.roles, r.callers))}`,
        r.participants.length > 0 &&
          cliKeyValues([
            ['Participants', `${r.participantCount} (largest ${r.participants.length})`],
            ...r.participants.map((p): [string, string] => [p.address, `${fmtUnits(p.units)} units · ${fmtUnits(p.share * 100)} %`]),
          ]),
        r.historyTruncated && 'Put in / taken out cover the pool\'s latest 500 transactions only.',
      );
    });

    const structuredOf = (r: (typeof results)[number]) =>
      'error' in r
        ? r
        : {
            pool: r.state.address,
            name: r.profile?.name || null,
            description: r.profile?.description || null,
            infoUrl: r.profile?.infoUrl || null,
            kind: r.state.kind,
            resources: r.state.resources,
            reserves: r.state.reserves,
            poolUnit: r.state.poolUnit,
            poolUnitSupply: r.supply,
            unitValue: r.unitValue,
            manager: r.state.manager,
            owner: r.state.owner,
            managerCaller: callerOf(r.state.manager, r.callers),
            ownerCaller: callerOf(r.state.owner, r.callers),
            ownerUpdatable: r.state.ownerUpdatable,
            drainable: isDrainable(r.state) || r.findings.some((f) => f.id === 'xrdBadge'),
            findings: r.findings,
            permissions: permissionsOut(r.state.roles, r.callers),
            retired: r.state.tags.includes(RETIRED_TAG),
            participantCount: r.participantCount,
            participants: r.participants,
            historyTruncated: r.historyTruncated,
            ...(account
              ? { position: r.position, flows: r.flows, result: r.result, holdsManagerBadge: r.holdsManager, holdsOwnerBadge: r.holdsOwner }
              : {}),
          };

    return {
      text: cliRender(
        cliBanner(pools.length > 1 ? `Radix pools · ${pools.length}` : 'Radix pool · info'),
        ...sections,
        cliNext([`Same view in the console (wallet required): ${consoleUrl(ctx.origin, 'en', 'pool-info')}?pool=${pools.join(',')}`]),
      ),
      structured: typeof pool === 'string' ? structuredOf(results[0]) : { pools: results.map(structuredOf) },
    };
  },
});

const OPERATIONS = ['create', 'contribute', 'deposit', 'withdraw', 'redeem', 'profile', 'manage'] as const;

export const buildPoolManifestTool = defineMcpTool({
  name: 'build_pool_manifest',
  title: 'Build native pool manifest',
  description:
    'Builds one native pool transaction. Operations: "create" (new pool, ALWAYS guarded by a manager badge: a fresh badge minted in the same transaction, or managerBadge; poolProfile and the badge fields are written in the same transaction), "contribute" (add liquidity, needs the manager badge), "deposit" / "withdraw" (move reserves without minting/burning units, need the manager badge), "redeem" (burn pool units, public), "profile" (metadata of the pool and its pool unit, needs the owner badge), "manage" (retire a pool in one transaction with any of emptyReserves / markRetired / freezeProfile; freezing is IRREVERSIBLE: confirm with the user first). Badges are resolved from the account automatically. Returns the manifest for the user to sign.',
  category: 'console',
  inputSchema: z.object({
    operation: z.enum(OPERATIONS).describe('What to do'),
    account: z.string().describe('Account that signs, pays and presents the badges'),
    pool: z.string().optional().describe('Pool address (every operation except create)'),
    kind: z.enum(POOL_KINDS).optional().describe('create only: "one", "two" or "multi" resources'),
    resources: z.array(z.string()).optional().describe('create only: resource addresses the pool holds'),
    managerBadge: z
      .string()
      .optional()
      .describe('create only: guard the pool with this badge resource instead of minting a new one'),
    badgeName: z.string().max(60).optional().describe('create only: name of the new manager badge'),
    badgeSymbol: z.string().max(12).optional().describe('create only: symbol of the new manager badge'),
    badgeDescription: z.string().max(200).optional().describe('create only: description of the new manager badge'),
    badgeIconUrl: z.string().optional().describe('create only: icon URL of the new manager badge'),
    amounts: z
      .record(z.string(), z.string())
      .optional()
      .describe('contribute: { resource: amount } for EVERY pool resource. deposit/withdraw: one or more entries, all moved in one transaction.'),
    units: z.string().optional().describe('redeem only: pool units to burn'),
    poolProfile: z
      .object({ name: z.string(), description: z.string(), iconUrl: z.string(), infoUrl: z.string() })
      .partial()
      .optional()
      .describe(
        'profile, or create (written in the same transaction): pool metadata (blank fields are not written). The pool unit cannot be named at creation: its address does not exist until then; use "profile" afterwards.',
      ),
    unitProfile: z
      .object({ name: z.string(), symbol: z.string(), description: z.string(), iconUrl: z.string(), infoUrl: z.string() })
      .partial()
      .optional()
      .describe('profile only: pool unit metadata to write'),
    emptyReserves: z
      .boolean()
      .optional()
      .describe('manage: take every reserve out to the account (manager badge). Burns no units: other holders are left with nothing to redeem.'),
    markRetired: z
      .boolean()
      .optional()
      .describe('manage: add the "retired" tag to the pool and its pool unit, keeping their current tags (owner badge)'),
    freezeProfile: z
      .boolean()
      .optional()
      .describe(
        'manage: lock the profile metadata keys and the owner role of the pool and its unit FOR GOOD (owner badge). Irreversible. The manager role of a native pool cannot be locked.',
      ),
    network: networkSchema,
    locale: localeSchema,
  }),
  handler: async (input, ctx) => {
    const { operation, account, network, locale } = input;
    assertAddressOnNetwork('account', account, network);

    let manifest = '';
    let slug = 'pool-create';
    let pool: PoolState | null = null;
    const notes: Array<[string, string]> = [['Operation', operation]];

    if (operation === 'create') {
      const kind = input.kind ?? 'two';
      const resources = input.resources ?? [];
      if (!poolResourceCount(kind, resources.length)) {
        throw new Error('A "one" pool takes 1 resource, "two" exactly 2, "multi" at least 2.');
      }
      if (new Set(resources).size !== resources.length) throw new Error('A resource is repeated.');
      resources.forEach((r) => assertAddressOnNetwork('resource', r, network));
      if (input.managerBadge) {
        assertAddressOnNetwork('managerBadge', input.managerBadge, network);
        // The rule accepts any amount of the resource: it must be this account's alone.
        if (isXrd(input.managerBadge)) throw new Error(`${input.managerBadge} cannot guard the pool: ${BADGE_PROBLEMS.xrd} Omit managerBadge to mint a fresh badge instead.`);
        const [badgeDetails, accountDetails] = await Promise.all([
          fetchEntityDetailsLive(input.managerBadge, network),
          fetchEntityDetailsLive(account, network),
        ]);
        const holdings = mapHoldings((accountDetails ?? {}) as Record<string, unknown>);
        const problems = badgeProblems({ resource: input.managerBadge, details: badgeDetails, ...holdings });
        if (problems.length) {
          throw new Error(`${input.managerBadge} cannot guard the pool: ${BADGE_PROBLEMS[problems[0]]} Omit managerBadge to mint a fresh badge instead.`);
        }
      }
      const known = await fetchKnownAddresses(network);
      manifest = createPoolManifest({
        account,
        kind,
        resources,
        manager: input.managerBadge
          ? { mode: 'existingBadge', resource: input.managerBadge }
          : {
              mode: 'newBadge',
              badgeName: input.badgeName?.trim() || 'Pool manager',
              badgeSymbol: input.badgeSymbol,
              badgeDescription: input.badgeDescription,
              badgeIconUrl: input.badgeIconUrl,
            },
        packages: { pool: known.pool_package ?? '', resource: known.resource_package ?? '' },
        profile: input.poolProfile,
      });
      if (input.poolProfile && Object.values(input.poolProfile).some((v) => v?.trim())) {
        notes.push(['Pool profile', 'written in this transaction; name the pool unit afterwards with "profile"']);
      }
      notes.push(['Manager / owner', input.managerBadge ? `badge ${input.managerBadge}` : 'new badge, minted to the account']);
      notes.push(...(await reserveNotes(resources, network)));
    } else {
      if (!input.pool) throw new Error(`"${operation}" needs the pool address.`);
      assertAddressOnNetwork('pool', input.pool, network);
      pool = await readPool(input.pool, network);
      notes.push(['Pool', pool.address]);
      const drainable = isDrainable(pool);

      if (operation === 'redeem') {
        slug = 'pool-redeem';
        if (!input.units || !isPositiveDecimal(input.units)) throw new Error('"redeem" needs a positive "units".');
        manifest = redeemManifest({ account, pool: pool.address, poolUnit: pool.poolUnit, amount: input.units });
      } else if (operation === 'manage') {
        slug = 'pool-manage';
        const { emptyReserves, markRetired, freezeProfile } = input;
        if (!emptyReserves && !markRetired && !freezeProfile) {
          throw new Error('"manage" needs at least one of emptyReserves, markRetired, freezeProfile.');
        }
        const manager = emptyReserves ? await proofFor(account, pool.manager, network) : null;
        if (emptyReserves && !manager && !drainable) throw new Error('The account does not hold the pool manager badge.');
        if (emptyReserves && !Object.values(pool.reserves).some((a) => Number(a) > 0)) throw new Error('The pool is already empty.');
        const needsOwner = markRetired || freezeProfile;
        const owner = needsOwner ? await proofFor(account, pool.owner, network) : null;
        if (needsOwner && !owner && pool.owner.type !== 'allowAll') throw new Error('The account does not hold the pool owner badge.');
        if (markRetired && pool.tags.includes(RETIRED_TAG)) throw new Error('The pool is already marked as retired.');
        if (freezeProfile && !pool.ownerUpdatable) throw new Error("The pool's owner is already locked.");
        const unitTags = markRetired ? metadataTags(await fetchEntityDetailsLive(pool.poolUnit, network)) : [];
        manifest = managePoolManifest({
          account,
          pool: pool.address,
          kind: pool.kind,
          poolUnit: pool.poolUnit,
          reserves: pool.reserves,
          manager,
          owner,
          empty: emptyReserves,
          retire: markRetired ? { poolTags: pool.tags, unitTags } : undefined,
          lockOwner: freezeProfile,
        });
        if (emptyReserves) notes.push(['Empties', Object.entries(pool.reserves).filter(([, a]) => Number(a) > 0).map(([r, a]) => `${a} ${r}`).join(', ')]);
        if (markRetired) notes.push(['Tags', `adds "${RETIRED_TAG}" to the pool and its unit`]);
        if (freezeProfile) notes.push(['⚠ Irreversible', 'locks the profile and owner role of the pool and its unit for good']);
      } else if (operation === 'profile') {
        slug = 'pool-profile';
        const owner = await proofFor(account, pool.owner, network);
        if (!owner && pool.owner.type !== 'allowAll') throw new Error('The account does not hold the pool owner badge.');
        manifest = poolProfileManifest({
          owner,
          pool: pool.address,
          poolUnit: pool.poolUnit,
          poolFields: input.poolProfile ?? {},
          unitFields: input.unitProfile ?? {},
        });
        if (!manifest) throw new Error('"profile" needs at least one field in poolProfile or unitProfile.');
      } else {
        const manager = await proofFor(account, pool.manager, network);
        if (!manager && !drainable) throw new Error('The account does not hold the pool manager badge.');
        const amounts = Object.entries(input.amounts ?? {});
        for (const [resource, amount] of amounts) {
          if (!pool.resources.includes(resource)) throw new Error(`${resource} is not one of the pool's resources.`);
          if (!isPositiveDecimal(amount)) throw new Error(`Invalid amount "${amount}".`);
        }
        if (operation === 'contribute') {
          slug = 'pool-contribute';
          if (amounts.length !== pool.resources.length) {
            throw new Error(`"contribute" needs an amount for every pool resource: ${pool.resources.join(', ')}.`);
          }
          manifest = contributeManifest({
            account,
            pool: pool.address,
            kind: pool.kind,
            contributions: pool.resources.map((resource) => ({ resource, amount: input.amounts![resource] })),
            manager,
          });
        } else {
          slug = 'pool-reserves';
          if (amounts.length === 0) throw new Error(`"${operation}" needs at least one resource in "amounts".`);
          // Every resource given moves in the same transaction, under one badge proof.
          manifest = reserveMovesManifest({
            account,
            pool: pool.address,
            kind: pool.kind,
            direction: operation,
            moves: amounts.map(([resource, amount]) => ({ resource, amount })),
            manager,
          });
        }
      }
      if (drainable) notes.push(['⚠ Warning', 'this pool is DRAINABLE (manager AllowAll)']);
    }

    manifest = manifest.trim();
    const validation = await staticallyValidateManifest(manifest, network);
    return {
      text: cliRender(
        cliBanner(`Radix pool · ${operation}`),
        cliCode(manifest),
        cliKeyValues([
          ...notes,
          ['Account', account],
          ['Network', network],
          ['Static validation', validation.valid ? 'VALID' : `INVALID: ${validation.error}`],
        ]),
        cliNext([
          ...signingSteps(ctx.origin, network, locale, validation),
          `Console form for this operation: ${consoleUrl(ctx.origin, locale, slug, pool?.address)}`,
        ]),
      ),
      structured: { manifest, network, operation, valid: validation.valid, pool: pool?.address ?? null },
    };
  },
});

export const findPoolsTool = defineMcpTool({
  name: 'find_pools',
  title: 'Find native pools and lockers',
  description:
    'Finds native pools (pool_…) and Account Lockers (locker_…) by name or address, from the same sources as the console pickers: the ones the given accounts have touched, the native pools Ociswap, DefiPlaza and Reddicks publish (mainnet only, largest first) and pools with recent network activity. No API lists every pool or locker on Radix, so a missing one can still be used by address. Use it to resolve "the XRD/HUG pool" into an address before get_pool_state.',
  category: 'console',
  inputSchema: z.object({
    query: z.string().optional().describe('Text to match against the name or the address (case insensitive)'),
    kind: z.enum(['pool', 'locker', 'both']).default('pool').describe('What to look for'),
    accounts: z.array(z.string()).max(10).optional().describe('Accounts whose recent transactions are searched too'),
    limit: z.number().int().min(1).max(100).default(25).describe('Maximum results'),
    network: networkSchema,
  }),
  handler: async ({ query, kind, accounts = [], limit, network }) => {
    accounts.forEach((a) => assertAddressOnNetwork('account', a, network));
    const kinds: LedgerEntityKind[] = kind === 'both' ? ['pool', 'locker'] : [kind];
    const [ledger, known] = await Promise.all([
      findLedgerEntities((path, body) => gatewayPost(network, path, body), { accounts, kinds }),
      kinds.includes('pool') ? getKnownPoolsCached(network).catch(() => []) : Promise.resolve([]),
    ]);

    const rows: { address: string; name: string; source: string }[] = [];
    const add = (address: string, name: string, source: string) => {
      if (!rows.some((r) => r.address === address)) rows.push({ address, name, source });
    };
    ledger.filter((e) => e.mine).forEach((e) => add(e.address, e.name, 'your accounts'));
    known.forEach((p) => add(p.address, p.name, p.source));
    ledger.filter((e) => !e.mine).forEach((e) => add(e.address, e.name, 'recent network activity'));

    const q = query?.trim().toLowerCase();
    const matches = q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.address.toLowerCase().includes(q)) : rows;
    const shown = matches.slice(0, limit);

    return {
      text: cliRender(
        cliBanner('Radix pools · search'),
        shown.length
          ? cliKeyValues(shown.map((r): [string, string] => [r.name || '(unnamed)', `${r.address}  [${r.source}]`]))
          : 'Nothing found. A pool or locker that is not listed can still be used by its address.',
        matches.length > shown.length && `${matches.length - shown.length} more: narrow the query or raise the limit.`,
        cliNext(['get_pool_state {"pool": "pool_…"} to read one']),
      ),
      structured: { results: shown, total: matches.length },
    };
  },
});

export const poolTools = [getPoolStateTool, buildPoolManifestTool, findPoolsTool];
