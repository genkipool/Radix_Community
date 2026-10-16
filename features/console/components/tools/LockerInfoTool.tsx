'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Gift, PackagePlus, Undo2 } from 'lucide-react';

import { CopyButton } from '@/components/ui/CopyButton';
import { useLanguage } from '@/context/LanguageContext';
import { dashboardRoutes } from '@/features/dashboard/lib/routes';
import { waitingLine } from '@/features/dashboard/explorador/utils/lockerClaims';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { gatewayPost } from '@/services/gateway/bases';
import { truncateAddress } from '@/utils/formatters';
import { useAccountResources } from '../../hooks/useAccountResources';
import { useAccountLockerRoles } from '../../hooks/useAccountLockerRoles';
import { useConsoleQueryState } from '../../hooks/useConsoleQueryState';
import { useLockerActivity } from '../../hooks/useLockerActivity';
import { MAX_LOCKER_RECIPIENTS, useLockerWaiting } from '../../hooks/useLockerWaiting';
import { useResourceLabels } from '../../hooks/useResourceLabels';
import { fetchLockerClaims, parseLockerState } from '../../lib/locker-lookup';
import { heldBadgeFor, isGlobalCallerBadge, isPackageCallerBadge, ownerRule, type RuleView } from '../../lib/role-lookup';
import type { ConsoleDictionary } from '../../types/i18n.types';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { AccountPicker } from '../shared/AccountPicker';
import { CardSkeleton, cardError, EntityCard, EntityCardMessage, Facts, Heading, Note, RuleSummary, Sub, badgeNamer, type NoteTone } from '../shared/InfoParts';
import { MessageLine } from '../shared/MessageLine';
import { RoleBadges } from '../shared/RoleBadges';
import { MultiAddressSelect, addressesFromUrl } from '../shared/MultiAddressSelect';
import { ToolSection } from '../shared/ToolSection';
import { accountFromQuery, toolQuery } from '../../lib/console-query';

type MetadataList = { items?: { key: string; value?: { typed?: { value?: unknown } } }[] };
const readMeta = (list: MetadataList | undefined, key: string) => {
  const value = list?.items?.find((m) => m.key === key)?.value?.typed?.value;
  return typeof value === 'string' ? value : '';
};

const fmt = (value: string | number) =>
  Number(value).toLocaleString(undefined, { maximumFractionDigits: Number(value) >= 1 ? 4 : 8 });

/**
 * Read-only view of one or several AccountLockers, for both sides of an
 * airdrop: who runs each, who can load it and, above all, whether what it
 * keeps for you can be taken back before you claim it. With an account, what
 * is waiting for it. Nothing here is signed.
 */
export default function LockerInfoTool({ t }: ConsoleToolProps) {
  const info = t.locker.info;
  const [account, setAccount] = useConsoleQueryState<string | null>(accountFromQuery, null);
  const [lockers, setLockers] = useConsoleQueryState<string[]>(() => addressesFromUrl('locker'), []);
  const { activeNetwork } = useRadixWallet();
  const { data: roles, isLoading: loadingOwn } = useAccountLockerRoles(account, activeNetwork);
  // Lockers the account has a part in (it can claim, store or recover), not every one it once touched.
  const own = roles?.filter((l) => l.hasClaims || l.canStore || l.canRecover);
  const suggestions = (own ?? []).map((l) => ({
    address: l.address,
    label: l.name || truncateAddress(l.address, 10, 6),
    description: l.name ? truncateAddress(l.address, 8, 6) : undefined,
  }));

  return (
    <div className="space-y-5">
      <ToolSection title={info.contextTitle}>
        <div className="space-y-5">
          <div className="flex flex-col gap-2">
            <Heading>{t.pool.accountLabel}</Heading>
            <AccountPicker value={account} onChange={setAccount} />
          </div>
          <MultiAddressSelect
            label={info.lockerLabel}
            kind="locker"
            values={lockers}
            onChange={setLockers}
            suggestions={suggestions}
            suggestionsLoading={loadingOwn}
            placeholder="locker_rdx1…"
          />
        </div>
      </ToolSection>

      {lockers.map((address) => (
        <LockerInfoCard
          key={address}
          t={t}
          address={address}
          account={account}
          onRemove={() => setLockers((l) => l.filter((a) => a !== address))}
        />
      ))}
    </div>
  );
}

