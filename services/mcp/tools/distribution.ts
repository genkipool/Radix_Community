/**
 * services/mcp/tools/distribution.ts
 *
 * Distributions: plan a split among a token's holders, pay many accounts in
 * batches, and airdrop through a native AccountLocker. Everything comes from
 * the same modules the console's "Distributions" section uses
 * (resource-holders, bulk-send, locker-manifests, locker-lookup), so the
 * agent and the web build byte-identical transactions.
 *
 * MCP cannot sign: these tools return manifests (one per batch) for the user
 * to sign in order, each statically validated.
 */

import { z } from 'zod';

import { mapHoldings } from '@/features/console/lib/account-holdings';
import {
  DEFAULT_BATCH_SIZE,
  batchRows,
  bulkSendManifest,
  fungibleTotals,
  parseBulkCsv,
  validateBulkRows,
  type BulkIssue,
  type BulkRow,
} from '@/features/console/lib/bulk-send';
import { isPositiveDecimal } from '@/features/console/lib/decimal';
import { claimantsFor, fetchLockerActivity, fetchLockerClaims, fetchWaitingFor, parseLockerState } from '@/features/console/lib/locker-lookup';
import { canWithdraw, heldBadgeFor, ownerRule, type RuleView } from '@/features/console/lib/role-lookup';
import {
  airdropManifest,
  claimFromLockersManifest,
  claimManifest,
  createLockerAndAirdropManifest,
  createLockerManifest,
  recoverAllBatches,
  recoverAllManifest,
  recoverManifest,
} from '@/features/console/lib/locker-manifests';
import {
  distribute,
  distributionToCsv,
  fetchAllHolders,
  filterHolders,
  type GatewayPost,
} from '@/features/console/lib/resource-holders';
import { gatewayPost } from '@/services/gateway/bases';
import { withRetry, type Network } from '@/services/gateway/client';
import { fetchEntityDetailsLive } from '@/services/gateway/entities';
import { fetchKnownAddresses } from '@/services/gateway/knownAddresses';
import { staticallyValidateManifest } from '@/services/ret';
import { cliBanner, cliCode, cliKeyValues, cliList, cliNext, cliRender, cliSection, cliTable } from '../cli';
import { signingSteps } from '../dapp';
import { defineMcpTool } from '../registry';
import { assertAddressOnNetwork } from './console';
import { networkSchema, localeSchema } from './schemas';

const recipientsSchema = z
  .string()
  .max(2_000_000)
  .describe(
    'Recipients, one per line: "account,resource,amount", "account,resource,#nft_id#", or "account,amount" with defaultResource. Comma, semicolon or tab separated; a header line is ignored.',
  );

/**
 * Resources in the list that can never leave an account (withdrawer DenyAll),
 * so the tool says so instead of handing over a manifest that fails.
 */
async function lockedResources(rows: Array<{ resource: string }>, network: Network): Promise<Set<string>> {
  const unique = [...new Set(rows.map((r) => r.resource).filter((r) => r.startsWith('resource_')))];
  const checks = await Promise.all(
    unique.map(async (resource) => {
      const details = await fetchEntityDetailsLive(resource, network).catch(() => null);
      return details && !canWithdraw(details) ? resource : null;
    }),
  );
  return new Set(checks.filter((r): r is string => !!r));
}

/** Recipients whose pending claims are listed per locker (one request each). */
const MAX_LOCKER_RECIPIENTS = 25;

const postFor = (network: Network): GatewayPost => (path, body) => withRetry(() => gatewayPost(network, path, body));

async function holdingsOf(account: string, network: Network) {
  const h = mapHoldings((await fetchEntityDetailsLive(account, network)) as Record<string, unknown>);
  return {
    raw: h,
    sender: {
      fungibles: Object.fromEntries(h.fungibles.map((f) => [f.resourceAddress, f.amount])),
      nonFungibles: Object.fromEntries(h.nonFungibles.map((n) => [n.resourceAddress, n.ids])),
    },
  };
}

const issueLines = (issues: BulkIssue[]) =>
  issues.slice(0, 30).map((i) => `line ${i.line}: ${i.code}${i.detail ? ` (${i.resource ? `${i.resource}: ` : ''}${i.detail})` : ''}`);

