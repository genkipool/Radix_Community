'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, Inbox, X } from 'lucide-react';

import { RADIX_TOKEN_ADDRESSES } from '@/features/wallet/constants/radix-addresses';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { truncateAddress } from '@/utils/formatters';
import { useAccountResources } from '../../hooks/useAccountResources';
import { useConsoleQueryState } from '../../hooks/useConsoleQueryState';
import { useConsoleTransaction } from '../../hooks/useConsoleTransaction';
import { DEPOSIT_SETTINGS_KEY, useDepositSettings } from '../../hooks/useDepositSettings';
import { useResourceLabelsState } from '../../hooks/useResourceLabels';
import { useTransactionPreview } from '../../hooks/useTransactionPreview';
import {
  DEFAULT_DEPOSIT_RULES,
  depositSettingsManifest,
  type DefaultDepositRule,
  type DepositSettings,
  type ResourcePreference,
} from '../../lib/account-deposits';
import { otherNetworkOf } from '../../lib/address-network';
import { isNonFungibleResource } from '../../lib/bulk-send';
import { accountFromQuery } from '../../lib/console-query';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { AccountPicker } from '../shared/AccountPicker';
import { CollapsibleManifest } from '../shared/CollapsibleManifest';
import { MessageLine } from '../shared/MessageLine';
import { NftIdPickerButton } from '../shared/NftIdPickerButton';
import { OptionButtons } from '../shared/OptionButtons';
import { SimulateResultCard } from '../shared/SimulatePanel';
import { ToolSection } from '../shared/ToolSection';
import { TxActions } from '../shared/TxActions';
import { TxResultBanner } from '../shared/TxResultBanner';
import { AddressField, TextField } from '../shared/fields';

const RULE_ICONS: Record<DefaultDepositRule, React.ReactNode> = {
  Accept: <CheckCircle2 className="size-4" />,
  AllowExisting: <Inbox className="size-4" />,
  Reject: <Ban className="size-4" />,
};

/** A whole resource address of the active network. */
const isResourceOn = (value: string, network: 'mainnet' | 'stokenet') =>
  /^resource_(rdx|tdx_2_)1[0-9a-z]{54}$/.test(value.trim()) && !otherNetworkOf(value.trim(), network);

/**
 * Who may deposit into the account: the default rule, exceptions per
 * resource and authorised depositor badges. It opens with what the ledger has
 * and sends only what changed, signed by the account itself. These rules
 * only stop deposits from others: the owner's own always land.
 */