function LockerInfoCard({ t, address, account, onRemove }: { t: ConsoleDictionary; address: string; account: string | null; onRemove: () => void }) {
  const info = t.locker.info;
  const { language } = useLanguage();
  const { activeNetwork } = useRadixWallet();

  // State and profile in one request.
  const { data, isLoading, error } = useQuery({
    queryKey: ['console-locker-info', activeNetwork, address],
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const page = await gatewayPost<{ items: Array<Record<string, unknown> & { explicit_metadata?: MetadataList }> }>(
        activeNetwork,
        '/state/entity/details',
        { addresses: [address], opt_ins: { explicit_metadata: ['name', 'description', 'icon_url', 'info_url'] } },
      );
      const entity = page.items[0];
      const state = entity ? parseLockerState(entity) : null;
      if (!state) return null;
      const meta = entity.explicit_metadata;
      const details = (entity.details ?? {}) as { package_address?: string; blueprint_name?: string; blueprint_version?: string };
      return {
        state,
        packageAddress: details.package_address ?? '',
        blueprint: [details.blueprint_name, details.blueprint_version].filter(Boolean).join(' '),
        ownerUpdatable: ownerRule(entity).updatable,
        name: readMeta(meta, 'name'),
        description: readMeta(meta, 'description'),
        iconUrl: readMeta(meta, 'icon_url'),
        infoUrl: readMeta(meta, 'info_url'),
      };
    },
  });
  const state = data?.state;

  const { data: holdings } = useAccountResources(state ? account : null);
  const { data: claims, isLoading: loadingClaims, error: claimsError } = useQuery({
    queryKey: ['console-locker-claims', activeNetwork, address, account],
    enabled: !!state && !!account,
    staleTime: 10_000,
    retry: false,
    queryFn: () => fetchLockerClaims((path, body) => gatewayPost(activeNetwork, path, body), address, account!),
  });
  // Totals come from the locker's history: read once per visit, not per render.
  const { data: activity, isLoading: loadingActivity } = useLockerActivity(address, activeNetwork, !!state);
  const heldResources = activity ? [...Object.keys(activity.fungibles), ...Object.keys(activity.nonFungibles)] : [];
  // Each recipient and what still waits for them, the picked account first.
  const allRecipients = activity?.claimantAccounts ?? [];
  const recipients = account && allRecipients.includes(account) ? [account, ...allRecipients.filter((a) => a !== account)] : allRecipients;
  const { data: waiting } = useLockerWaiting(address, recipients, activeNetwork);
  const waitingResources = Object.values(waiting ?? {}).flatMap((list) => list.map((c) => c.resource));

  const badgeResources = state
    ? [state.owner, state.storer, state.recoverer].flatMap((r) => (r.type === 'resource' || r.type === 'nonFungible' ? [r.resource] : []))
    : [];
  const names = useResourceLabels([...badgeResources, ...heldResources, ...waitingResources, ...(claims ?? []).map((c) => c.resource)]);


  if (isLoading) return <CardSkeleton />;
  if (!data || !state) {
    return (
      <EntityCardMessage
        address={address}
        message={cardError(error, t.locker.notALocker)}
        onRemove={onRemove}
        removeLabel={info.remove}
      />
    );
  }

  const holds = (rule: RuleView) => (account && holdings ? !!heldBadgeFor(rule, holdings.fungibles, holdings.nonFungibles) : undefined);
  const callerHints = { component: info.componentHint, package: info.packageHint };
  const rule = (r: RuleView, note?: string) => (
    <RuleSummary t={t} rule={r} badgeName={badgeNamer(names)} held={holds(r)} note={note} callerHints={callerHints} />
  );

  // What a recipient most needs to know: can it be taken back before they claim?
  const recover = state.recoverer;
  const safety: { tone: NoteTone; text: string } =
    recover.type === 'denyAll'
      ? { tone: 'success', text: info.recoverNobody }
      : recover.type === 'allowAll'
        ? { tone: 'danger', text: info.recoverAnyone }
        : (recover.type === 'resource' || recover.type === 'nonFungible') &&
            (isGlobalCallerBadge(recover.resource) || isPackageCallerBadge(recover.resource))
          ? { tone: 'warning', text: info.recoverContract }
          : recover.type === 'resource' || recover.type === 'nonFungible'
            ? { tone: 'warning', text: info.recoverBadge }
          : { tone: 'muted', text: info.recoverOther };

  // The shared claim link carries only the locker; the shortcuts also keep the account picked here.
  const claimHref = `/${language}/console/locker-claim?locker=${address}`;
  const claimUrl = typeof window === 'undefined' ? claimHref : `${window.location.origin}${claimHref}`;
  const query = toolQuery({ locker: address, account });
  const canStore = holds(state.storer);

  return (
    <EntityCard
      address={address}
      name={data.name || info.unnamed}
      iconUrl={data.iconUrl}
      description={data.description}
      url={data.infoUrl}
      onRemove={onRemove}
      removeLabel={info.remove}
      copyLabel={t.common.copy}
      shortcuts={[
        {
          href: `/${language}/console/locker-claim?${query}`,
          label: t.tools['locker-claim'].title,
          icon: <Gift className="size-4" />,
          tool: { slug: 'locker-claim', query },
        },
        ...(state.recoverer.type !== 'denyAll' && holds(state.recoverer) !== false
          ? [
              {
                href: `/${language}/console/locker-recover?${query}`,
                label: t.tools['locker-recover'].title,
                icon: <Undo2 className="size-4" />,
                tool: { slug: 'locker-recover' as const, query },
              },
            ]
          : []),
        ...(canStore !== false
          ? [
              {
                href: `/${language}/console/locker-airdrop?${query}`,
                label: t.tools['locker-airdrop'].title,
                icon: <PackagePlus className="size-4" />,
                tool: { slug: 'locker-airdrop' as const, query },
              },
            ]
          : []),
      ]}
    >
      <div className="space-y-2">
        <Note tone={safety.tone}>{safety.text}</Note>
        {state.storer.type === 'allowAll' && <Note tone="muted">{info.storeAnyone}</Note>}
      </div>

      <div className="space-y-2">
        <Heading>{info.rolesTitle}</Heading>
        <Facts
          numeric={false}
          rows={[
            [info.storerLabel, rule(state.storer)],
            [info.recovererLabel, rule(state.recoverer)],
            [info.ownerLabel, rule(state.owner, data.ownerUpdatable ? info.ownerUpdatable : info.ownerFixed)],
          ]}
        />
      </div>

      <RoleBadges
        t={t}
        title={info.badgeTitle}
        badges={[
          { rule: state.owner, role: info.ownerLabel },
          { rule: state.storer, role: info.storerLabel },
          { rule: state.recoverer, role: info.recovererLabel },
        ].flatMap(({ rule, role }) => (rule.type === 'resource' || rule.type === 'nonFungible' ? [{ resource: rule.resource, roles: [role] }] : []))}
        held={(resource) => holds({ type: 'resource', resource })}
      />

      <div className="space-y-2">
        <Heading>{info.contentTitle}</Heading>
        <Facts
          numeric={false}
          rows={[
            [info.acceptsLabel, <span key="a" className="font-normal">{info.acceptsAny}</span>],
            loadingActivity
              ? [info.heldLabel, <span key="l" className="block h-4 w-32 rounded animate-pulse" style={{ background: 'var(--color-card-border)' }} />]
              : activity && !activity.truncated
                ? [
                    info.heldLabel,
                    heldResources.length === 0 ? (
                      <span key="n" className="font-normal" style={{ color: 'var(--color-text-muted)' }}>{info.nothingHeld}</span>
                    ) : (
                      <>
                        {Object.entries(activity.fungibles).map(([r, amount]) => (
                          <span key={r} className="block tabular-nums" title={`${amount} · ${r}`}>
                            {fmt(amount)} {names[r] ?? truncateAddress(r, 10, 6)}
                          </span>
                        ))}
                        {Object.entries(activity.nonFungibles).map(([r, count]) => (
                          <span key={r} className="block tabular-nums" title={r}>
                            {count} NFT {names[r] ?? truncateAddress(r, 10, 6)}
                          </span>
                        ))}
                      </>
                    ),
                  ]
                : null,
            activity && !activity.truncated && [
              info.activityLabel,
              <span key="act" className="font-normal">
                {info.activity
                  .replace('{claimants}', String(activity.claimants))
                  .replace('{accounts}', activity.claimants === 1 ? info.accountOne : info.accountMany)
                  .replace('{stores}', String(activity.stores))
                  .replace('{claims}', String(activity.claims))
                  .replace('{recoveries}', String(activity.recoveries))}
              </span>,
            ],
          ]}
        />
        {activity?.truncated && <Sub>{info.truncated.replace('{count}', String(activity.transactions))}</Sub>}
      </div>

      {recipients.length > 0 && (
        <div className="space-y-2">
          <Heading>{info.recipientsTitle.replace('{count}', String(recipients.length))}</Heading>
          <ul className="divide-y text-sm" style={{ borderColor: 'var(--color-card-border)' }}>
            {recipients.slice(0, MAX_LOCKER_RECIPIENTS).map((recipient) => {
              const pending = waiting?.[recipient];
              return (
                <li key={recipient} className="flex items-center justify-between gap-3 py-2 border-[var(--color-card-border)]">
                  <span className="min-w-0">
                    <span className="flex items-center gap-1">
                      <Link
                        href={dashboardRoutes.entity(language, recipient, { network: activeNetwork })}
                        className="font-mono text-xs hover:underline"
                        style={{ color: 'var(--color-primary)' }}
                        title={recipient}
                      >
                        {truncateAddress(recipient, 12, 6)}
                      </Link>
                      <CopyButton value={recipient} size="xs" variant="ghost" title={t.common.copy} />
                    </span>
                    {recipient === account && (
                      <span className="block text-[10px] font-bold" style={{ color: 'var(--color-primary)' }}>{info.thisAccount}</span>
                    )}
                  </span>
                  <span className="text-right text-xs" style={{ color: pending?.length ? 'var(--color-text-main)' : 'var(--color-text-muted)' }}>
                    {!pending ? '…' : pending.length ? waitingLine(pending, names, language) : info.allClaimed}
                  </span>
                </li>
              );
            })}
          </ul>
          {recipients.length > MAX_LOCKER_RECIPIENTS && (
            <Sub>{info.recipientsMore.replace('{count}', String(recipients.length - MAX_LOCKER_RECIPIENTS))}</Sub>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Heading>{info.componentTitle}</Heading>
        <Facts
          numeric={false}
          rows={[
            [
              info.componentLabel,
              <span key="c" className="flex min-w-0 items-center gap-2">
                <code className="min-w-0 break-all text-xs font-normal">{address}</code>
                <CopyButton value={address} size="xs" variant="ghost" title={t.common.copy} />
              </span>,
            ],
            !!data.packageAddress && [
              info.packageLabel,
              <span key="p" className="block min-w-0">
                <span className="flex min-w-0 items-center gap-2">
                  <code className="min-w-0 break-all text-xs font-normal">{data.packageAddress}</code>
                  <CopyButton value={data.packageAddress} size="xs" variant="ghost" title={t.common.copy} />
                </span>
                {/lckerx/.test(data.packageAddress) && <Sub>{info.nativePackage}</Sub>}
              </span>,
            ],
            !!data.blueprint && [info.blueprintLabel, data.blueprint],
          ]}
        />
      </div>

      <div className="space-y-2">
        <Heading>{t.lockerClaim.waitingTitle}</Heading>
        {!account ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{info.pickAccount}</p>
        ) : loadingClaims ? (
          <span className="block h-10 rounded-xl animate-pulse" style={{ background: 'var(--color-card-border)' }} />
        ) : claimsError ? (
          <MessageLine tone="error">
            {t.lockerClaim.error.replace('{message}', claimsError instanceof Error ? claimsError.message : String(claimsError))}
          </MessageLine>
        ) : claims && claims.length > 0 ? (
          <ul className="space-y-1 text-sm" style={{ color: 'var(--color-text-main)' }}>
            {claims.map((c) => (
              <li key={c.resource} title={c.resource}>
                <span className="font-semibold tabular-nums">{c.nftIds ? `${c.nftIds.length} NFT` : fmt(c.amount ?? '0')}</span>{' '}
                {names[c.resource] ?? truncateAddress(c.resource, 10, 6)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t.lockerClaim.nothing}</p>
        )}
      </div>

      <div className="space-y-2">
        <Heading>{info.claimLinkTitle}</Heading>
        <div className="flex min-w-0 items-center gap-2">
          <code className="min-w-0 flex-1 truncate text-xs" style={{ color: 'var(--color-text-muted)' }} title={claimUrl}>
            {claimUrl}
          </code>
          <CopyButton value={claimUrl} size="xs" variant="ghost" title={t.common.copy} />
        </div>
        <Sub>{t.locker.claimLinkHint}</Sub>
      </div>
    </EntityCard>
  );
}
