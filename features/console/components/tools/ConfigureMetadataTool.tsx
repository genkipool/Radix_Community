'use client';

import { useState } from 'react';
import { Lock, Search } from 'lucide-react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { truncateAddress } from '@/utils/formatters';
import { useAccountResources } from '../../hooks/useAccountResources';
import { useConsoleTransaction } from '../../hooks/useConsoleTransaction';
import { useTransactionPreview } from '../../hooks/useTransactionPreview';
import { useEntityMetadata, type MetadataEntity, type MetadataEntityKind } from '../../hooks/useEntityMetadata';
import { buildBadgeProofManifest } from '../../lib/badge-proof-manifest';
import {
  getMetadataItem,
  removeMetadata,
  setAddressArrayMetadata,
  setAddressMetadata,
  setOriginArrayMetadata,
  setStringArrayMetadata,
  setStringMetadata,
  setUrlMetadata,
  typedMetadataToString,
} from '../../lib/metadata-manifests';
import type { BadgeProofSelection } from '../../types/console.types';
import type { ConsoleDictionary } from '../../types/i18n.types';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { ToolSection } from '../shared/ToolSection';
import { AccountPicker } from '../shared/AccountPicker';
import { OptionButtons } from '../shared/OptionButtons';
import { TextField, TextAreaField, AddressField, ALL_ADDRESS_CATEGORIES } from '../shared/fields';
import { StringListField } from '../shared/StringListField';
import { TwoWayLinkStatus, type TwoWayLinkKind } from '../shared/TwoWayLinkStatus';
import { BadgeProofPicker } from '../shared/BadgeProofPicker';
import { SendToWalletButton } from '../shared/SendToWalletButton';
import { TxResultBanner } from '../shared/TxResultBanner';
import { SimulateButton, SimulateResultCard } from '../shared/SimulatePanel';

/* ─── Field definitions per entity kind ───────────────────────────────────── */

type FieldKind = 'string' | 'url' | 'address' | 'stringArray' | 'addressArray' | 'originArray';

interface MetaFieldDef {
  key: string;
  kind: FieldKind;
  /** Rendered as a multi-row list editor instead of a single input */
  list?: boolean;
  multiline?: boolean;
  /** Only relevant for accounts flagged as dApp definition */
  dappDefinitionOnly?: boolean;
}

const DISPLAY_FIELDS: Record<MetadataEntityKind, MetaFieldDef[]> = {
  account: [
    { key: 'name', kind: 'string' },
    { key: 'description', kind: 'string', multiline: true },
    { key: 'tags', kind: 'stringArray' },
    { key: 'icon_url', kind: 'url' },
    { key: 'account_locker', kind: 'address', dappDefinitionOnly: true },
  ],
  fungible: [
    { key: 'name', kind: 'string' },
    { key: 'symbol', kind: 'string' },
    { key: 'description', kind: 'string', multiline: true },
    { key: 'tags', kind: 'stringArray' },
    { key: 'icon_url', kind: 'url' },
    { key: 'info_url', kind: 'url' },
  ],
  nonFungible: [
    { key: 'name', kind: 'string' },
    { key: 'description', kind: 'string', multiline: true },
    { key: 'tags', kind: 'stringArray' },
    { key: 'icon_url', kind: 'url' },
    { key: 'info_url', kind: 'url' },
  ],
  component: [
    { key: 'name', kind: 'string' },
    { key: 'description', kind: 'string', multiline: true },
    { key: 'tags', kind: 'stringArray' },
  ],
  package: [
    { key: 'name', kind: 'string' },
    { key: 'description', kind: 'string', multiline: true },
    { key: 'tags', kind: 'stringArray' },
  ],
  validator: [
    { key: 'name', kind: 'string' },
    { key: 'description', kind: 'string', multiline: true },
    { key: 'icon_url', kind: 'url' },
    { key: 'info_url', kind: 'url' },
  ],
};

const VERIFICATION_FIELDS: Record<MetadataEntityKind, MetaFieldDef[]> = {
  account: [
    { key: 'claimed_entities', kind: 'addressArray', list: true },
    { key: 'claimed_websites', kind: 'originArray', list: true },
    { key: 'dapp_definitions', kind: 'addressArray', list: true },
  ],
  fungible: [{ key: 'dapp_definitions', kind: 'addressArray', list: true }],
  nonFungible: [{ key: 'dapp_definitions', kind: 'addressArray', list: true }],
  component: [{ key: 'dapp_definition', kind: 'address' }],
  package: [{ key: 'dapp_definition', kind: 'address' }],
  validator: [],
};

