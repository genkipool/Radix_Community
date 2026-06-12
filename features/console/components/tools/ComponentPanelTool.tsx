'use client';

import { useState } from 'react';
import { Braces, ChevronDown, Database, Eye, PencilLine, Play, ScanSearch, ShieldCheck } from 'lucide-react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { CopyButton } from '@/components/ui/CopyButton';
import { truncateAddress } from '@/utils/formatters';
import { useAccountResources } from '../../hooks/useAccountResources';
import { useComponentBlueprint, type ComponentBlueprint } from '../../hooks/useComponentBlueprint';
import { useConsoleTransaction } from '../../hooks/useConsoleTransaction';
import { useTransactionPreview } from '../../hooks/useTransactionPreview';
import { buildBadgeProofManifest } from '../../lib/badge-proof-manifest';
import {
  RESERVED_METHODS,
  typeHintExample,
  type BlueprintFunction,
  type BlueprintReceiver,
} from '../../lib/blueprint-schema';
import type { BadgeProofSelection } from '../../types/console.types';
import type { ConsoleDictionary } from '../../types/i18n.types';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { ToolSection } from '../shared/ToolSection';
import { AccountPicker } from '../shared/AccountPicker';
import { BadgeProofPicker } from '../shared/BadgeProofPicker';
import { OptionButtons } from '../shared/OptionButtons';
import { TextField, TextAreaField } from '../shared/fields';
import { ManifestCode } from '../shared/ManifestCode';
import { SimulateResultCard } from '../shared/SimulatePanel';
import { TxResultBanner } from '../shared/TxResultBanner';

/* ─── Manifest assembly ───────────────────────────────────────────────────── */

interface ExecutionOptions {
  proof: BadgeProofSelection | null;
  depositAccount: string | null;
}

function buildCallManifest(
  blueprint: ComponentBlueprint,
  fn: BlueprintFunction,
  args: string[],
  options: ExecutionOptions,
): string {
  const argLines = args.map((arg) => `    ${arg}`).join('\n');
  const call =
    fn.receiver === 'function'
      ? `
CALL_FUNCTION
    Address("${blueprint.packageAddress}")
    "${blueprint.blueprintName}"
    "${fn.name}"${argLines ? `\n${argLines}` : ''}
;
`
      : `
CALL_METHOD
    Address("${blueprint.componentAddress}")
    "${fn.name}"${argLines ? `\n${argLines}` : ''}
;
`;

  const proofPart = options.proof ? buildBadgeProofManifest([options.proof]) : '';
  const depositPart = options.depositAccount
    ? `
CALL_METHOD
    Address("${options.depositAccount}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
`
    : '';
  return proofPart + call + depositPart;
}

/* ─── Receiver chip ───────────────────────────────────────────────────────── */

const RECEIVER_STYLE: Record<BlueprintReceiver, { icon: React.ReactNode; accentRgb: string }> = {
  method: { icon: <Eye className="size-3" />, accentRgb: '16,185,129' },
  mutMethod: { icon: <PencilLine className="size-3" />, accentRgb: '245,158,11' },
  function: { icon: <Braces className="size-3" />, accentRgb: '139,92,246' },
};

function ReceiverChip({ receiver, t }: { receiver: BlueprintReceiver; t: ConsoleDictionary['componentPanel'] }) {
  const style = RECEIVER_STYLE[receiver];
  const labels: Record<BlueprintReceiver, { label: string; hint: string }> = {
    method: { label: t.receiver_method, hint: t.receiver_method_hint },
    mutMethod: { label: t.receiver_mutMethod, hint: t.receiver_mutMethod_hint },
    function: { label: t.receiver_function, hint: t.receiver_function_hint },
  };
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md border cursor-help"
      title={labels[receiver].hint}
      style={{
        color: `rgb(${style.accentRgb})`,
        borderColor: `rgba(${style.accentRgb},0.35)`,
        background: `rgba(${style.accentRgb},0.08)`,
      }}
    >
      {style.icon}
      {labels[receiver].label}
    </span>
  );
}

/* ─── Method card ─────────────────────────────────────────────────────────── */

interface MethodCardProps {
  t: ConsoleDictionary;
  blueprint: ComponentBlueprint;
  fn: BlueprintFunction;
  options: ExecutionOptions;
  onExecute: (fn: BlueprintFunction, manifest: string) => void;
  isSending: boolean;
  isActive: boolean;
}

