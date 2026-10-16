'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Link2, PackagePlus, Undo2, Vault } from 'lucide-react';

import { CopyButton } from '@/components/ui/CopyButton';
import { useLanguage } from '@/context/LanguageContext';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { truncateAddress } from '@/utils/formatters';
import { useAccountResources } from '../../hooks/useAccountResources';
import { useConsoleQueryState } from '../../hooks/useConsoleQueryState';
import { useConsoleTransaction } from '../../hooks/useConsoleTransaction';
import { useKnownAddresses } from '../../hooks/useKnownAddresses';
import { useLockedResources } from '../../hooks/useLockedResources';
import { useResourceLabels } from '../../hooks/useResourceLabels';
import { DEFAULT_BATCH_SIZE, batchRows, fungibleTotals, parseBulkCsv, validateBulkRows, type BulkIssue } from '../../lib/bulk-send';
import { claimantsFor, parseLockerState } from '../../lib/locker-lookup';
import { airdropManifest, createLockerAndAirdropManifest, createLockerManifest } from '../../lib/locker-manifests';
import { otherNetworkOf } from '../../lib/address-network';
import { accountFromQuery, consoleQueryParam, toolQuery } from '../../lib/console-query';
import { heldBadgeFor } from '../../lib/role-lookup';
import type { ConsoleTxResult } from '../../types/console.types';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { bulkIssueText } from '../distribution/bulkIssueText';
import { RecipientListInput } from '../distribution/RecipientListInput';
import { AccountPicker } from '../shared/AccountPicker';
import { BatchRunner } from '../shared/BatchRunner';
import { OptionButtons } from '../shared/OptionButtons';
import { ToolSection } from '../shared/ToolSection';
import { SendToWalletButton } from '../shared/SendToWalletButton';
import { TxResultBanner } from '../shared/TxResultBanner';
import { AddressField } from '../shared/fields';

type LockerMode = 'existing' | 'new';

const lockerFromUrl = () => consoleQueryParam('locker') ?? '';

/**
 * Airdrops through a native AccountLocker: tokens go straight to every account
 * that accepts them, and wait in the locker, claimable, for those that refuse
 * unknown deposits. The badge holder can create the locker, load it from a
 * CSV in batches and share the claim page. Taking back what was never
 * claimed is the "Recover from locker" tool, linked from the locker's details.
 */
