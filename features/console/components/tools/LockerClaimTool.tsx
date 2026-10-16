'use client';

import { useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { Gift, Inbox } from 'lucide-react';

import { CopyButton } from '@/components/ui/CopyButton';
import { SafeImage } from '@/components/ui/SafeImage';

import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { gatewayPost } from '@/services/gateway/bases';
import { formatNumber, truncateAddress } from '@/utils/formatters';
import { useAccountLockerRoles } from '../../hooks/useAccountLockerRoles';
import { useConsoleQueryState } from '../../hooks/useConsoleQueryState';
import { useConsoleTransaction } from '../../hooks/useConsoleTransaction';
import { useResourceLabelsState } from '../../hooks/useResourceLabels';
import { useTransactionPreview } from '../../hooks/useTransactionPreview';
import { otherNetworkOf } from '../../lib/address-network';
import { accountFromQuery, toolQuery } from '../../lib/console-query';
import { fetchLockerClaims, type LockerClaim } from '../../lib/locker-lookup';
import { claimFromLockersManifest } from '../../lib/locker-manifests';
import { getMetadataString, type GatewayMetadataItem } from '../../lib/metadata-manifests';
import type { GatewayPost } from '../../lib/resource-holders';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { LockerRoleNote } from '../locker/LockerRoleNote';
import { AccountPicker } from '../shared/AccountPicker';
import { CollapsibleManifest } from '../shared/CollapsibleManifest';
import { MessageLine } from '../shared/MessageLine';
import { MultiAddressSelect, addressesFromUrl } from '../shared/MultiAddressSelect';
import { SimulateResultCard } from '../shared/SimulatePanel';
import { ToolSection } from '../shared/ToolSection';
import { TxActions } from '../shared/TxActions';
import { TxResultBanner } from '../shared/TxResultBanner';

/** One locker as read: its name and what waits there for each wallet account. */
interface LockerWaiting {
  name: string;
  /** What waits there, per wallet account. */
  byAccount: Record<string, LockerClaim[]>;
}

/**
 * The recipient's side of locker airdrops: what is waiting for the account in
 * one or several lockers, and one transaction that claims all of it (simulated
 * first if you like). The wallet account the lockers hold something for is
 * picked by itself; picking an account drops the lockers that hold nothing for
 * it. Only the account itself can claim (the engine checks its owner rule), so
 * a shared link is safe. Taking back what others never claimed is the sender's
 * side: the "Recover from locker" tool.
 */
export default function LockerClaimTool({ t }: ConsoleToolProps) {
  const labels = t.lockerClaim;
  const { language } = useLanguage();
  const { activeNetwork, accounts } = useRadixWallet();
  const [account, setAccount] = useConsoleQueryState<string | null>(accountFromQuery, null);
  const [lockers, setLockers] = useConsoleQueryState<string[]>(() => addressesFromUrl('locker'), []);
  const { sendTransaction, isSending, result, error, reset } = useConsoleTransaction();
  const preview = useTransactionPreview();
  const queryClient = useQueryClient();

  // Only the lockers keeping something for this account, offered as one-tap toggles.
  const { data: roles, isLoading: loadingOwn } = useAccountLockerRoles(account, activeNetwork);
  const suggestions = (roles ?? []).filter((l) => l.hasClaims).map((l) => ({
    address: l.address,
    label: l.name || truncateAddress(l.address, 10, 6),
    description: l.name ? truncateAddress(l.address, 8, 6) : undefined,
  }));

  // One query per locker: adding or removing one never reloads (or blanks)
  // the others. Each reads the locker's name and what waits there for every
  // wallet account, which drives what is shown, which account is picked and
  // what each pick keeps.
  const walletAccounts = accounts.map((a) => a.address).filter((a) => !otherNetworkOf(a, activeNetwork));
  const perLocker = useQueries({
    queries: lockers.map((locker) => ({
      queryKey: ['console-locker-claims', activeNetwork, locker, walletAccounts.join(',')],
      enabled: walletAccounts.length > 0,
      staleTime: 10_000,
      retry: false,
      queryFn: async (): Promise<LockerWaiting> => {
        const post: GatewayPost = (path, body) => gatewayPost(activeNetwork, path, body);
        const [details, rows] = await Promise.all([
          post<{ items?: Array<{ explicit_metadata?: { items?: GatewayMetadataItem[] } }> }>('/state/entity/details', {
            addresses: [locker],
            opt_ins: { explicit_metadata: ['name'] },
          }).catch(() => null),
          Promise.all(walletAccounts.map(async (who) => [who, await fetchLockerClaims(post, locker, who).catch(() => [])] as const)),
        ]);
        return { name: getMetadataString(details?.items?.[0]?.explicit_metadata?.items, 'name'), byAccount: Object.fromEntries(rows) };
      },
    })),
  });
  const waitingOf = (locker: string) => perLocker[lockers.indexOf(locker)]?.data;
  const settled = lockers.length > 0 && perLocker.every((q) => !q.isPending);
  const claimsError = perLocker.find((q) => q.error)?.error;
  const claimsOf = (locker: string, who: string | null) => (who ? waitingOf(locker)?.byAccount[who] ?? [] : []);
  const hasClaims = (who: string | null) => lockers.some((l) => claimsOf(l, who).length > 0);

  // Picks by itself the account the lockers hold something for, once per set of lockers.
  const lockerKey = lockers.join(',');
  const firstWithClaims = walletAccounts.find(hasClaims);
  const [autoPickedFor, setAutoPickedFor] = useState('');
  // Only once every locker is read, so the pick does not jump while they arrive.
  if (settled && firstWithClaims && autoPickedFor !== lockerKey && !hasClaims(account)) {
    setAutoPickedFor(lockerKey);
    setAccount(firstWithClaims);
  }
  const pickAccount = (next: string) => {
    setAccount(next);
    // Lockers that hold nothing for this account are not its to claim from.
    if (settled) setLockers(lockers.filter((l) => !(next in (waitingOf(l)?.byAccount ?? {})) || claimsOf(l, next).length > 0));
  };

  const withClaims = lockers.map((locker) => ({ locker, claims: claimsOf(locker, account) }));
  const { labels: names, icons, loading: namesLoading } = useResourceLabelsState(withClaims.flatMap((l) => l.claims.map((c) => c.resource)));
  const manifest = account ? claimFromLockersManifest({ account, lockers: withClaims }) : '';

  const claim = async () => {
    if (await sendTransaction(manifest)) void queryClient.invalidateQueries({ queryKey: ['console-locker-claims'] });
  };

  return (
    <div className="space-y-5">
      <LockerRoleNote
        icon={Gift}
        who={labels.roleWho}
        what={labels.roleWhat}
        other={{
          question: labels.otherQuestion,
          label: t.tools['locker-recover'].title,
          href: `/${language}/console/locker-recover?${toolQuery({ locker: lockers[0], account })}`,
        }}
      />

      <ToolSection title={labels.accountTitle}>
        <AccountPicker value={account} onChange={pickAccount} />
      </ToolSection>

      <ToolSection title={labels.lockerTitle} hint={labels.lockerHint}>
        <MultiAddressSelect
          label={t.locker.info.lockerLabel}
          kind="locker"
          values={lockers}
          onChange={setLockers}
          suggestions={suggestions}
          suggestionsLoading={loadingOwn}
          placeholder="locker_rdx1…"
        />
      </ToolSection>

      {lockers.length > 0 && (
        <ToolSection title={labels.waitingTitle} hint={labels.waitingHint}>
          {/* Until every locker is read the rows hold their place; the account is picked by then. */}
          {!account && settled ? (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{labels.pickAccount}</p>
          ) : claimsError ? (
            <MessageLine tone="error">
              {labels.error.replace('{message}', claimsError instanceof Error ? claimsError.message : String(claimsError))}
            </MessageLine>
          ) : (
            <div className="space-y-6">
              {withClaims.map(({ locker, claims }) => {
                const read = waitingOf(locker);
                return (
                <section key={locker}>
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b" style={{ borderColor: 'var(--color-card-border)' }}>
                    <span className="flex items-center gap-2 min-w-0">
                      <Inbox className="size-4 shrink-0" style={{ color: 'var(--color-primary)' }} />
                      {read ? (
                        <span className="text-sm font-bold truncate" style={{ color: 'var(--color-text-main)' }}>{read.name || labels.unnamedLocker}</span>
                      ) : (
                        <span className="block h-5 w-28 rounded animate-pulse" style={{ background: 'var(--color-card-border)' }} />
                      )}
                      <span className="font-mono text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{truncateAddress(locker, 10, 6)}</span>
                      <CopyButton value={locker} size="xs" variant="ghost" title={t.common.copy} />
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                      {claims.length ? labels.resourcesCount.replace('{count}', String(claims.length)) : ''}
                    </span>
                  </div>
                  {!read ? (
                    // Shaped like the rows it stands for, so nothing moves when they arrive.
                    <ul className="divide-y divide-[var(--color-card-border)]" aria-busy>
                      {[0, 1].map((n) => (
                        <li key={n} className="flex items-center gap-3 py-3">
                          <span className="size-9 shrink-0 rounded-full animate-pulse" style={{ background: 'var(--color-card-border)' }} />
                          <span className="flex-1 space-y-1.5">
                            <span className="block h-4 w-24 rounded animate-pulse" style={{ background: 'var(--color-card-border)' }} />
                            <span className="block h-3 w-36 rounded animate-pulse" style={{ background: 'var(--color-card-border)' }} />
                          </span>
                          <span className="h-5 w-16 rounded animate-pulse" style={{ background: 'var(--color-card-border)' }} />
                        </li>
                      ))}
                    </ul>
                  ) : claims.length > 0 ? (
                    <ul className="divide-y divide-[var(--color-card-border)]">
                      {claims.map((c) => (
                        <ClaimRow
                          key={c.resource}
                          claim={c}
                          label={names[c.resource]}
                          icon={icons[c.resource]}
                          loading={namesLoading.has(c.resource)}
                          unnamed={labels.unnamed}
                          copyTitle={t.common.copy}
                          locale={language}
                        />
                      ))}
                    </ul>
                  ) : (
                    <p className="py-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>{labels.nothing}</p>
                  )}
                </section>
                );
              })}
            </div>
          )}
        </ToolSection>
      )}

      {/* Always shown, so it is clear what the page is for; it only enables with something to claim. */}
      <div className="space-y-4">
        <CollapsibleManifest manifest={manifest} showLabel={labels.showManifest} hideLabel={labels.hideManifest} copyLabel={t.common.copy} />
        <TxActions
          t={t}
          onSend={claim}
          onSimulate={() => preview.simulate(manifest)}
          sendDisabled={!manifest || isSending}
          simulateDisabled={!manifest || isSending}
          sending={isSending}
          simulating={preview.isSimulating}
          sendLabel={labels.claimAll}
          sendingLabel={t.common.sending}
        />
      </div>
      <SimulateResultCard t={t.simulate} preview={preview.preview} error={preview.error} onClose={preview.reset} />
      <TxResultBanner t={t.common} result={result} error={error} onReset={reset} />
    </div>
  );
}

/**
 * One resource waiting in a locker: its icon, name and address on the left,
 * the amount with its unit on the right (NFTs list their ids underneath).
 * A placeholder holds the name while it loads, never the address first.
 */
function ClaimRow({
  claim,
  label,
  icon,
  loading,
  unnamed,
  copyTitle,
  locale,
}: {
  claim: LockerClaim;
  label?: string;
  icon?: string;
  loading: boolean;
  unnamed: string;
  copyTitle: string;
  locale: string;
}) {
  const unit = claim.nftIds ? 'NFT' : label ?? '';
  const amount = claim.nftIds ? String(claim.nftIds.length) : formatNumber(Number(claim.amount ?? 0), 6, locale);
  return (
    <li className="flex items-center gap-3 py-3">
      {loading ? (
        <span className="size-9 shrink-0 rounded-full animate-pulse" style={{ background: 'var(--color-card-border)' }} />
      ) : icon ? (
        <SafeImage src={icon} alt={label ?? ''} fallbackName={label || claim.resource} zoomable={false} className="size-9 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="size-9 shrink-0 rounded-full grid place-items-center" style={{ background: 'var(--color-card-border)' }}>
          <Gift className="size-4" style={{ color: 'var(--color-text-muted)' }} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        {loading ? (
          <span className="block h-5 w-24 rounded animate-pulse" style={{ background: 'var(--color-card-border)' }} />
        ) : (
          <span className="block text-sm font-bold truncate" style={{ color: 'var(--color-text-main)' }}>
            {label || <span className="italic font-semibold" style={{ color: 'var(--color-text-muted)' }}>{unnamed}</span>}
          </span>
        )}
        <span className="flex items-center gap-1 min-w-0">
          <span className="font-mono text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>{truncateAddress(claim.resource, 10, 6)}</span>
          <CopyButton value={claim.resource} size="xs" variant="ghost" title={copyTitle} />
        </span>
      </span>
      <span className="shrink-0 text-right" title={`${amount} ${unit}`.trim()}>
        <span className="block text-base font-black whitespace-nowrap" style={{ color: 'var(--color-text-main)' }}>
          {amount} <span className="text-sm font-bold">{unit.length > 5 ? `${unit.slice(0, 5)}…` : unit}</span>
        </span>
        {claim.nftIds && (
          <span className="block font-mono text-[11px] max-w-[12rem] truncate" style={{ color: 'var(--color-text-muted)' }} title={claim.nftIds.join(', ')}>
            {claim.nftIds.join(', ')}
          </span>
        )}
      </span>
    </li>
  );
}
