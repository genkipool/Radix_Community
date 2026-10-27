'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Archive, ArrowDownToLine, ArrowUpFromLine, Scale, Tags } from 'lucide-react';

import { useLanguage } from '@/context/LanguageContext';
import { dashboardRoutes } from '@/features/dashboard/lib/routes';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { gatewayPost } from '@/services/gateway/bases';
import { truncateAddress } from '@/utils/formatters';
import { useAccountResources } from '../../hooks/useAccountResources';
import { useConsoleQueryState } from '../../hooks/useConsoleQueryState';
import { usePoolContributions } from '../../hooks/usePoolContributions';
import { useDexListing, useUnitValueChanges } from '../../hooks/useDexPools';
import { usePoolSecurity } from '../../hooks/usePoolSecurity';
import { useNetworkSelection } from '../../hooks/useNetworkSelection';
import { useResourceLabels } from '../../hooks/useResourceLabels';
import { useTopHolders } from '../../hooks/useTopHolders';
import { heldBadgeFor, isDrainable, isGlobalCallerBadge, isPackageCallerBadge, parsePoolState, redemptionValue } from '../../lib/pool-lookup';
import { RETIRED_TAG } from '../../lib/pool-manifests';
import { findGlobalCaller, packageOfCallerRule } from '../../lib/caller-badge';
import type { RuleView } from '../../lib/role-lookup';
import type { ConsoleDictionary } from '../../types/i18n.types';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { AccountPicker } from '../shared/AccountPicker';
import { AddressLine, CardSkeleton, CopyLine, cardError, EntityCard, EntityCardMessage, Facts, Heading, Note, RuleSummary, Sub, badgeNamer, fmtNumber, shortId } from '../shared/InfoParts';
import { MultiAddressSelect, addressesFromUrl } from '../shared/MultiAddressSelect';
import { PoolSecurity } from '../pool/PoolSecurity';
import { EntityPermissions } from '../shared/EntityPermissions';
import { RoleBadges } from '../shared/RoleBadges';
import { ToolSection } from '../shared/ToolSection';
import { TopHoldersList } from '../shared/TopHoldersList';
import { accountFromQuery, toolQuery } from '../../lib/console-query';

type MetadataList = { items?: { key: string; value?: { typed?: { value?: unknown } } }[] };

const readProfile = (list?: MetadataList) => {
  const read = (key: string) => {
    const value = list?.items?.find((m) => m.key === key)?.value?.typed?.value;
    return typeof value === 'string' ? value : '';
  };
  return { name: read('name'), description: read('description'), iconUrl: read('icon_url'), infoUrl: read('info_url') };
};

/** Amounts with thousands separators and at most four decimals; the exact figure is in the tooltip. */
/** Periods the yield section looks back over, in days. */
const YIELD_PERIODS = [7, 30];

const amount = (value: string | number) =>
  Number(value).toLocaleString(undefined, { maximumFractionDigits: Number(value) >= 1 ? 4 : 8 });

/**
 * Read-only view of one or several pools: their public identity, reserves and
 * roles, what one unit is worth, the account's position and whether each pool
 * is safe, with shortcuts to the tools that act on it. Nothing here is signed.
 */