export default function AccountDepositsTool({ t }: ConsoleToolProps) {
  const labels = t.accountDeposits;
  const { activeNetwork, activeNetworkId } = useRadixWallet();
  const queryClient = useQueryClient();
  const [account, setAccount] = useConsoleQueryState<string | null>(accountFromQuery, null);
  // Edits per account, so switching accounts never carries one's changes to another.
  const [drafts, setDrafts] = useState<Record<string, DepositSettings>>({});
  // The "add" inputs: a valid address joins its list as soon as it is pasted or picked.
  const [newResource, setNewResource] = useState('');
  const [newBadge, setNewBadge] = useState('');
  const { sendTransaction, isSending, result, error, reset } = useConsoleTransaction();
  const preview = useTransactionPreview();

  // Switching accounts keeps the previous one on screen (dimmed) until the new one arrives: no jump.
  const { data: current, isLoading, isPlaceholderData, error: readError } = useDepositSettings(account, activeNetwork, { keepPrevious: true });


  // Only the picked account's own settings can be edited and sent.
  const ready = !!current && !isPlaceholderData;
  const next = account && current ? (ready ? drafts[account] ?? current : current) : undefined;
  const change = (patch: (settings: DepositSettings) => DepositSettings) => {
    if (!account || !next || !ready) return;
    setDrafts((all) => ({ ...all, [account]: patch(next) }));
  };
  const { labels: names, loading: namesLoading } = useResourceLabelsState(
    next ? [...Object.keys(next.preferences), ...next.depositors.map((d) => d.resource)] : [],
  );
  // Null while the name loads: the row holds a placeholder rather than flashing the address first.
  const nameOf = (resource: string) => (namesLoading.has(resource) ? null : names[resource] ?? truncateAddress(resource, 10, 6));

  // What happens today to a token with no exception: what the general rule says, XRD and held tokens
  // passing "only what I hold". A token picked shows this first, so its buttons start from the truth.
  const { data: holdings } = useAccountResources(account);
  const xrd = activeNetworkId ? RADIX_TOKEN_ADDRESSES[activeNetworkId]?.XRD : undefined;
  const held = (resource: string) =>
    resource === xrd || [...(holdings?.fungibles ?? []), ...(holdings?.nonFungibles ?? [])].some((r) => r.resourceAddress === resource);
  const ruleGives = (resource: string, rule: DefaultDepositRule): ResourcePreference =>
    rule === 'Accept' || (rule === 'AllowExisting' && held(resource)) ? 'Allowed' : 'Disallowed';
  const startingPreference = (resource: string) => current?.preferences[resource] ?? ruleGives(resource, next?.defaultRule ?? 'Accept');

  /** The exceptions become exactly these tokens: kept ones as they are, new ones as they behave today. */
  const setExceptionList = (resources: string[]) =>
    change((s) => ({
      ...s,
      preferences: Object.fromEntries(resources.map((r) => [r, s.preferences[r] ?? startingPreference(r)])),
    }));
  const setDepositorList = (resources: string[]) =>
    change((s) => ({ ...s, depositors: resources.map((r) => s.depositors.find((d) => d.resource === r) ?? { resource: r }) }));

  // A valid address typed or pasted joins its list at once.
  const typeException = (input: string) => {
    const resource = input.trim();
    if (!isResourceOn(resource, activeNetwork)) return setNewResource(input);
    setNewResource('');
    if (next && !(resource in next.preferences)) setExceptionList([...Object.keys(next.preferences), resource]);
  };
  const typeDepositor = (input: string) => {
    const resource = input.trim();
    if (!isResourceOn(resource, activeNetwork)) return setNewBadge(input);
    setNewBadge('');
    if (next && !next.depositors.some((d) => d.resource === resource)) setDepositorList([...next.depositors.map((d) => d.resource), resource]);
  };
  // The NFT id narrows a depositor to one NFT of its collection; empty means any of it.
  const setDepositorId = (index: number, nftId: string) =>
    change((s) => ({
      ...s,
      depositors: s.depositors.map((d, i) => (i === index ? { resource: d.resource, ...(nftId.trim() ? { nftId: nftId.trim() } : {}) } : d)),
    }));

  // A new exception that only repeats what the rule already does changes nothing: it is not written.
  const effective: DepositSettings | undefined = next && {
    ...next,
    preferences: Object.fromEntries(
      Object.entries(next.preferences).filter(([r, p]) => r in (current?.preferences ?? {}) || p !== ruleGives(r, next.defaultRule)),
    ),
  };
  const manifest = account && ready && effective ? depositSettingsManifest(account, current, effective) : '';
  const send = async () => {
    if (await sendTransaction(manifest)) {
      if (account) setDrafts(({ [account]: _sent, ...rest }) => rest);
      void queryClient.invalidateQueries({ queryKey: [DEPOSIT_SETTINGS_KEY] });
    }
  };

  const blockedReason = !account ? t.batches.pickAccount : !current ? undefined : !manifest ? labels.noChanges : undefined;

  return (
    <div className="space-y-5">
      <ToolSection title={labels.accountTitle}>
        <AccountPicker value={account} onChange={setAccount} />
      </ToolSection>

      {/* Same shape as the three sections below, so the page does not jump when they arrive. */}
      {account && isLoading && (
        <div className="space-y-5" aria-busy>
          {([['rule', 124], ['exceptions', 150], ['depositors', 150]] as const).map(([section, height]) => (
            <span key={section} className="block rounded-2xl animate-pulse" style={{ height, background: 'var(--color-card-border)' }} />
          ))}
        </div>
      )}
      {readError && (
        <MessageLine tone="error">{labels.readError.replace('{message}', readError instanceof Error ? readError.message : String(readError))}</MessageLine>
      )}

      {next && (
        <div
          className="space-y-5 transition-opacity duration-200"
          style={{ opacity: ready ? 1 : 0.55, pointerEvents: ready ? undefined : 'none' }}
          aria-busy={!ready}
        >
          <ToolSection title={labels.ruleTitle} hint={labels.ruleHint}>
            <OptionButtons<DefaultDepositRule>
              layout="grid"
              className="sm:grid-cols-3"
              size="sm"
              options={DEFAULT_DEPOSIT_RULES.map((rule) => ({
                value: rule,
                label: labels.rules[rule].label,
                description: labels.rules[rule].hint,
                icon: RULE_ICONS[rule],
              }))}
              value={next.defaultRule}
              onChange={(rule) => change((s) => ({ ...s, defaultRule: rule }))}
            />
          </ToolSection>

          <ToolSection title={labels.exceptionsTitle} hint={labels.exceptionsHint}>
            <AddressField
              categories={['resource']}
              value={newResource}
              onChange={typeException}
              placeholder={labels.addException}
              pickerSelected={Object.keys(next.preferences)}
              onPickerConfirm={setExceptionList}
            />
            {Object.keys(next.preferences).length > 0 ? (
              <ul className="divide-y" style={{ borderColor: 'var(--color-card-border)' }}>
                {Object.entries(next.preferences).map(([resource, preference]) => (
                  <li key={resource} className="flex flex-wrap items-center justify-between gap-3 py-2 border-[var(--color-card-border)]">
                    <EntryName name={nameOf(resource)} address={resource} />
                    <span className="flex items-center gap-2">
                      <OptionButtons<ResourcePreference>
                        size="sm"
                        options={[
                          { value: 'Allowed', label: labels.allow },
                          { value: 'Disallowed', label: labels.block },
                        ]}
                        value={preference}
                        onChange={(p) => change((s) => ({ ...s, preferences: { ...s.preferences, [resource]: p } }))}
                      />
                      <RemoveButton
                        label={labels.remove}
                        onClick={() =>
                          change((s) => {
                            const { [resource]: _removed, ...rest } = s.preferences;
                            return { ...s, preferences: rest };
                          })
                        }
                      />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyLine text={labels.noExceptions} />
            )}
          </ToolSection>

          <ToolSection title={labels.depositorsTitle} hint={labels.depositorsHint}>
            <AddressField
              categories={['resource']}
              value={newBadge}
              onChange={typeDepositor}
              placeholder={labels.addDepositor}
              pickerSelected={next.depositors.map((d) => d.resource)}
              onPickerConfirm={setDepositorList}
            />
            {next.depositors.length > 0 ? (
              <ul className="divide-y" style={{ borderColor: 'var(--color-card-border)' }}>
                {next.depositors.map((badge, index) => (
                  <li key={badge.resource + index} className="flex flex-wrap items-center justify-between gap-3 py-2 border-[var(--color-card-border)]">
                    <EntryName name={nameOf(badge.resource)} address={badge.resource} />
                    <span className="flex items-center gap-2">
                      {/* Only an NFT collection can narrow the badge to one of its NFTs. */}
                      {isNonFungibleResource(badge.resource) && (
                        <div className="w-52">
                          <TextField
                            value={badge.nftId ?? ''}
                            onChange={(id) => setDepositorId(index, id)}
                            placeholder={labels.badgeIdPlaceholder}
                            trailingPadding="pr-10"
                            trailing={<NftIdPickerButton resource={badge.resource} value={badge.nftId ?? ''} onSelect={(id) => setDepositorId(index, id)} />}
                          />
                        </div>
                      )}
                      <RemoveButton
                        label={labels.remove}
                        onClick={() => change((s) => ({ ...s, depositors: s.depositors.filter((_, i) => i !== index) }))}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyLine text={labels.noDepositors} />
            )}
          </ToolSection>
        </div>
      )}

      <div className="space-y-4">
        <CollapsibleManifest manifest={manifest} showLabel={labels.showManifest} hideLabel={labels.hideManifest} copyLabel={t.common.copy} />
        <TxActions
          t={t}
          onSend={send}
          onSimulate={() => preview.simulate(manifest)}
          sendDisabled={!manifest || isSending}
          simulateDisabled={!manifest || isSending}
          sending={isSending}
          simulating={preview.isSimulating}
          sendLabel={labels.sendButton}
          sendingLabel={t.common.sending}
          blockedReason={blockedReason}
        />
      </div>
      <SimulateResultCard t={t.simulate} preview={preview.preview} error={preview.error} onClose={preview.reset} />
      <TxResultBanner t={t.common} result={result} error={error} onReset={reset} />
    </div>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-7 place-items-center rounded-lg transition-opacity hover:opacity-70"
      style={{ color: 'var(--color-text-muted)' }}
    >
      <X className="size-4" />
    </button>
  );
}

/** A token's name, with its address underneath. */
function EntryName({ name, address }: { name: string | null; address: string }) {
  return (
    <span className="min-w-0" title={address}>
      {name === null ? (
        <span className="block h-5 w-24 rounded animate-pulse" style={{ background: 'var(--color-card-border)' }} />
      ) : (
        <span className="block h-5 text-sm font-semibold truncate" style={{ color: 'var(--color-text-main)' }}>{name}</span>
      )}
      <span className="block font-mono text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>{truncateAddress(address, 10, 6)}</span>
    </span>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{text}</p>;
}