type FormValue = string | string[];
type FormState = Record<string, FormValue>;

const DAPP_DEFINITION = 'dapp definition';
const ACCOUNT_TYPE_KEY = 'account_type';

/* ─── Form state helpers ──────────────────────────────────────────────────── */

function initialFormState(entity: MetadataEntity): { form: FormState; locked: Set<string> } {
  const form: FormState = {};
  const locked = new Set<string>();
  const defs = [...DISPLAY_FIELDS[entity.kind], ...VERIFICATION_FIELDS[entity.kind]];

  for (const def of defs) {
    const item = getMetadataItem(entity.metadataItems, def.key);
    if (item?.is_locked) locked.add(def.key);
    if (def.list) {
      const values = item?.value?.typed?.values;
      form[def.key] = Array.isArray(values) ? values.map(String) : [];
    } else {
      form[def.key] = typedMetadataToString(item?.value?.typed);
    }
  }

  if (entity.kind === 'account') {
    const accountType = getMetadataItem(entity.metadataItems, ACCOUNT_TYPE_KEY);
    if (accountType?.is_locked) locked.add(ACCOUNT_TYPE_KEY);
    form[ACCOUNT_TYPE_KEY] =
      typedMetadataToString(accountType?.value?.typed) === DAPP_DEFINITION ? DAPP_DEFINITION : '';
  }

  return { form, locked };
}

function fieldToManifest(entityAddress: string, def: MetaFieldDef, value: FormValue): string {
  if (def.list) {
    const values = (value as string[]).map((v) => v.trim()).filter(Boolean);
    if (values.length === 0) return removeMetadata(entityAddress, def.key);
    return def.kind === 'originArray'
      ? setOriginArrayMetadata(entityAddress, def.key, values)
      : setAddressArrayMetadata(entityAddress, def.key, values);
  }

  const scalar = (value as string).trim();
  if (def.kind === 'stringArray') {
    const tags = scalar.split(',').map((tag) => tag.trim()).filter(Boolean);
    return tags.length
      ? setStringArrayMetadata(entityAddress, def.key, tags)
      : removeMetadata(entityAddress, def.key);
  }
  if (!scalar) return removeMetadata(entityAddress, def.key);
  if (def.kind === 'url') return setUrlMetadata(entityAddress, def.key, scalar);
  if (def.kind === 'address') return setAddressMetadata(entityAddress, def.key, scalar);
  return setStringMetadata(entityAddress, def.key, scalar);
}

function fieldError(
  def: MetaFieldDef,
  value: FormValue,
  t: ConsoleDictionary['metadata'],
): string | undefined {
  if (def.list) {
    const values = (value as string[]).map((v) => v.trim()).filter(Boolean);
    if (def.kind === 'originArray' && values.some((v) => v.endsWith('/'))) {
      return t.invalidTrailingSlash;
    }
    return undefined;
  }
  const scalar = (value as string).trim();
  if (!scalar) return undefined;
  if (def.kind === 'url' && !scalar.startsWith('https://')) return t.invalidHttps;
  if (def.key === 'account_locker' && !scalar.startsWith('locker_')) return t.invalidLocker;
  return undefined;
}

/* ─── Metadata form (rendered once an entity is loaded) ───────────────────── */