export default function LockerAirdropTool({ t }: ConsoleToolProps) {
  const labels = t.locker;
  const { language } = useLanguage();
  const { activeNetwork } = useRadixWallet();
  const { data: known } = useKnownAddresses();

  const [account, setAccount] = useConsoleQueryState<string | null>(accountFromQuery, null);
  const { data: holdings } = useAccountResources(account);
  const [mode, setMode] = useConsoleQueryState<LockerMode>(() => (lockerFromUrl() ? 'existing' : 'new'), 'new');
  const [locker, setLocker] = useConsoleQueryState(lockerFromUrl, '');
  const [allowRecover, setAllowRecover] = useState(true);
  const queryClient = useQueryClient();
  /**
   * The first batch of a new locker goes out in the transaction that creates
   * it; once it commits the tool moves on to that locker, and these
   * recipients are left out of the batches still to send.
   */
  const [sentWithCreation, setSentWithCreation] = useState<{ resource: string; accounts: string[] } | null>(null);
  // The creating transaction's receipt stays on screen after the tool moves on to the new locker.
  const [creationResult, setCreationResult] = useState<ConsoleTxResult | null>(null);
  // An empty locker: to share its claim link or give it a name before any airdrop.
  const createEmpty = useConsoleTransaction();

  const [csv, setCsv] = useState('');
  const [defaultResource, setDefaultResource] = useState('');
  // Safest by default: everything waits in the locker, where a mistyped
  // recipient can still be recovered, instead of leaving the sender for good.
  const [direct, setDirect] = useState(false);

  const lockerAddress = locker.trim();
  const { data: state, isLoading: loadingState } = useQuery({
    queryKey: ['console-locker-state', activeNetwork, lockerAddress],
    enabled: lockerAddress.startsWith('locker_') && !otherNetworkOf(lockerAddress, activeNetwork),
    staleTime: 15_000,
    retry: false,
    queryFn: async () => parseLockerState(await apiFetchEntityDetails(lockerAddress, activeNetwork, true)),
  });

  const fungibles = holdings?.fungibles ?? [];
  const nonFungibles = holdings?.nonFungibles ?? [];
  const storerBadge = state && account ? heldBadgeFor(state.storer, fungibles, nonFungibles) : null;
  const recovererBadge = state && account ? heldBadgeFor(state.recoverer, fungibles, nonFungibles) : null;
  const badgeProof = (b: typeof storerBadge) => (b && account ? { account, resource: b.resource, nonFungibleId: b.localId } : null);

  // ── Airdrop batches ──────────────────────────────────────────────────────
  const parsed = parseBulkCsv(csv, defaultResource.trim());
  const senderHoldings = holdings
    ? {
        fungibles: Object.fromEntries(fungibles.map((f) => [f.resourceAddress, f.amount])),
        nonFungibles: Object.fromEntries(nonFungibles.map((n) => [n.resourceAddress, n.ids])),
      }
    : undefined;
  // Resources that can never leave the account (soulbound) are flagged before the simulation fails on them.
  const locked = useLockedResources(parsed.rows.map((r) => r.resource), activeNetwork);
  const issues: BulkIssue[] = [...parsed.issues, ...validateBulkRows(parsed.rows, activeNetwork, senderHoldings, locked)];
  const resources = [...new Set(parsed.rows.map((r) => r.resource))];
  const names = useResourceLabels(resources);
  const totals = fungibleTotals(parsed.rows);

  const storer = badgeProof(storerBadge);
  const listReady = !!account && parsed.rows.length > 0 && issues.length === 0;
  /** Every batch as recipient chunks, per resource, minus what the creating transaction already sent. */
  const chunks = resources.flatMap((resource) =>
    batchRows(
      claimantsFor(parsed.rows, resource).filter(
        (c) => !(sentWithCreation?.resource === resource && sentWithCreation.accounts.includes(c.account)),
      ),
      DEFAULT_BATCH_SIZE,
    ).map((claimants) => ({ resource, claimants })),
  );

  const existingBatches =
    listReady && state && storer
      ? chunks.map(({ resource, claimants }) => ({
          manifest: airdropManifest({ account: account!, locker: state.address, badge: storer, resource, claimants, tryDirectSend: direct }),
          count: claimants.length,
        }))
      : [];

  // A new locker: one transaction creates it and sends the first batch; the
  // rest can only be built once it exists, with its address.
  const packages = known?.locker_package && known?.resource_package ? { locker: known.locker_package, resource: known.resource_package } : null;
  const firstChunk = chunks[0];
  const newBatches =
    listReady && packages && firstChunk
      ? [
          {
            manifest: createLockerAndAirdropManifest({
              account: account!,
              allowRecover,
              lockerPackage: packages.locker,
              resourcePackage: packages.resource,
              resource: firstChunk.resource,
              claimants: firstChunk.claimants,
              tryDirectSend: direct,
            }),
            count: firstChunk.claimants.length,
            sendLabel: labels.createAndSend,
          },
        ]
      : [];
  const batches = mode === 'new' ? newBatches : existingBatches;

  /** Moves the tool onto a locker that has just been created. */
  const switchToCreated = (created: string) => {
    setLocker(created);
    setMode('existing');
    // The new badge has to show up in the account before the next batches can prove it.
    void queryClient.invalidateQueries({ queryKey: ['console-account-resources'] });
  };

  const emptyManifest = account && packages ? createLockerManifest({ account, allowRecover, lockerPackage: packages.locker }) : '';
  const createEmptyLocker = async () => {
    const result = await createEmpty.sendTransaction(emptyManifest);
    const created = result?.createdEntities.find((a) => a.startsWith('locker_'));
    if (created) {
      setSentWithCreation(null);
      switchToCreated(created);
    }
  };

  /** The creating transaction committed: move on to the new locker for whatever is left. */
  const onBatchSent = (index: number, result: ConsoleTxResult) => {
    if (mode !== 'new' || index !== 0 || !firstChunk) return;
    const created = result.createdEntities.find((a) => a.startsWith('locker_'));
    if (!created) return;
    setCreationResult(result);
    setSentWithCreation({ resource: firstChunk.resource, accounts: firstChunk.claimants.map((c) => c.account) });
    switchToCreated(created);
  };

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const claimLink = state ? `${origin}/${language}/console/locker-claim?locker=${state.address}` : '';

  const ruleLabel = (held: boolean, rule: { type: string }) =>
    rule.type === 'allowAll' ? labels.ruleAnyone : rule.type === 'denyAll' ? labels.ruleNobody : held ? labels.youHold : labels.youDontHold;

  return (
    <div className="space-y-5">
      <ToolSection title={t.common.fromAccount}>
        <AccountPicker value={account} onChange={setAccount} />
      </ToolSection>

      <ToolSection title={labels.lockerTitle} hint={labels.lockerHint}>
        <OptionButtons<LockerMode>
          layout="grid"
          className="sm:grid-cols-2"
          size="sm"
          options={[
            { value: 'new', label: labels.modeNew, description: labels.modeNewHint, icon: <PackagePlus className="size-4" /> },
            { value: 'existing', label: labels.modeExisting, description: labels.modeExistingHint, icon: <Vault className="size-4" /> },
          ]}
          value={mode}
          onChange={(next) => {
            setMode(next);
            setSentWithCreation(null);
            setCreationResult(null);
          }}
        />
        {mode === 'new' ? (
          <div className="space-y-4">
            <OptionButtons
              layout="grid"
              className="sm:grid-cols-2"
              size="sm"
              options={[
                { value: 'yes', label: labels.recoverOn, description: labels.recoverOnHint },
                { value: 'no', label: labels.recoverOff, description: labels.recoverOffHint },
              ]}
              value={allowRecover ? 'yes' : 'no'}
              onChange={(v) => setAllowRecover(v === 'yes')}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <AddressField
              categories={['locker']}
              value={locker}
              onChange={(next) => {
                setLocker(next);
                setSentWithCreation(null);
              }}
              placeholder="locker_rdx1…"
              error={!loadingState && lockerAddress.startsWith('locker_') && state === null ? labels.notALocker : undefined}
              reserveMessage
            />
            {loadingState && <span className="block h-16 rounded-xl animate-pulse" style={{ background: 'var(--color-card-border)' }} />}
            {state && (
              <div className="space-y-1 rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--color-card-border)', background: 'var(--color-surface)' }}>
                <p>
                  <span style={{ color: 'var(--color-text-muted)' }}>{labels.storerLabel}: </span>
                  {ruleLabel(!!storerBadge, state.storer)}
                </p>
                <p>
                  <span style={{ color: 'var(--color-text-muted)' }}>{labels.recovererLabel}: </span>
                  {ruleLabel(!!recovererBadge, state.recoverer)}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Link2 className="size-3.5" style={{ color: 'var(--color-primary)' }} />
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{labels.claimLink}</span>
                  <span className="font-mono text-xs break-all">{truncateAddress(claimLink, 40, 12)}</span>
                  <CopyButton value={claimLink} size="xs" variant="ghost" title={t.common.copy} />
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{labels.claimLinkHint}</p>
                {state.recoverer.type !== 'denyAll' && (
                  <Link
                    href={`/${language}/console/locker-recover?${toolQuery({ locker: state.address, account })}`}
                    className="inline-flex items-center gap-1.5 pt-1 text-xs font-bold hover:underline"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    <Undo2 className="size-3.5" />
                    {t.tools['locker-recover'].title}
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </ToolSection>


      <RecipientListInput
        t={t}
        title={t.bulkSend.listTitle}
        csv={csv}
        onCsvChange={setCsv}
        defaultResource={defaultResource}
        onDefaultResourceChange={setDefaultResource}
      />

      <ToolSection title={labels.airdropTitle} hint={labels.airdropHint}>
        <OptionButtons
          layout="grid"
          className="sm:grid-cols-2"
          size="sm"
          options={[
            { value: 'store', label: labels.directOff, description: labels.directOffHint },
            { value: 'direct', label: labels.directOn, description: labels.directOnHint },
          ]}
          value={direct ? 'direct' : 'store'}
          onChange={(v) => setDirect(v === 'direct')}
        />
        {parsed.rows.length > 0 && (
          <ul className="space-y-1 text-sm">
            <li>{t.bulkSend.recipients.replace('{count}', String(new Set(parsed.rows.map((r) => r.account)).size))}</li>
            {Object.entries(totals).map(([resource, total]) => (
              <li key={resource} title={resource}>
                {t.bulkSend.total.replace('{amount}', total).replace('{resource}', names[resource] ?? truncateAddress(resource, 10, 6))}
              </li>
            ))}
          </ul>
        )}
        {issues.slice(0, 20).map((issue, i) => (
          <p key={i} className="text-xs" style={{ color: 'var(--color-danger)' }}>
            {bulkIssueText(issue, t.bulkSend.issues, names)}
          </p>
        ))}
      </ToolSection>

      {/* Always shown: what is missing is said under the buttons until the batches are ready. */}
      <BatchRunner
        t={t}
        batches={batches}
        resetKey={`${mode}:${allowRecover}:${account}:${state?.address}:${direct}:${csv.length}:${csv.slice(-64)}:${defaultResource}`}
        onSent={onBatchSent}
        sendLabel={mode === 'new' ? labels.createAndSend : labels.airdropButton}
        leading={
          mode === 'new' ? (
            // The wallet button's look: this one also goes to the phone to be signed.
            <div title={labels.createEmptyHint}>
              <SendToWalletButton
                onClick={createEmptyLocker}
                disabled={!emptyManifest || createEmpty.isSending}
                loading={createEmpty.isSending}
                label={labels.createEmpty}
                loadingLabel={t.common.sending}
              />
            </div>
          ) : undefined
        }
        note={mode === 'new' && chunks.length > 1 ? labels.restAfterCreate.replace('{count}', String(chunks.length - 1)) : undefined}
        blockedReason={
          !account
            ? t.batches.pickAccount
            : mode === 'existing' && !state
              ? t.batches.needsLocker
              : mode === 'existing' && !storerBadge
                ? labels.needsStorer
                : parsed.rows.length === 0
                  ? t.batches.noRecipients
                  : issues.length > 0
                    ? t.batches.fixIssues
                    : sentWithCreation && chunks.length === 0
                      ? labels.allSent
                      : undefined
        }
      />
      <TxResultBanner
        t={t.common}
        result={creationResult}
        error={null}
        onReset={() => setCreationResult(null)}
        createdEntityLabel={labels.created}
      />

      <TxResultBanner t={t.common} result={createEmpty.result} error={createEmpty.error} onReset={createEmpty.reset} createdEntityLabel={labels.created} />

    </div>
  );
}