/** Validates and renders a list of batch manifests. */
async function renderBatches(
  title: string,
  manifests: Array<{ manifest: string; count: number }>,
  rows: Array<[string, string | number]>,
  network: Network,
  locale: 'en' | 'es',
  origin: string,
  consoleSlug: string,
) {
  const validations = await Promise.all(manifests.map((m) => staticallyValidateManifest(m.manifest.trim(), network)));
  const allValid = validations.every((v) => v.valid);
  const blocks = manifests.map(
    (m, i) =>
      `${cliSection(`Batch ${i + 1} of ${manifests.length} · ${m.count} recipients · ${validations[i].valid ? 'VALID' : `INVALID: ${validations[i].error}`}`)}\n${cliCode(m.manifest.trim())}`,
  );
  return {
    text: cliRender(
      cliBanner(title),
      cliKeyValues([...rows, ['Transactions', manifests.length], ['Network', network]]),
      ...blocks,
      cliNext([
        'Sign the batches ONE AT A TIME, in order, waiting for each to commit (the wallet shows one request at a time).',
        ...signingSteps(origin, network, locale, allValid ? { valid: true } : { valid: false, error: 'see the batch marked INVALID' }),
        `Console form: ${origin}/${locale}/console/${consoleSlug}`,
      ]),
    ),
    structured: {
      network,
      manifests: manifests.map((m, i) => ({ manifest: m.manifest.trim(), recipients: m.count, valid: validations[i].valid })),
      valid: allValid,
    },
  };
}

/* ─── Tools ──────────────────────────────────────────────────────────────── */

export const planHolderDistributionTool = defineMcpTool({
  name: 'plan_holder_distribution',
  title: 'Plan a distribution to holders',
  description:
    'Reads every holder of a token (filters: kinds, minAmount, exclude) and splits an amount of another token among them, equally or pro rata, truncated to its divisibility so the total is never exceeded. Returns the recipients CSV ready for build_locker_manifest (operation "airdrop", recommended) or build_bulk_send_manifests.',
  category: 'console',
  inputSchema: z.object({
    holdersOf: z.string().describe('Resource whose holders receive the distribution'),
    sendResource: z.string().describe('Resource to distribute'),
    total: z.string().describe('Total amount to distribute, decimal string'),
    mode: z.enum(['proportional', 'equal']).default('proportional'),
    kinds: z
      .array(z.enum(['account', 'pool', 'locker', 'validator', 'component', 'other']))
      .default(['account'])
      .describe('Holder kinds to include (default: accounts only; pools and components usually cannot receive airdrops)'),
    minAmount: z.number().nonnegative().optional(),
    exclude: z.array(z.string()).optional().describe('Addresses to leave out (treasury, exchanges, the sender)'),
    network: networkSchema,
  }),
  handler: async ({ holdersOf, sendResource, total, mode, kinds, minAmount, exclude, network }) => {
    assertAddressOnNetwork('holdersOf', holdersOf, network);
    assertAddressOnNetwork('sendResource', sendResource, network);
    if (!isPositiveDecimal(total)) throw new Error(`Invalid total "${total}".`);
    const { holders, total: ledgerTotal, truncated } = await fetchAllHolders(postFor(network), holdersOf);
    const filtered = filterHolders(holders, { kinds, minAmount, exclude });
    const details = (await fetchEntityDetailsLive(sendResource, network)) as { details?: { divisibility?: number } };
    const divisibility = details.details?.divisibility ?? 18;
    const rows = distribute(filtered, total, mode, divisibility);
    const csv = distributionToCsv(rows, sendResource);
    return {
      text: cliRender(
        cliBanner('Distribution plan'),
        cliKeyValues([
          ['Holders of', holdersOf],
          ['Holders read', `${holders.length}${truncated ? ` of ${ledgerTotal} (capped)` : ''}`],
          ['Recipients', rows.length],
          ['Distributing', `${total} of ${sendResource}`],
          ['Mode', mode],
          ['Divisibility', divisibility],
        ]),
        cliTable(['#', 'Account', 'Amount'], rows.slice(0, 50).map((r, i) => [i + 1, r.address, r.amount])),
        rows.length > 50 && `… ${rows.length - 50} more in the CSV.`,
        cliNext([
          'Recommended: create or reuse an AccountLocker and pass this CSV to build_locker_manifest { operation: "airdrop" }: recipients that refuse deposits can claim later.',
          'Alternative: build_bulk_send_manifests with the same CSV (refused deposits come back to the sender).',
        ]),
      ),
      structured: { network, recipients: rows.length, csv, divisibility, truncated },
    };
  },
});

