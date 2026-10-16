'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Gift } from 'lucide-react';

import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { gatewayPost } from '@/services/gateway/bases';
import { truncateAddress } from '@/utils/formatters';
import { useAccountLockerList } from '../../hooks/useAccountLockerList';
import { useConsoleQueryState } from '../../hooks/useConsoleQueryState';
import { useConsoleTransaction } from '../../hooks/useConsoleTransaction';
import { useResourceLabels } from '../../hooks/useResourceLabels';
import { useTransactionPreview } from '../../hooks/useTransactionPreview';
import { otherNetworkOf } from '../../lib/address-network';
import { accountFromQuery } from '../../lib/console-query';
import { fetchLockerClaims, type LockerClaim } from '../../lib/locker-lookup';
import { claimFromLockersManifest } from '../../lib/locker-manifests';
import type { GatewayPost } from '../../lib/resource-holders';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { AccountPicker } from '../shared/AccountPicker';
import { CollapsibleManifest } from '../shared/CollapsibleManifest';
import { MessageLine } from '../shared/MessageLine';
import { MultiAddressSelect, addressesFromUrl } from '../shared/MultiAddressSelect';
import { SimulateResultCard } from '../shared/SimulatePanel';
import { ToolSection } from '../shared/ToolSection';
import { TxActions } from '../shared/TxActions';
import { TxResultBanner } from '../shared/TxResultBanner';

/** What waits, per locker and then per wallet account. */
type WaitingMap = Record<string, Record<string, LockerClaim[]>>;

/**
 * The recipient's side of locker airdrops: what is waiting for the account in
 * one or several lockers, and one transaction that claims all of it (simulated
 * first if you like). The wallet account the lockers hold something for is
 * picked by itself; picking an account drops the lockers that hold nothing for
 * it. Only the account itself can claim (the engine checks its owner rule), so
 * a shared link is safe.
 */
export default function LockerClaimTool({ t }: ConsoleToolProps) {
  const labels = t.lockerClaim;
  const { activeNetwork, accounts } = useRadixWallet();
  const [account, setAccount] = useConsoleQueryState<string | null>(accountFromQuery, null);
  const [lockers, setLockers] = useConsoleQueryState<string[]>(() => addressesFromUrl('locker'), []);
  const { sendTransaction, isSending, result, error, reset } = useConsoleTransaction();
  const preview = useTransactionPreview();

  // The account's own lockers, offered as one-tap toggles.
  const { data: own } = useAccountLockerList(account, activeNetwork);
  const suggestions = (own ?? []).map((l) => ({
    address: l.address,
    label: l.name || truncateAddress(l.address, 10, 6),
    description: l.name ? truncateAddress(l.address, 8, 6) : undefined,
  }));
  const nameOf = (locker: string) => own?.find((l) => l.address === locker)?.name || truncateAddress(locker, 12, 6);

  // Everything waiting for every wallet account in every chosen locker: it
  // drives what is shown, which account is picked and what each pick keeps.
  const walletAccounts = accounts.map((a) => a.address).filter((a) => !otherNetworkOf(a, activeNetwork));
  const { data: waiting, isLoading, error: claimsError, refetch } = useQuery({
    queryKey: ['console-locker-claims-all', activeNetwork, lockers.join(','), walletAccounts.join(',')],
    enabled: lockers.length > 0 && walletAccounts.length > 0,
    staleTime: 10_000,
    retry: false,
    queryFn: async (): Promise<WaitingMap> => {
      const post: GatewayPost = (path, body) => gatewayPost(activeNetwork, path, body);
      const rows = await Promise.all(
        lockers.flatMap((locker) =>
          walletAccounts.map(async (who) => [locker, who, await fetchLockerClaims(post, locker, who).catch(() => [])] as const),
        ),
      );
      const map: WaitingMap = {};
      for (const [locker, who, claims] of rows) (map[locker] ??= {})[who] = claims;
      return map;
    },
  });
  const claimsOf = (locker: string, who: string | null) => (who ? waiting?.[locker]?.[who] ?? [] : []);
  const hasClaims = (who: string | null) => lockers.some((l) => claimsOf(l, who).length > 0);

  // Picks by itself the account the lockers hold something for, once per set of lockers.
  const lockerKey = lockers.join(',');
  const firstWithClaims = walletAccounts.find(hasClaims);
  const [autoPickedFor, setAutoPickedFor] = useState('');
  if (waiting && firstWithClaims && autoPickedFor !== lockerKey && !hasClaims(account)) {
    setAutoPickedFor(lockerKey);
    setAccount(firstWithClaims);
  }
  const pickAccount = (next: string) => {
    setAccount(next);
    // Lockers that hold nothing for this account are not its to claim from.
    if (waiting) setLockers(lockers.filter((l) => !(next in (waiting[l] ?? {})) || claimsOf(l, next).length > 0));
  };

  const withClaims = lockers.map((locker) => ({ locker, claims: claimsOf(locker, account) }));
  const names = useResourceLabels(withClaims.flatMap((l) => l.claims.map((c) => c.resource)));
  const manifest = account ? claimFromLockersManifest({ account, lockers: withClaims }) : '';

  const claim = async () => {
    if (await sendTransaction(manifest)) void refetch();
  };

  return (
    <div className="space-y-5">
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
          placeholder="locker_rdx1…"
        />
      </ToolSection>

      {lockers.length > 0 && (
        <ToolSection title={labels.waitingTitle}>
          {!account ? (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{labels.pickAccount}</p>
          ) : isLoading ? (
            <span className="block h-16 rounded-xl animate-pulse" style={{ background: 'var(--color-card-border)' }} />
          ) : claimsError ? (
            <MessageLine tone="error">
              {labels.error.replace('{message}', claimsError instanceof Error ? claimsError.message : String(claimsError))}
            </MessageLine>
          ) : (
            <div className="space-y-4">
              {withClaims.map(({ locker, claims }) => (
                <div key={locker} className="space-y-1.5">
                  <span className="block text-xs font-bold" style={{ color: 'var(--color-text-main)' }} title={locker}>
                    {nameOf(locker)}
                  </span>
                  {claims.length > 0 ? (
                    <ul className="space-y-1.5">
                      {claims.map((c) => (
                        <li key={c.resource} className="flex items-center gap-2 text-sm" title={c.resource}>
                          <Gift className="size-4 shrink-0" style={{ color: 'var(--color-primary)' }} />
                          <span className="font-semibold">{c.nftIds ? `${c.nftIds.length} NFT` : c.amount}</span>
                          <span>{names[c.resource] ?? truncateAddress(c.resource, 10, 6)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{labels.nothing}</p>
                  )}
                </div>
              ))}
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