function MethodCard({ t, blueprint, fn, options, onExecute, isSending, isActive }: MethodCardProps) {
  const labels = t.componentPanel;
  const [argValues, setArgValues] = useState<string[]>([]);
  const [rawArgs, setRawArgs] = useState('');
  const [showManifest, setShowManifest] = useState(false);
  const preview = useTransactionPreview();

  const isReserved = RESERVED_METHODS.has(fn.name);
  const resolvedArgs =
    fn.inputs !== null
      ? fn.inputs.map((_, index) => (argValues[index] ?? '').trim())
      : rawArgs.split('\n').map((line) => line.trim()).filter(Boolean);
  const argsComplete = fn.inputs === null || resolvedArgs.every((arg) => arg.length > 0);
  const manifest = buildCallManifest(blueprint, fn, resolvedArgs.filter(Boolean), options);

  return (
    <div
      className="rounded-2xl border p-4 space-y-3"
      style={{ background: 'var(--color-card-bg)', borderColor: 'var(--color-card-border)', opacity: isReserved ? 0.55 : 1 }}
      title={isReserved ? labels.reservedHint : undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        <code className="text-sm font-bold" style={{ color: 'var(--color-text-main)' }}>
          {fn.name}
        </code>
        <ReceiverChip receiver={fn.receiver} t={labels} />
        <div className="flex-1" />
        {!isReserved && (
          <>
            <button
              type="button"
              onClick={() => setShowManifest((prev) => !prev)}
              aria-expanded={showManifest}
              className="inline-flex items-center gap-1 text-[11px] font-semibold transition-colors hover:text-[var(--color-accent)] cursor-pointer"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <ChevronDown className={`size-3 transition-transform ${showManifest ? 'rotate-180' : ''}`} />
              {showManifest ? labels.hideManifest : labels.viewManifest}
            </button>
            <button
              type="button"
              disabled={!argsComplete || isSending || preview.isSimulating}
              onClick={() => preview.simulate(manifest)}
              title={t.simulate.buttonHint}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-bold border transition-all hover:-translate-y-px active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-card-border)',
                color: 'var(--color-text-main)',
              }}
            >
              {preview.isSimulating ? (
                <span className="size-3 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
              ) : null}
              {t.simulate.button}
            </button>
            <button
              type="button"
              disabled={!argsComplete || isSending}
              onClick={() => onExecute(fn, manifest)}
              title={labels.executeHint}
              className="inline-flex items-center gap-1.5 px-3.5 h-8 rounded-full text-xs font-bold text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              {isActive && isSending ? (
                <span className="size-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <Play className="size-3" />
              )}
              {labels.execute}
            </button>
          </>
        )}
      </div>

      {!isReserved && fn.inputs !== null && fn.inputs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {fn.inputs.map((input, index) => (
            <TextField
              key={input.name}
              label={input.name}
              value={argValues[index] ?? ''}
              onChange={(value) =>
                setArgValues((prev) => {
                  const next = [...prev];
                  next[index] = value;
                  return next;
                })
              }
              placeholder={typeHintExample(input.typeHint)}
              hint={labels.argHint.replace('{type}', input.typeHint)}
              disabled={isSending}
            />
          ))}
        </div>
      )}

      {!isReserved && fn.inputs === null && (
        <TextAreaField
          label={labels.rawArgs}
          hint={labels.rawArgsHint}
          value={rawArgs}
          onChange={setRawArgs}
          rows={2}
          mono
          disabled={isSending}
        />
      )}

      {!isReserved && showManifest && <ManifestCode code={manifest} />}
      {!isReserved && <SimulateResultCard t={t.simulate} preview={preview.preview} error={preview.error} />}
    </div>
  );
}

/* ─── Tool ────────────────────────────────────────────────────────────────── */