export const buildBulkSendManifestsTool = defineMcpTool({
  name: 'build_bulk_send_manifests',
  title: 'Build bulk transfer manifests',
  description: `Pays many accounts from a CSV list. Checks every line (addresses, network, amounts, NFTs held, total balance per resource) against the live ledger, then splits into transactions of ${DEFAULT_BATCH_SIZE} recipients (the engine caps a transaction at 256 events; new accounts emit several each). Every recipient is paid with try_deposit_or_refund, so an account that refuses the deposit is refunded instead of aborting the batch.`,
  category: 'console',
  inputSchema: z.object({
    account: z.string().describe('Paying account'),
    recipients: recipientsSchema,
    defaultResource: z.string().optional().describe('Resource for two-column lines (account,amount)'),
    network: networkSchema,
    locale: localeSchema,
  }),
  handler: async ({ account, recipients, defaultResource, network, locale }, ctx) => {
    assertAddressOnNetwork('account', account, network);
    const parsed = parseBulkCsv(recipients, defaultResource ?? '');
    const { sender } = await holdingsOf(account, network);
    const issues = [...parsed.issues, ...validateBulkRows(parsed.rows, network, sender, await lockedResources(parsed.rows, network))];
    if (!parsed.rows.length || issues.length) {
      return cliRender(
        cliBanner('Bulk send · not built'),
        parsed.rows.length ? cliList(issueLines(issues)) : 'No recipient lines found.',
        cliNext(['Fix the listed lines and call again. "balance" means the account does not hold enough of that resource.']),
      );
    }
    const manifests = batchRows(parsed.rows).map((rows) => ({ manifest: bulkSendManifest(account, rows), count: rows.length }));
    return renderBatches(
      'Bulk send · transaction manifests',
      manifests,
      [
        ['Account', account],
        ['Recipients', parsed.rows.length],
        ...Object.entries(fungibleTotals(parsed.rows)).map(([r, t]): [string, string] => [`Total ${r}`, t]),
      ],
      network,
      locale,
      ctx.origin,
      'bulk-send',
    );
  },
});

type LockerMetadata = { items?: { key: string; value?: { typed?: { value?: unknown } } }[] };

