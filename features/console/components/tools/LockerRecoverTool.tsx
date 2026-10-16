'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Undo2 } from 'lucide-react';

import { useLanguage } from '@/context/LanguageContext';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { truncateAddress } from '@/utils/formatters';
import { useAccountLockerRoles } from '../../hooks/useAccountLockerRoles';
import { useAccountResources } from '../../hooks/useAccountResources';
import { useConsoleQueryState } from '../../hooks/useConsoleQueryState';
import { useLockerActivity } from '../../hooks/useLockerActivity';
import { useLockerWaiting } from '../../hooks/useLockerWaiting';
import { useResourceLabelsState } from '../../hooks/useResourceLabels';
import { otherNetworkOf } from '../../lib/address-network';
import { accountFromQuery, toolQuery } from '../../lib/console-query';
import { parseLockerState } from '../../lib/locker-lookup';
import { recoverAllBatches, recoverAllManifest, type UnclaimedItem } from '../../lib/locker-manifests';
import { heldBadgeFor } from '../../lib/role-lookup';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { ClaimLines } from '../locker/ClaimLines';
import { LockerRoleNote } from '../locker/LockerRoleNote';
import { AccountPicker } from '../shared/AccountPicker';
import { BatchRunner } from '../shared/BatchRunner';
import { MessageLine } from '../shared/MessageLine';
import { MultiAddressSelect, addressesFromUrl } from '../shared/MultiAddressSelect';
import { ToolSection } from '../shared/ToolSection';

/**
 * The sender's side of locker airdrops: everything a locker still keeps for
 * its recipients, one row per recipient, and the rows ticked go back to the
 * account holding the recoverer badge in as few transactions as the engine's
 * event limit allows. Ticking one row recovers from one recipient; leaving
 * them all ticked recovers everything. Claiming one's own share is the
 * recipient's side: the "Claim from locker" tool.
 */