export default function ComponentPanelTool({ t }: ConsoleToolProps) {
  const common = t.common;
  const labels = t.componentPanel;
  const { isLoading: walletLoading, accounts } = useRadixWallet();

  const [addressInput, setAddressInput] = useState('');
  const [loadedAddress, setLoadedAddress] = useState<string | null>(null);
  const { data: blueprint, isFetching, isError } = useComponentBlueprint(loadedAddress);

  const [proofAccount, setProofAccount] = useState<string | null>(null);
  const [proof, setProof] = useState<BadgeProofSelection | null>(null);
  const { data: proofHoldings } = useAccountResources(proofAccount);
  const [depositEnabled, setDepositEnabled] = useState(true);
  const [depositAccount, setDepositAccount] = useState<string | null>(accounts[0]?.address ?? null);

  const { sendTransaction, isSending, result, error, reset } = useConsoleTransaction();
  const [activeMethod, setActiveMethod] = useState<string | null>(null);

  const options: ExecutionOptions = {
    proof,
    depositAccount: depositEnabled ? depositAccount : null,
  };

  const execute = async (fn: BlueprintFunction, manifest: string) => {
    setActiveMethod(fn.name);
    await sendTransaction(manifest);
    setActiveMethod(null);
  };

  const methods = (blueprint?.functions ?? [])
    .filter((fn) => fn.receiver !== 'function')
    .sort((a, b) => a.name.localeCompare(b.name));
  const functions = (blueprint?.functions ?? [])
    .filter((fn) => fn.receiver === 'function')
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-5">
      <ToolSection title={labels.searchLabel}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <TextField
              value={addressInput}
              onChange={setAddressInput}
              placeholder={labels.searchPlaceholder}
              error={isError ? labels.loadError : undefined}
            />
          </div>
          <button
            type="button"
            onClick={() => addressInput.trim() && setLoadedAddress(addressInput.trim())}
            disabled={!addressInput.trim() || isFetching}
            title={labels.loadHint}
            className="inline-flex items-center justify-center gap-2 px-5 h-11 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          >
            {isFetching ? (
              <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <ScanSearch className="size-4" />
            )}
            {labels.load}
          </button>
        </div>

        {blueprint && (
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <span>
              {labels.infoBlueprint}:{' '}
              <code className="font-bold" style={{ color: 'var(--color-text-main)' }}>{blueprint.blueprintName}</code>
              {blueprint.version && <span className="ml-1.5">v{blueprint.version}</span>}
            </span>
            <span className="inline-flex items-center gap-1" title={blueprint.packageAddress}>
              {labels.infoPackage}:{' '}
              <code style={{ color: 'var(--color-text-main)' }}>{truncateAddress(blueprint.packageAddress, 10, 6)}</code>
              <CopyButton value={blueprint.packageAddress} size="xs" variant="minimal" />
            </span>
          </div>
        )}
      </ToolSection>

      {blueprint && (
        <>
          {(blueprint.stateFields.length > 0 || blueprint.roles) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {blueprint.stateFields.length > 0 && (
                <ToolSection
                  title={labels.stateTitle}
                  hint={labels.stateHint}
                >
                  <div className="space-y-1.5">
                    {blueprint.stateFields.map((field) => (
                      <div key={field.name} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                        <Database className="size-3 shrink-0 self-center" style={{ color: 'var(--color-text-muted)' }} />
                        <code className="font-bold" style={{ color: 'var(--color-text-main)' }}>{field.name}</code>
                        <span style={{ color: 'var(--color-text-muted)' }}>{field.typeName}</span>
                        {field.value && (
                          <code
                            className="truncate max-w-full"
                            title={field.value}
                            style={{ color: 'var(--color-primary)' }}
                          >
                            {field.value.length > 40 ? `${field.value.slice(0, 40)}…` : field.value}
                          </code>
                        )}
                      </div>
                    ))}
                  </div>
                </ToolSection>
              )}
              {blueprint.roles && (
                <ToolSection title={labels.rolesTitle} hint={labels.rolesHint}>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-3 shrink-0" style={{ color: 'var(--color-primary)' }} />
                      <code className="font-bold" style={{ color: 'var(--color-text-main)' }}>owner</code>
                      <span style={{ color: 'var(--color-text-muted)' }}>{blueprint.roles.owner}</span>
                    </div>
                    {blueprint.roles.entries.map((entry, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <ShieldCheck className="size-3 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                        <code style={{ color: 'var(--color-text-main)' }}>
                          {entry.module !== 'Main' ? `${entry.module}: ` : ''}
                          {entry.name}
                        </code>
                        <span style={{ color: 'var(--color-text-muted)' }}>{entry.rule}</span>
                      </div>
                    ))}
                  </div>
                </ToolSection>
              )}
            </div>
          )}

          <ToolSection title={labels.options} hint={labels.optionsHint}>
            <AccountPicker value={proofAccount} onChange={setProofAccount} disabled={isSending} />
            <BadgeProofPicker
              label={common.createProof}
              noneLabel={t.metadata.proofNone}
              accountAddress={proofAccount}
              holdings={proofHoldings}
              value={proof}
              onChange={setProof}
              disabled={isSending}
            />
            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider cursor-help" style={{ color: 'var(--color-text-muted)' }} title={labels.depositHint}>
                {labels.depositLabel}
              </span>
              <OptionButtons
                options={[
                  { value: 'on', label: labels.depositOn, title: labels.depositHint },
                  { value: 'off', label: labels.depositOff },
                ]}
                value={depositEnabled ? 'on' : 'off'}
                onChange={(value) => setDepositEnabled(value === 'on')}
                size="sm"
                disabled={isSending}
              />
              {depositEnabled && (
                <AccountPicker value={depositAccount} onChange={setDepositAccount} disabled={isSending} />
              )}
            </div>
          </ToolSection>

          <ToolSection title={labels.methods} hint={labels.methodsHint}>
            {methods.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{labels.noMethods}</p>
            ) : (
              <div className="space-y-3">
                {methods.map((fn) => (
                  <MethodCard
                    key={fn.name}
                    t={t}
                    blueprint={blueprint}
                    fn={fn}
                    options={options}
                    onExecute={execute}
                    isSending={isSending || walletLoading}
                    isActive={activeMethod === fn.name}
                  />
                ))}
              </div>
            )}
          </ToolSection>

          {functions.length > 0 && (
            <ToolSection title={labels.functions} hint={labels.functionsHint}>
              <div className="space-y-3">
                {functions.map((fn) => (
                  <MethodCard
                    key={fn.name}
                    t={t}
                    blueprint={blueprint}
                    fn={fn}
                    options={options}
                    onExecute={execute}
                    isSending={isSending || walletLoading}
                    isActive={activeMethod === fn.name}
                  />
                ))}
              </div>
            </ToolSection>
          )}
        </>
      )}

      <TxResultBanner t={common} result={result} error={error} onReset={reset} />
    </div>
  );
}