export default function PoolInfoTool({ t }: ConsoleToolProps) {
  const labels = t.pool;
  const [account, setAccount] = useConsoleQueryState<string | null>(accountFromQuery, null);
  const [allPools, setAllPools] = useConsoleQueryState<string[]>(() => addressesFromUrl('pool'), []);
  // Only the active network's pools show; the others wait for their network.
  const [pools, setPools] = useNetworkSelection(allPools, setAllPools);
  const { data: holdings } = useAccountResources(account);

  // Pools the account holds units of, offered as one-tap toggles.
  const detected = (holdings?.fungibles ?? [])
    .filter((f) => f.pool?.startsWith('pool_'))
    .map((f) => ({
      address: f.pool!,
      label: f.name || f.symbol || truncateAddress(f.pool!, 10, 6),
      description: labels.unitsHeld.replace('{amount}', f.amount),
    }));

  return (
    <div className="space-y-5">
      <ToolSection title={labels.contextTitle}>
        <div className="space-y-5">
          <div className="flex flex-col gap-2">
            <Heading>{labels.accountLabel}</Heading>
            <AccountPicker value={account} onChange={setAccount} />
          </div>
          <MultiAddressSelect
            label={labels.poolLabel}
            kind="pool"
            values={pools}
            onChange={setPools}
            suggestions={detected}
            placeholder={labels.poolPlaceholder}
          />
        </div>
      </ToolSection>

      {pools.map((pool) => (
        <PoolInfoCard key={pool} t={t} address={pool} account={account} onRemove={() => setPools((p) => p.filter((a) => a !== pool))} />
      ))}
    </div>
  );
}