export const getLockerClaimsTool = defineMcpTool({
  name: 'get_locker_claims',
  title: 'Read AccountLocker info',
  description:
    'Reads one or several AccountLockers, the same profile the console\'s "Locker info" section shows: name, description and link, who owns it, who can store and recover (badge rules, with whether the account holds each badge), whether what it keeps can be taken back before the recipient claims it, the claim link, what it holds and has done, each recipient with what still waits for them, and, with an account, everything waiting in it for that account. Use before building a claim or a recovery, or to tell a recipient whether a locker is safe to leave tokens in.',
  category: 'console',
  inputSchema: z.object({
    locker: z
      .union([z.string(), z.array(z.string()).min(1).max(10)])
      .describe('Locker address (locker_…), or a list of up to 10'),
    account: z.string().optional().describe('Account whose stored tokens to list'),
    network: networkSchema,
  }),
  handler: async ({ locker, account, network }, ctx) => {
    const lockers = [locker].flat();
    const holdings = account ? mapHoldings((await fetchEntityDetailsLive(account, network)) as Record<string, unknown>) : null;
    const rule = (r: RuleView) =>
      r.type === 'resource' ? `badge ${r.resource}` : r.type === 'nonFungible' ? `NFT ${r.resource}:${r.localId}` : r.type;
    const held = (r: RuleView) => (holdings ? (heldBadgeFor(r, holdings.fungibles, holdings.nonFungibles) ? ' (account holds it)' : '') : '');

    const results = await Promise.all(
      lockers.map(async (address) => {
        // One bad address is reported in its own section instead of failing the rest.
        try {
          assertAddressOnNetwork('locker', address, network);
        } catch (error) {
          return { address, error: error instanceof Error ? error.message : String(error) } as const;
        }
        const page = await gatewayPost<{ items: Array<Record<string, unknown> & { explicit_metadata?: LockerMetadata }> }>(
          network,
          '/state/entity/details',
          { addresses: [address], opt_ins: { explicit_metadata: ['name', 'description', 'info_url'] } },
        );
        const entity = page.items[0];
        const state = entity ? parseLockerState(entity) : null;
        if (!state) return { address, error: `${address} is not an AccountLocker on ${network}.` } as const;
        const meta = (key: string) => {
          const value = entity.explicit_metadata?.items?.find((m) => m.key === key)?.value?.typed?.value;
          return typeof value === 'string' ? value : '';
        };
        const [claims, activity] = await Promise.all([
          account ? fetchLockerClaims(postFor(network), address, account) : Promise.resolve([]),
          fetchLockerActivity(postFor(network), address),
        ]);
        // Each recipient and what still waits for them (the first few: one request each).
        const recipients = await Promise.all(
          activity.claimantAccounts.slice(0, MAX_LOCKER_RECIPIENTS).map(async (recipient) => ({
            account: recipient,
            waiting: await fetchLockerClaims(postFor(network), address, recipient).catch(() => []),
          })),
        );
        const details = (entity.details ?? {}) as { package_address?: string; blueprint_name?: string; blueprint_version?: string };
        const recovery =
          state.recoverer.type === 'denyAll'
            ? 'nobody can take back what it keeps'
            : state.recoverer.type === 'allowAll'
              ? 'ANYONE can take what it keeps: claim at once'
              : 'the recoverer can take back what is not claimed';
        return {
          address,
          state,
          name: meta('name'),
          description: meta('description'),
          infoUrl: meta('info_url'),
          ownerUpdatable: ownerRule(entity).updatable,
          recovery,
          claims,
          activity,
          recipients,
          packageAddress: details.package_address ?? '',
          blueprint: [details.blueprint_name, details.blueprint_version].filter(Boolean).join(' '),
          claimUrl: `${ctx.origin}/en/console/locker-claim?locker=${address}`,
        };
      }),
    );

    const sections = results.map((r) => {
      if ('error' in r) return `${cliSection(r.address)}\n${r.error}`;
      return cliRender(
        cliSection(r.name || r.address),
        cliKeyValues([
          ['Locker', r.address],
          ['Package', `${r.packageAddress}${/lckerx/.test(r.packageAddress) ? ' (native Radix package)' : ''}`],
          ['Blueprint', r.blueprint],
          ['Accepts', 'any token or NFT (who can load it is the storer rule)'],
          ...(r.activity.truncated
            ? ([['Held now', `not added up: more than ${r.activity.transactions} transactions`]] as Array<[string, string]>)
            : ([
                [
                  'Held now',
                  [
                    ...Object.entries(r.activity.fungibles).map(([res, amt]) => `${amt} ${res}`),
                    ...Object.entries(r.activity.nonFungibles).map(([res, n]) => `${n} NFT ${res}`),
                  ].join('\n') || 'nothing',
                ],
                [
                  'Activity',
                  `stored for ${r.activity.claimants} accounts, ${r.activity.stores} deposits, ${r.activity.claims} claimed, ${r.activity.recoveries} recovered`,
                ],
              ] as Array<[string, string]>)),
          ...(r.description ? ([['Description', r.description]] as Array<[string, string]>) : []),
          ...(r.infoUrl ? ([['Website', r.infoUrl]] as Array<[string, string]>) : []),
          ['Owner', `${rule(r.state.owner)}${held(r.state.owner)}${r.ownerUpdatable ? '' : ' (fixed)'}`],
          ['Storer (store / airdrop)', `${rule(r.state.storer)}${held(r.state.storer)}`],
          ['Recoverer', `${rule(r.state.recoverer)}${held(r.state.recoverer)}`],
          ['Recovery', r.recovery],
          ['Claim link', r.claimUrl],
          ...(account ? ([['Account', account]] as Array<[string, string]>) : []),
        ]),
        account &&
          (r.claims.length
            ? cliTable(['Resource', 'Waiting'], r.claims.map((c) => [c.resource, c.nftIds ? c.nftIds.join(' ') : c.amount ?? '']))
            : 'Nothing is waiting for this account.'),
        r.recipients.length > 0 &&
          cliTable(
            ['Recipient', 'Still waiting'],
            r.recipients.map((x) => [
              x.account,
              x.waiting.length ? x.waiting.map((c) => (c.nftIds ? `${c.nftIds.length} NFT ${c.resource}` : `${c.amount} ${c.resource}`)).join('\n') : 'all claimed',
            ]),
          ),
        r.activity.claimantAccounts.length > MAX_LOCKER_RECIPIENTS &&
          `And ${r.activity.claimantAccounts.length - MAX_LOCKER_RECIPIENTS} more recipients.`,
      );
    });

    const structuredOf = (r: (typeof results)[number]) =>
      'error' in r
        ? r
        : {
            locker: r.address,
            network,
            name: r.name || null,
            description: r.description || null,
            infoUrl: r.infoUrl || null,
            owner: r.state.owner,
            ownerUpdatable: r.ownerUpdatable,
            storer: r.state.storer,
            recoverer: r.state.recoverer,
            recovery: r.recovery,
            packageAddress: r.packageAddress,
            blueprint: r.blueprint,
            held: r.activity.truncated ? null : { fungibles: r.activity.fungibles, nonFungibles: r.activity.nonFungibles },
            activity: r.activity,
            claimUrl: r.claimUrl,
            ...(holdings
              ? {
                  holdsStorerBadge: !!heldBadgeFor(r.state.storer, holdings.fungibles, holdings.nonFungibles),
                  holdsRecovererBadge: !!heldBadgeFor(r.state.recoverer, holdings.fungibles, holdings.nonFungibles),
                }
              : {}),
            claims: r.claims,
            recipients: r.recipients,
          };

    return {
      text: cliRender(
        cliBanner(lockers.length > 1 ? `Account lockers · ${lockers.length}` : 'Account locker · info'),
        ...sections,
        cliNext([`Same view in the console (wallet required): ${ctx.origin}/en/console/locker-info?locker=${lockers.join(',')}`]),
      ),
      structured: typeof locker === 'string' ? structuredOf(results[0]) : { lockers: results.map(structuredOf) },
    };
  },
});