function MetadataForm({ t, entity }: { t: ConsoleDictionary; entity: MetadataEntity }) {
  const common = t.common;
  const labels = t.metadata;
  const { isLoading: walletLoading } = useRadixWallet();

  const [initial] = useState(() => initialFormState(entity));
  const [form, setForm] = useState<FormState>(initial.form);
  const [proofAccount, setProofAccount] = useState<string | null>(null);
  const [proof, setProof] = useState<BadgeProofSelection | null>(null);

  const { data: proofHoldings } = useAccountResources(proofAccount);
  const { sendTransaction, isSending, result, error, reset } = useConsoleTransaction();
  const preview = useTransactionPreview();

  const locked = initial.locked;
  const isDappDefinition = form[ACCOUNT_TYPE_KEY] === DAPP_DEFINITION;

  const setValue = (key: string, value: FormValue) => setForm((prev) => ({ ...prev, [key]: value }));

  const visibleDefs = (defs: MetaFieldDef[]) =>
    defs.filter((def) => {
      if (!def.dappDefinitionOnly) return true;
      return isDappDefinition || (form[def.key] as string)?.trim();
    });

  const displayDefs = visibleDefs(DISPLAY_FIELDS[entity.kind]);
  const verificationDefs = visibleDefs(VERIFICATION_FIELDS[entity.kind]);
  const allDefs = [...displayDefs, ...verificationDefs];

  const changedDefs = allDefs.filter(
    (def) => !locked.has(def.key) && JSON.stringify(form[def.key]) !== JSON.stringify(initial.form[def.key]),
  );
  const accountTypeChanged =
    entity.kind === 'account' &&
    !locked.has(ACCOUNT_TYPE_KEY) &&
    form[ACCOUNT_TYPE_KEY] !== initial.form[ACCOUNT_TYPE_KEY];

  const hasErrors = allDefs.some((def) => fieldError(def, form[def.key], labels));
  const hasChanges = changedDefs.length > 0 || accountTypeChanged;
  const canSend = hasChanges && !hasErrors && !isSending && !walletLoading;

  const buildManifest = () => {
    const instructions: string[] = [];
    if (proof) instructions.push(buildBadgeProofManifest([proof]));
    if (accountTypeChanged) {
      instructions.push(
        form[ACCOUNT_TYPE_KEY] === DAPP_DEFINITION
          ? setStringMetadata(entity.address, ACCOUNT_TYPE_KEY, DAPP_DEFINITION)
          : removeMetadata(entity.address, ACCOUNT_TYPE_KEY),
      );
    }
    for (const def of changedDefs) {
      instructions.push(fieldToManifest(entity.address, def, form[def.key]));
    }
    return instructions.join('');
  };

  const handleSend = () => {
    sendTransaction(buildManifest());
  };

  const handleSimulate = () => {
    preview.simulate(buildManifest());
  };

  const fieldLabels = labels.fields as Record<string, string>;

  const renderField = (def: MetaFieldDef) => {
    const isLocked = locked.has(def.key);
    const label = fieldLabels[def.key] ?? def.key;
    const labelEnd = isLocked ? (
      <span
        className="inline-flex items-center gap-1 text-[11px] font-semibold"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <Lock className="size-3" />
        {labels.locked}
      </span>
    ) : undefined;
    const errorMessage = fieldError(def, form[def.key], labels);
    const placeholderKey = `${def.key.replace(/_(.)/g, (_, c: string) => c.toUpperCase())}Placeholder`;
    const placeholder = fieldLabels[placeholderKey];

    // Verification fields get live two-way link checks per declared value
    const linkKind: TwoWayLinkKind | null =
      def.key === 'claimed_websites'
        ? 'website'
        : ['claimed_entities', 'dapp_definitions', 'dapp_definition'].includes(def.key)
          ? 'entity'
          : null;

    const linkStatuses = (values: string[]) =>
      linkKind && values.some((v) => v.trim()) ? (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {values.flatMap((v, i) =>
            v.trim()
              ? [<TwoWayLinkStatus key={`${v}-${i}`} t={labels} kind={linkKind} value={v} entityAddress={entity.address} />]
              : [],
          )}
        </div>
      ) : null;

    if (def.list) {
      return (
        <div key={def.key}>
          <StringListField
            label={label}
            values={form[def.key] as string[]}
            onChange={(values) => setValue(def.key, values)}
            placeholder={placeholder}
            addLabel={labels.addItem}
            disabled={isSending || isLocked}
            error={errorMessage}
          />
          {linkStatuses(form[def.key] as string[])}
        </div>
      );
    }
    if (def.multiline) {
      return (
        <TextAreaField
          key={def.key}
          label={label}
          labelEnd={labelEnd}
          value={form[def.key] as string}
          onChange={(value) => setValue(def.key, value)}
          placeholder={placeholder}
          rows={3}
          disabled={isSending || isLocked}
          error={errorMessage}
        />
      );
    }
    return (
      <div key={def.key}>
        <TextField
          label={label}
          labelEnd={labelEnd}
          value={form[def.key] as string}
          onChange={(value) => setValue(def.key, value)}
          placeholder={placeholder}
          disabled={isSending || isLocked}
          error={errorMessage}
        />
        {linkStatuses([form[def.key] as string])}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <ToolSection title={labels.display}>
        {entity.kind === 'account' && (
          <div className="flex flex-col gap-4">
            <span className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              {labels.accountType}
            </span>
            <OptionButtons
              options={[
                { value: '', label: labels.accountTypeUnset },
                { value: DAPP_DEFINITION, label: labels.accountTypeSet },
              ]}
              value={form[ACCOUNT_TYPE_KEY] as string}
              onChange={(value) => setValue(ACCOUNT_TYPE_KEY, value)}
              size="sm"
              disabled={isSending || locked.has(ACCOUNT_TYPE_KEY)}
            />
          </div>
        )}
        {displayDefs.map(renderField)}
      </ToolSection>

      {verificationDefs.length > 0 && (
        <ToolSection title={labels.verification}>
          {verificationDefs.map(renderField)}
        </ToolSection>
      )}

      <ToolSection title={labels.proofs} hint={labels.proofsHint}>
        <AccountPicker value={proofAccount} onChange={setProofAccount} disabled={isSending} />
        <BadgeProofPicker
          label={common.createProof}
          noneLabel={labels.proofNone}
          accountAddress={proofAccount}
          holdings={proofHoldings}
          value={proof}
          onChange={setProof}
          disabled={isSending}
        />
      </ToolSection>

      <TxResultBanner t={common} result={result} error={error} onReset={reset}  preview={preview.preview} />
      <SimulateResultCard t={t.simulate} preview={preview.preview} error={preview.error} onClose={preview.reset} />

      <div className="flex items-center gap-4">
        <SendToWalletButton
          onClick={handleSend}
          disabled={!canSend || preview.isSimulating}
          loading={isSending}
          label={common.sendToWallet}
          loadingLabel={common.sending}
        />
        <SimulateButton
          t={t.simulate}
          onClick={handleSimulate}
          disabled={!canSend || isSending}
          loading={preview.isSimulating}
        />
      </div>
    </div>
  );
}

/* ─── Tool (entity search + form) ─────────────────────────────────────────── */

export default function ConfigureMetadataTool({ t }: ConsoleToolProps) {
  const labels = t.metadata;
  const { accounts } = useRadixWallet();

  const [addressInput, setAddressInput] = useState('');
  const [loadedAddress, setLoadedAddress] = useState<string | null>(null);

  const { data: entity, isFetching, isError } = useEntityMetadata(loadedAddress);

  const load = (address: string) => {
    const trimmed = address.trim();
    if (!trimmed) return;
    setAddressInput(trimmed);
    setLoadedAddress(trimmed);
  };

  const typeLabels: Record<string, string> = {
    account: labels.type_account,
    fungible: labels.type_fungible,
    nonFungible: labels.type_nonFungible,
    component: labels.type_component,
    validator: labels.type_validator,
    package: labels.type_package,
  };

  return (
    <div className="space-y-5">
      <ToolSection title={labels.searchLabel}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <AddressField
              value={addressInput}
              onChange={setAddressInput}
              placeholder={labels.searchPlaceholder}
              error={isError ? labels.loadError : undefined}
              categories={ALL_ADDRESS_CATEGORIES}
            />
          </div>
          <button
            type="button"
            onClick={() => load(addressInput)}
            disabled={!addressInput.trim() || isFetching}
            className="inline-flex items-center justify-center gap-2 px-5 h-11 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          >
            {isFetching ? (
              <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            {labels.load}
          </button>
        </div>

        {accounts.length > 0 && (
          <div className="flex flex-col gap-4">
            <span className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              {labels.myAccounts}
            </span>
            <div className="flex flex-wrap gap-2">
              {accounts.map((account, index) => (
                <button
                  key={account.address}
                  type="button"
                  onClick={() => load(account.address)}
                  className="flex-1 text-center px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all hover:opacity-90 active:scale-95 cursor-pointer"
                  style={{
                    background: loadedAddress === account.address
                      ? 'rgba(var(--color-primary-rgb), 0.1)'
                      : 'var(--color-surface)',
                    borderColor: loadedAddress === account.address
                      ? 'var(--color-primary)'
                      : 'var(--color-card-border)',
                    color: loadedAddress === account.address
                      ? 'var(--color-primary)'
                      : 'var(--color-text-muted)',
                  }}
                >
                  {account.label || `Account ${index + 1}`} · {truncateAddress(account.address, 6, 5)}
                </button>
              ))}
            </div>
          </div>
        )}

        {entity && (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {labels.entityType}:{' '}
            <span className="font-semibold" style={{ color: 'var(--color-text-main)' }}>
              {typeLabels[entity.kind]}
            </span>
          </p>
        )}
      </ToolSection>

      {entity && <MetadataForm key={`${entity.address}-${entity.kind}`} t={t} entity={entity} />}
    </div>
  );
}