function PoolInfoCard({ t, address, account, onRemove }: { t: ConsoleDictionary; address: string; account: string | null; onRemove: () => void }) {
  const labels = t.pool;
  const info = labels.info;
  const { language } = useLanguage();
  const { activeNetwork } = useRadixWallet();
  const { data: holdings } = useAccountResources(account);

  const { data: state, isLoading, error } = useQuery({
    queryKey: ['console-pool-state', activeNetwork, address],
    staleTime: 15_000,
    retry: false,
    queryFn: async () => parsePoolState(await apiFetchEntityDetails(address, activeNetwork, true)),
  });
  const { data: supply } = useQuery({
    queryKey: ['console-pool-unit-supply', activeNetwork, state?.poolUnit],
    enabled: !!state?.poolUnit,
    staleTime: 15_000,
    retry: false,
    queryFn: async () => {
      const details = (await apiFetchEntityDetails(state!.poolUnit, activeNetwork, true)) as unknown as {
        details?: { total_supply?: string };
      };
      return Number(details.details?.total_supply ?? 0);
    },
  });
  // Name, description, icon and link of the pool and of its pool unit, in one request.
  const { data: profiles } = useQuery({
    queryKey: ['console-pool-profile', activeNetwork, address, state?.poolUnit],
    enabled: !!state,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const data = await gatewayPost<{ items: { address: string; explicit_metadata?: MetadataList }[] }>(
        activeNetwork,
        '/state/entity/details',
        { addresses: [address, state!.poolUnit], opt_ins: { explicit_metadata: ['name', 'description', 'icon_url', 'info_url'] } },
      );
      const of = (a: string) => readProfile(data.items.find((i) => i.address === a)?.explicit_metadata);
      return { pool: of(address), unit: of(state!.poolUnit) };
    },
  });
  const badgeResources = state
    ? [state.manager, state.owner].flatMap((r) => (r.type === 'resource' || r.type === 'nonFungible' ? [r.resource] : []))
    : [];
  const names = useResourceLabels(state ? [...state.resources, state.poolUnit, ...badgeResources] : []);
  // The component behind a "global caller" rule: found in the pool's first transaction, checked by its hash.
  const { data: callers, isFetched: callersFetched } = useQuery({
    queryKey: ['console-pool-callers', activeNetwork, address],
    queryFn: () => findGlobalCaller((path, body) => gatewayPost(activeNetwork, path, body), address, [state!.manager, state!.owner]),
    enabled: !!state,
    staleTime: Infinity,
    retry: false,
  });
  // Who takes part and what each put in and took out, as the explorer shows them.
  const { data: participants } = useTopHolders(state?.poolUnit, activeNetwork);
  const { data: contributions } = usePoolContributions(state, activeNetwork);
  const largest = participants?.holders[0];
  const { findings } = usePoolSecurity({
    state,
    network: activeNetwork,
    callers,
    managerMoves: contributions?.managerMoves,
    topShare: largest && supply ? Number(largest.amount) / supply : null,
  });
  // The yield the DEX reports, and how a unit's value moved, from the ledger as it was.
  const listing = useDexListing(state ? address : null);
  const changes = useUnitValueChanges(state ? address : null, state?.poolUnit ?? null, YIELD_PERIODS);

  if (isLoading) return <CardSkeleton />;
  if (!state) {
    return (
      <EntityCardMessage
        address={address}
        message={cardError(error, labels.notAPool)}
        onRemove={onRemove}
        removeLabel={info.remove}
      />
    );
  }

  const fungibles = holdings?.fungibles ?? [];
  const nonFungibles = holdings?.nonFungibles ?? [];
  const holds = (rule: typeof state.manager) => (account && holdings ? !!heldBadgeFor(rule, fungibles, nonFungibles) : undefined);
  const heldUnits = Number(fungibles.find((f) => f.resourceAddress === state.poolUnit)?.amount ?? 0);
  const total = supply ?? 0;
  const position = total > 0 && heldUnits > 0 ? redemptionValue(state.reserves, heldUnits, total) : null;
  const flows = account ? contributions?.byAccount[account] : undefined;
  const flowOf = (side: 'putIn' | 'takenOut', r: string) => Number(flows?.[side][r] ?? 0);
  // What the position earned or lost: worth now, plus taken out, minus put in.
  const resultOf = (r: string) => (position?.[r] ?? 0) + flowOf('takenOut', r) - flowOf('putIn', r);
  const perResource = (value: (r: string) => number, signed = false) =>
    state.resources.map((r) => {
      const v = value(r);
      return (
        <span
          key={r}
          className="block"
          title={r}
          style={signed && v !== 0 ? { color: v > 0 ? 'var(--color-success)' : 'var(--color-danger)' } : undefined}
        >
          {signed && v > 0 ? '+' : ''}
          {fmtNumber(v, 6)} {resourceName(r)}
        </span>
      );
    });
  const xrdBadge = !!findings?.some((f) => f.id === 'xrdBadge');
  const drainable = isDrainable(state) || xrdBadge;
  const guarded = state.manager.type === 'resource' || state.manager.type === 'nonFungible';
  const byContract = 'resource' in state.manager && (isGlobalCallerBadge(state.manager.resource) || isPackageCallerBadge(state.manager.resource));
  const resourceName = (r: string) => names[r] ?? truncateAddress(r, 10, 6);
  const explorer = (a: string) => dashboardRoutes.entity(language, a, { network: activeNetwork });
  const addressLine = (a: string) => <AddressLine address={a} href={explorer(a)} copyLabel={t.common.copy} />;
  /** The component or package a caller rule names, as a line under the rule. */
  const callerLine = (rule: RuleView) => {
    if (rule.type !== 'nonFungible') return undefined;
    const entity = packageOfCallerRule(rule) ?? callers?.[rule.localId];
    if (entity) return addressLine(entity);
    return isGlobalCallerBadge(rule.resource) && callersFetched ? <Sub>{labels.callerUnknown}</Sub> : undefined;
  };
  /** The badge a rule asks for: its address, and the id when it is one NFT. */
  const badgeLine = (rule: RuleView) =>
    rule.type === 'resource' || rule.type === 'nonFungible' ? (
      <>
        {rule.type === 'resource' && <span className="block">{resourceName(rule.resource)}</span>}
        {addressLine(rule.resource)}
        {rule.type === 'nonFungible' && (
          <CopyLine value={rule.localId} text={labels.badgeId.replace('{id}', shortId(rule.localId))} copyLabel={t.common.copy} mono={false} />
        )}
      </>
    ) : null;
  // Both roles ask for exactly the same badge (and id): it is listed once.
  const sameBadge = JSON.stringify(state.manager) === JSON.stringify(state.owner);
  const managerBadgeRow = badgeLine(state.manager);
  const ownerBadgeRow = sameBadge ? null : badgeLine(state.owner);
  const title =
    profiles?.pool.name || profiles?.unit.name || state.resources.map((r) => names[r] ?? '?').join('/') || info.unnamed;
  // The tool opens on this pool, with the same account.
  const query = toolQuery({ pool: address, account });
  const link = (slug: 'pool-contribute' | 'pool-dex-add' | 'pool-redeem' | 'pool-reserves' | 'pool-profile' | 'pool-manage') => ({
    href: `/${language}/console/${slug}?${query}`,
    tool: { slug, query },
  });

  return (
    <EntityCard
      address={address}
      name={title}
      iconUrl={profiles?.pool.iconUrl || profiles?.unit.iconUrl}
      meta={
        <Sub>
          {labels.kinds[state.kind]}
          {state.tags.includes(RETIRED_TAG) && ` · ${info.retired}`}
        </Sub>
      }
      description={profiles?.pool.description || profiles?.unit.description}
      url={profiles?.pool.infoUrl || profiles?.unit.infoUrl}
      onRemove={onRemove}
      removeLabel={info.remove}
      copyLabel={t.common.copy}
      shortcuts={[
        // A pool a contract runs takes liquidity through that contract.
        byContract
          ? { ...link('pool-dex-add'), label: info.goDexAdd, icon: <ArrowDownToLine className="size-4" /> }
          : { ...link('pool-contribute'), label: info.goContribute, icon: <ArrowDownToLine className="size-4" /> },
        { ...link('pool-redeem'), label: info.goRedeem, icon: <ArrowUpFromLine className="size-4" /> },
        { ...link('pool-reserves'), label: info.goReserves, icon: <Scale className="size-4" /> },
        { ...link('pool-profile'), label: info.goProfile, icon: <Tags className="size-4" /> },
        { ...link('pool-manage'), label: info.goManage, icon: <Archive className="size-4" /> },
      ]}
    >
      <Note tone={drainable ? 'danger' : guarded ? 'success' : 'muted'}>
        {xrdBadge ? info.badgeRiskXrd : drainable ? info.safetyDrainable : byContract ? info.safetyContract : guarded ? info.safetyBadge : info.safetyOther}{' '}
        {state.ownerUpdatable ? info.ownerUpdatable : info.ownerFixed}
      </Note>
      <PoolSecurity
        t={t}
        findings={findings}
        name={resourceName}
        address={addressLine}
        date={(iso) => new Date(iso).toLocaleString(language)}
      />

      <Facts
        rows={[
          [
            labels.reservesLabel,
            state.resources.map((r) => (
              <span key={r} className="block" title={`${state.reserves[r] ?? '0'} · ${r}`}>
                {amount(state.reserves[r] ?? '0')} {resourceName(r)}
              </span>
            )),
          ],
          [
            labels.poolUnitLabel,
            <>
              <span title={state.poolUnit}>{resourceName(state.poolUnit)}</span>
              {supply !== undefined && <Sub>{labels.supply.replace('{amount}', amount(total))}</Sub>}
            </>,
          ],
          [labels.managerLabel, <RuleSummary key="m" t={t} rule={state.manager} badgeName={badgeNamer(names)} held={holds(state.manager)} caller={callerLine(state.manager)} />],
          !sameBadge && managerBadgeRow && [labels.managerBadgeLabel, managerBadgeRow],
          [
            labels.ownerLabel,
            <RuleSummary
              key="o"
              t={t}
              rule={state.owner}
              badgeName={badgeNamer(names)}
              held={holds(state.owner)}
              note={state.ownerUpdatable ? labels.ownerUpdatable : labels.ownerFixed}
              caller={callerLine(state.owner)}
            />,
          ],
          // One badge often fills both roles: shown once, after both.
          sameBadge ? managerBadgeRow && [labels.sharedBadgeLabel, managerBadgeRow] : ownerBadgeRow && [labels.ownerBadgeLabel, ownerBadgeRow],
        ]}
      />

      <RoleBadges
        t={t}
        title={labels.badgesTitle}
        badges={[
          { rule: state.manager, role: labels.managerRole },
          { rule: state.owner, role: labels.ownerRole },
        ].flatMap(({ rule, role }) => (rule.type === 'resource' || rule.type === 'nonFungible' ? [{ resource: rule.resource, roles: [role] }] : []))}
        held={(resource) => (account && holdings ? !!heldBadgeFor({ type: 'resource', resource }, fungibles, nonFungibles) : undefined)}
      />

      <EntityPermissions
        t={t}
        roles={state.roles}
        describe={(rule) =>
          rule.type === 'nonFungible' && (isGlobalCallerBadge(rule.resource) || isPackageCallerBadge(rule.resource))
            ? callerLine(rule)
            : badgeLine(rule)
        }
      />

      <div className="space-y-2">
        <Heading>{info.unitValueTitle}</Heading>
        {total > 0 ? (
          <ul className="space-y-1 text-sm" style={{ color: 'var(--color-text-main)' }}>
            {state.resources.map((r) => (
              <li key={r} title={r}>
                1 {names[state.poolUnit] ?? info.unit} ≈ {fmtNumber(Number(state.reserves[r] ?? 0) / total, 8)} {resourceName(r)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{info.emptyPool}</p>
        )}
      </div>

      <div className="space-y-2">
        <Heading>{info.yieldTitle}</Heading>
        <ul className="space-y-1 text-sm" style={{ color: 'var(--color-text-main)' }}>
          {listing.data && (listing.data.aprByPool[address] ?? listing.data.apr) !== null && (
            <li>
              {info.dexApr
                .replace('{dex}', info.dexNames[listing.data.dex])
                .replace('{apr}', fmtNumber((listing.data.aprByPool[address] ?? listing.data.apr ?? 0) * 100, 2))}
            </li>
          )}
          {YIELD_PERIODS.map((days, i) => {
            const change = changes[i]?.data;
            const pct = (v: number) => `${v >= 0 ? '+' : ''}${fmtNumber(v * 100, 3)} %`;
            return (
              <li key={days} style={{ color: change ? undefined : 'var(--color-text-muted)' }}>
                {changes[i]?.isPending
                  ? '…'
                  : change
                    ? info.unitChange.replace('{days}', String(days)).replace('{change}', pct(change.growth)).replace('{annual}', pct(change.annualized))
                    : info.unitChangeNone.replace('{days}', String(days))}
              </li>
            );
          })}
        </ul>
        <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{info.yieldNote}</p>
      </div>

      {participants && participants.holders.length > 0 && (
        <div className="space-y-2">
          <Heading>{info.participantsTitle.replace('{count}', String(participants.total ?? participants.holders.length))}</Heading>
          <TopHoldersList
            holders={participants.holders}
            supply={total}
            unit={names[state.poolUnit] ?? info.unit}
            network={activeNetwork}
            copyLabel={t.common.copy}
            detail={(_, share) =>
              state.resources.map((r) => `${fmtNumber(share * Number(state.reserves[r] ?? 0), 4)} ${resourceName(r)}`).join(' · ')
            }
          />
          <Link
            href={dashboardRoutes.entity(language, address, { network: activeNetwork })}
            className="inline-flex text-xs font-bold hover:opacity-70"
            style={{ color: 'var(--color-primary)' }}
          >
            {info.participantsAll} →
          </Link>
        </div>
      )}

      <div className="space-y-2">
        <Heading>{info.positionTitle}</Heading>
        {!account ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{info.pickAccount}</p>
        ) : position ? (
          <Facts
            rows={[
              [info.yourUnits, fmtNumber(heldUnits, 6)],
              [info.yourShare, `${fmtNumber((heldUnits / total) * 100, 4)} %`],
              [info.yourValue, perResource((r) => position[r] ?? 0)],
              contributions && [info.putIn, perResource((r) => flowOf('putIn', r))],
              contributions && [info.takenOut, perResource((r) => flowOf('takenOut', r))],
              contributions && [info.result, perResource(resultOf, true)],
            ]}
          />
        ) : (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{info.noPosition}</p>
        )}
      </div>
    </EntityCard>
  );
}