export default function LockerRecoverTool({ t }: ConsoleToolProps) {
  const labels = t.lockerRecover;
  const { language } = useLanguage();
  const { activeNetwork, accounts } = useRadixWallet();
  const queryClient = useQueryClient();
  const [account, setAccount] = useConsoleQueryState<string | null>(accountFromQuery, null);
  // One locker at a time: each has its own recoverer badge.
  const [lockers, setLockers] = useConsoleQueryState<string[]>(() => addressesFromUrl('locker').slice(0, 1), []);
  const locker = lockers[0] ?? '';

  // Only the lockers whose recoverer badge this account holds, offered as one-tap choices.
  const { data: roles, isLoading: loadingOwn } = useAccountLockerRoles(account, activeNetwork);
  const suggestions = (roles ?? []).filter((l) => l.canRecover).map((l) => ({
    address: l.address,
    label: l.name || truncateAddress(l.address, 10, 6),
    description: l.name ? truncateAddress(l.address, 8, 6) : undefined,
  }));

  const { data: state, isLoading: loadingState } = useQuery({
    queryKey: ['console-locker-state', activeNetwork, locker],
    enabled: locker.startsWith('locker_') && !otherNetworkOf(locker, activeNetwork),
    staleTime: 15_000,
    retry: false,
    queryFn: async () => parseLockerState(await apiFetchEntityDetails(locker, activeNetwork, true)),
  });
  const { data: holdings } = useAccountResources(state ? account : null);
  const badge = state && account && holdings ? heldBadgeFor(state.recoverer, holdings.fungibles, holdings.nonFungibles) : null;
  const recoverer = badge && account ? { account, resource: badge.resource, nonFungibleId: badge.localId } : null;
  const canRecover = !!state && state.recoverer.type !== 'denyAll';

  // Every recipient the locker's history names, and what still waits for each.
  const { data: activity, isLoading: loadingActivity } = useLockerActivity(canRecover ? locker : null, activeNetwork);
  const recipients = activity?.claimantAccounts ?? [];
  const { data: waiting, isLoading: loadingWaiting } = useLockerWaiting(locker, recipients, activeNetwork, Infinity);
  const items: UnclaimedItem[] = recipients
    .map((claimant) => ({ claimant, claims: waiting?.[claimant] ?? [] }))
    .filter((item) => item.claims.length > 0);
  const { labels: names, icons } = useResourceLabelsState(items.flatMap((i) => i.claims.map((c) => c.resource)));
  const loading = loadingState || loadingActivity || (recipients.length > 0 && loadingWaiting);

  // Unticked recipients, per locker: everything starts ticked.
  const [skipped, setSkipped] = useState<Record<string, string[]>>({});
  const skip = skipped[locker] ?? [];
  const chosen = items.filter((i) => !skip.includes(i.claimant));
  const toggle = (claimant: string) =>
    setSkipped((all) => ({ ...all, [locker]: skip.includes(claimant) ? skip.filter((c) => c !== claimant) : [...skip, claimant] }));
  const toggleAll = () => setSkipped((all) => ({ ...all, [locker]: chosen.length ? items.map((i) => i.claimant) : [] }));

  const batches =
    account && recoverer && state
      ? recoverAllBatches(chosen).map((batch) => ({
          manifest: recoverAllManifest({ account, locker: state.address, badge: recoverer, items: batch }),
          count: batch.length,
        }))
      : [];

  const accountName = (address: string) => accounts.find((a) => a.address === address)?.label;
  const blockedReason = !account
    ? t.batches.pickAccount
    : !locker
      ? labels.pickLocker
      : state === null
        ? t.locker.notALocker
        : state && !canRecover
          ? labels.noRecovery
          : state && holdings && !recoverer
            ? labels.needsRecoverer
            : loading
              ? labels.loading
              : items.length === 0
                ? labels.nothing
                : chosen.length === 0
                  ? labels.noneTicked
                  : undefined;

  return (
    <div className="space-y-5">
      <LockerRoleNote
        icon={Undo2}
        who={labels.roleWho}
        what={labels.roleWhat}
        other={{
          question: labels.otherQuestion,
          label: t.tools['locker-claim'].title,
          href: `/${language}/console/locker-claim?${toolQuery({ locker: locker || undefined, account })}`,
        }}
      />

      <ToolSection title={labels.accountTitle} hint={labels.accountHint}>
        <AccountPicker value={account} onChange={setAccount} />
      </ToolSection>

      <ToolSection title={labels.lockerTitle} hint={labels.lockerHint}>
        <MultiAddressSelect
          label={t.locker.info.lockerLabel}
          kind="locker"
          values={lockers}
          // Picking another locker replaces the one shown.
          onChange={(next) => setLockers(next.slice(-1))}
          suggestions={suggestions}
          suggestionsLoading={loadingOwn}
          placeholder="locker_rdx1…"
        />
      </ToolSection>

      {locker && state && (
        <ToolSection title={labels.waitingTitle} hint={labels.waitingHint}>
          {!canRecover ? (
            <MessageLine tone="muted">{labels.noRecovery}</MessageLine>
          ) : loading ? (
            <span className="block h-24 rounded-xl animate-pulse" style={{ background: 'var(--color-card-border)' }} />
          ) : items.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{labels.nothing}</p>
          ) : (
            <div>
              <label
                className="flex items-center gap-3 pb-2 border-b text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-muted)' }}
              >
                <input type="checkbox" checked={chosen.length === items.length} onChange={toggleAll} className="size-4 accent-[var(--color-primary)]" />
                <span className="flex-1">{labels.recipientColumn.replace('{count}', String(items.length))}</span>
                <span className="text-right">{labels.waitingColumn}</span>
              </label>
              <ul className="divide-y divide-[var(--color-card-border)]">
                {items.map((item) => {
                  const name = accountName(item.claimant);
                  return (
                    <li key={item.claimant}>
                      <label className="flex items-center gap-3 py-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!skip.includes(item.claimant)}
                          onChange={() => toggle(item.claimant)}
                          className="size-4 shrink-0 accent-[var(--color-primary)]"
                        />
                        <span className="min-w-0 flex-1" title={item.claimant}>
                          {name && <span className="block text-sm font-semibold truncate" style={{ color: 'var(--color-text-main)' }}>{name}</span>}
                          <span className="block font-mono text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                            {truncateAddress(item.claimant, 14, 8)}
                          </span>
                        </span>
                        <ClaimLines claims={item.claims} labels={names} icons={icons} locale={language} />
                      </label>
                    </li>
                  );
                })}
              </ul>
              {activity?.truncated && (
                <p className="pt-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                  {labels.truncated.replace('{count}', String(activity.transactions))}
                </p>
              )}
            </div>
          )}
        </ToolSection>
      )}

      <BatchRunner
        t={t}
        batches={batches}
        resetKey={`${locker}:${account}:${chosen.map((i) => `${i.claimant}${i.claims.length}`).join(',')}`}
        blockedReason={blockedReason}
        sendLabel={labels.button.replace('{count}', String(chosen.length))}
        // Each committed batch changes what is left: read it again.
        onSent={() => {
          for (const key of ['locker-waiting', 'locker-activity']) void queryClient.invalidateQueries({ queryKey: [key] });
        }}
      />
    </div>
  );
}