const LOCKER_OPERATIONS = ['create', 'airdrop', 'recover', 'recoverAll', 'claim'] as const;

export const buildLockerManifestTool = defineMcpTool({
  name: 'build_locker_manifest',
  title: 'Build AccountLocker manifests',
  description: `The right way to airdrop on Radix. Operations: "create" (new AccountLocker; its badge, owner + storer + recoverer, goes to the account; allowRecover decides whether unclaimed tokens can come back; with recipients it also sends the first batch in the same transaction, one signature, and the rest is an "airdrop" on the new locker once it exists), "airdrop" (recipients CSV, one transaction per resource per ${DEFAULT_BATCH_SIZE} recipients; with tryDirectSend accounts that accept deposits get the tokens at once and only refusals stay claimable), "recover" (badge holder takes back what is stored for a claimant), "recoverAll" (badge holder takes back everything still unclaimed by any recipient, in as few transactions as the event limit allows), "claim" (the claimant takes everything waiting for them; only that account can). Badges are resolved from the account. Share the claim page (/{locale}/console/locker-claim?locker=…) with the recipients.`,
  category: 'console',
  inputSchema: z.object({
    operation: z.enum(LOCKER_OPERATIONS),
    account: z.string().describe('Signing account: the badge holder, or the claimant for "claim"'),
    locker: z.string().optional().describe('Locker address (every operation except create)'),
    lockers: z
      .array(z.string())
      .min(1)
      .max(10)
      .optional()
      .describe('claim only: several lockers, everything waiting in all of them claimed in one transaction (instead of "locker")'),
    allowRecover: z.boolean().default(true).describe('create only'),
    recipients: recipientsSchema.optional().describe('airdrop, or create to send the first batch with the creation: the recipients CSV'),
    defaultResource: z.string().optional().describe('airdrop / create with recipients: resource for two-column lines'),
    tryDirectSend: z.boolean().default(true).describe('airdrop / create with recipients: deliver directly when the account accepts'),
    claimant: z.string().optional().describe('recover only: the account the tokens were stored for'),
    resource: z.string().optional().describe('recover only: resource to take back'),
    amount: z.string().optional().describe('recover only: fungible amount'),
    nftIds: z.array(z.string()).optional().describe('recover only: NFT ids'),
    network: networkSchema,
    locale: localeSchema,
  }),
  handler: async (input, ctx) => {
    const { operation, account, network, locale } = input;
    assertAddressOnNetwork('account', account, network);

    if (operation === 'create' && input.recipients?.trim()) {
      const known = await fetchKnownAddresses(network);
      const { sender } = await holdingsOf(account, network);
      const parsed = parseBulkCsv(input.recipients, input.defaultResource ?? '');
      const issues = [...parsed.issues, ...validateBulkRows(parsed.rows, network, sender, await lockedResources(parsed.rows, network))];
      if (!parsed.rows.length || issues.length) {
        return cliRender(
          cliBanner('Locker create + airdrop · not built'),
          parsed.rows.length ? cliList(issueLines(issues)) : 'No recipient lines found.',
        );
      }
      const resources = [...new Set(parsed.rows.map((r: BulkRow) => r.resource))];
      const chunks = resources.flatMap((resource) => batchRows(claimantsFor(parsed.rows, resource)).map((claimants) => ({ resource, claimants })));
      const first = chunks[0];
      const manifest = createLockerAndAirdropManifest({
        account,
        allowRecover: input.allowRecover,
        lockerPackage: known.locker_package ?? '',
        resourcePackage: known.resource_package ?? '',
        resource: first.resource,
        claimants: first.claimants,
        tryDirectSend: input.tryDirectSend,
      });
      return renderBatches(
        'Account locker · create and airdrop',
        [{ manifest, count: first.claimants.length }],
        [
          ['Account', account],
          ['Recovery', input.allowRecover ? 'allowed' : 'never'],
          ['Sent with the creation', `${first.claimants.length} recipients of ${first.resource}`],
          [
            'Still to send',
            chunks.length > 1
              ? `${chunks.length - 1} batches: once this commits, call build_locker_manifest {"operation": "airdrop"} with the new locker address (in the receipt) and the recipients not yet paid`
              : 'nothing, this is the whole airdrop',
          ],
        ],
        network,
        locale,
        ctx.origin,
        'locker-airdrop',
      );
    }

    if (operation === 'create') {
      const known = await fetchKnownAddresses(network);
      const manifest = createLockerManifest({ account, allowRecover: input.allowRecover, lockerPackage: known.locker_package ?? '' });
      return renderBatches(
        'Account locker · create',
        [{ manifest, count: 0 }],
        [['Account', account], ['Recovery', input.allowRecover ? 'allowed' : 'never']],
        network,
        locale,
        ctx.origin,
        'locker-airdrop',
      );
    }

    if (operation === 'claim' && input.lockers?.length) {
      input.lockers.forEach((l) => assertAddressOnNetwork('locker', l, network));
      const found = await Promise.all(
        input.lockers.map(async (l) => ({ locker: l, claims: await fetchLockerClaims(postFor(network), l, account) })),
      );
      const manifest = claimFromLockersManifest({ account, lockers: found });
      if (!manifest) return `Nothing is waiting for ${account} in those lockers.`;
      return renderBatches(
        'Account locker · claim',
        [{ manifest, count: 1 }],
        [
          ['Claimant', account],
          ['Lockers', found.filter((f) => f.claims.length).length],
          ['Resources', found.reduce((n, f) => n + f.claims.length, 0)],
        ],
        network,
        locale,
        ctx.origin,
        `locker-claim?locker=${input.lockers.join(',')}`,
      );
    }

    if (!input.locker) throw new Error(`"${operation}" needs the locker address.`);
    assertAddressOnNetwork('locker', input.locker, network);
    const locker = input.locker;
    const shareLink = `${ctx.origin}/${locale}/console/locker-claim?locker=${locker}`;

    if (operation === 'claim') {
      const claims = await fetchLockerClaims(postFor(network), locker, account);
      if (!claims.length) return `Nothing is waiting for ${account} in ${locker}.`;
      return renderBatches(
        'Account locker · claim',
        [{ manifest: claimManifest({ account, locker, claims }), count: 1 }],
        [['Claimant', account], ['Resources', claims.length]],
        network,
        locale,
        ctx.origin,
        `locker-claim?locker=${locker}`,
      );
    }

    const state = parseLockerState(await fetchEntityDetailsLive(locker, network));
    if (!state) throw new Error(`${locker} is not an AccountLocker on ${network}.`);
    const { raw, sender } = await holdingsOf(account, network);

    if (operation === 'recoverAll') {
      const badge = heldBadgeFor(state.recoverer, raw.fungibles, raw.nonFungibles);
      if (!badge) throw new Error('The account does not hold the locker recovery badge (or the locker does not allow recovery).');
      // Every recipient the locker's history names, and what still waits for each.
      const activity = await fetchLockerActivity(postFor(network), locker);
      const waiting = await fetchWaitingFor(postFor(network), locker, activity.claimantAccounts);
      const items = activity.claimantAccounts
        .map((claimant) => ({ claimant, claims: waiting[claimant] ?? [] }))
        .filter((item) => item.claims.length > 0);
      if (!items.length) return `Nothing is left unclaimed in ${locker}.`;
      const proof = { account, resource: badge.resource, nonFungibleId: badge.localId };
      return renderBatches(
        'Account locker · recover everything',
        recoverAllBatches(items).map((batch) => ({ manifest: recoverAllManifest({ account, locker, badge: proof, items: batch }), count: batch.length })),
        [
          ['Recipients with something unclaimed', items.length],
          ['Recover calls', items.reduce((n, i) => n + i.claims.length, 0)],
          ...(activity.truncated ? ([['Note', `recipients read from the latest ${activity.transactions} transactions only`]] as Array<[string, string]>) : []),
        ],
        network,
        locale,
        ctx.origin,
        'locker-recover',
      );
    }

    if (operation === 'recover') {
      const badge = heldBadgeFor(state.recoverer, raw.fungibles, raw.nonFungibles);
      if (!badge) throw new Error('The account does not hold the locker recovery badge (or the locker does not allow recovery).');
      if (!input.claimant || !input.resource) throw new Error('"recover" needs claimant and resource.');
      if (!input.nftIds?.length && !(input.amount && isPositiveDecimal(input.amount))) {
        throw new Error('"recover" needs a positive amount or nftIds.');
      }
      const manifest = recoverManifest({
        account,
        locker,
        badge: { account, resource: badge.resource, nonFungibleId: badge.localId },
        claimant: input.claimant,
        resource: input.resource,
        amount: input.amount,
        nftIds: input.nftIds,
      });
      return renderBatches('Account locker · recover', [{ manifest, count: 1 }], [['Claimant', input.claimant]], network, locale, ctx.origin, 'locker-recover');
    }

    // airdrop
    const badge = heldBadgeFor(state.storer, raw.fungibles, raw.nonFungibles);
    if (!badge) throw new Error('The account does not hold the locker badge (storer role).');
    const parsed = parseBulkCsv(input.recipients ?? '', input.defaultResource ?? '');
    const issues = [...parsed.issues, ...validateBulkRows(parsed.rows, network, sender, await lockedResources(parsed.rows, network))];
    if (!parsed.rows.length || issues.length) {
      return cliRender(
        cliBanner('Locker airdrop · not built'),
        parsed.rows.length ? cliList(issueLines(issues)) : 'No recipient lines found.',
      );
    }
    const proof = { account, resource: badge.resource, nonFungibleId: badge.localId };
    const resources = [...new Set(parsed.rows.map((r: BulkRow) => r.resource))];
    const manifests = resources.flatMap((resource) =>
      batchRows(claimantsFor(parsed.rows, resource)).map((claimants) => ({
        manifest: airdropManifest({ account, locker, badge: proof, resource, claimants, tryDirectSend: input.tryDirectSend }),
        count: claimants.length,
      })),
    );
    const out = await renderBatches(
      'Locker airdrop · transaction manifests',
      manifests,
      [
        ['Locker', locker],
        ['Recipients', new Set(parsed.rows.map((r) => r.account)).size],
        ['Direct send', input.tryDirectSend ? 'yes, refusals stay claimable' : 'no, everyone claims'],
        ['Claim page for recipients', shareLink],
      ],
      network,
      locale,
      ctx.origin,
      `locker-airdrop?locker=${locker}`,
    );
    return { ...out, structured: { ...out.structured, claimLink: shareLink } };
  },
});

export const distributionTools = [
  planHolderDistributionTool,
  buildBulkSendManifestsTool,
  getLockerClaimsTool,
  buildLockerManifestTool,
];
