'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Circle,
  Copy,
  FileSignature,
  RefreshCw,
  Send,
} from 'lucide-react';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { AccountPicker } from '@/features/console/components/shared/AccountPicker';
import {
  SimulateButton,
  SimulateResultCard,
} from '@/features/console/components/shared/SimulatePanel';
import { useTransactionPreview } from '@/features/console/hooks/useTransactionPreview';
import type { ConsoleDictionary } from '@/features/console/types/i18n.types';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useSigningRequest } from '../hooks/useSigningRequest';
import {
  buildSigningRequestManifest,
  buildSignatureManifest,
} from '../lib/manifest';
import { fetchOnChainStatus } from '../services/signApi';
import type { SignDictionary } from '../types/dictionary';
import type { DisclosurePolicy } from '../types/sign.types';

/**
 * On-ledger "by reference" multi-party signing. The initiator mints a request
 * NFT and shares its link; each signer opens it, uploads the document and mints
 * their own signature NFT. Status is read back from the ledger.
 */
export function OnChainSignPanel({
  t,
  consoleT,
  docHash,
  requiredSigners,
  disclosure,
  initialRequestId,
}: {
  t: SignDictionary;
  consoleT: ConsoleDictionary;
  docHash: string;
  requiredSigners: string[];
  disclosure: DisclosurePolicy;
  initialRequestId?: string;
}) {
  const { activeNetworkId } = useRadixWallet();
  const { createRequest, sign, phase } = useSigningRequest();
  const preview = useTransactionPreview();
  const [account, setAccount] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(initialRequestId ?? '');
  const [keyInput, setKeyInput] = useState(initialRequestId ?? '');
  const [copied, setCopied] = useState(false);

  const verifyUrl =
    docHash && typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?verify=${docHash}`
      : undefined;

  const statusQuery = useQuery({
    queryKey: ['sign-onchain-status', activeNetworkId, requestId],
    queryFn: () =>
      fetchOnChainStatus({ networkId: activeNetworkId!, requestId }),
    enabled: !!requestId && !!activeNetworkId,
  });
  const status = statusQuery.data?.found ? statusQuery.data : null;
  const busy = phase === 'creating' || phase === 'signing';

  const shareUrl =
    requestId && typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?req=${encodeURIComponent(requestId)}`
      : '';

  const onCreate = async (initiatorSigns: boolean) => {
    if (!account || !docHash) return;
    const id = await createRequest({
      account,
      docHash,
      disclosure,
      requiredSigners,
      initiatorSigns,
      verifyUrl,
    });
    if (id) setRequestId(id);
  };

  const simulateCreate = () => {
    if (!account || !docHash) return;
    preview.simulate(
      buildSigningRequestManifest({
        accountAddress: account,
        docHash,
        networkId: activeNetworkId ?? 2,
        disclosure,
        requiredSigners,
        initiatorSigned: true,
        verifyUrl,
      }),
    );
  };

  const onSign = async () => {
    if (!account || !status?.docHash || !requestId) return;
    const ok = await sign({ account, docHash: status.docHash, requestId });
    if (ok) statusQuery.refetch();
  };

  const simulateSign = () => {
    if (!account || !status?.docHash || !requestId) return;
    preview.simulate(
      buildSignatureManifest({
        accountAddress: account,
        docHash: status.docHash,
        networkId: activeNetworkId ?? 2,
        requestId,
      }),
    );
  };

  const copy = () => {
    navigator.clipboard?.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const hashMismatch = !!status?.docHash && !!docHash && status.docHash !== docHash;
  const loading = statusQuery.isFetching;
  const notFound =
    !!requestId && !statusQuery.isFetching && statusQuery.data?.found === false;

  // ── Create mode (no request yet) ──
  if (!requestId) {
    return (
      <div className="space-y-4">
        <ToolSection title={t.onchain.account}>
          <AccountPicker value={account} onChange={setAccount} disabled={busy} />
          {!docHash && (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {t.onchain.needFile}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              disabled={!account || !docHash || busy}
              onClick={() => onCreate(true)}
              className="flex w-full items-center justify-center gap-2 px-6 h-12 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              {phase === 'creating' ? (
                <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <FileSignature className="size-4" />
              )}
              {phase === 'creating' ? t.onchain.creating : t.onchain.createSign}
            </button>
            <button
              type="button"
              disabled={!account || !docHash || busy}
              onClick={() => onCreate(false)}
              className="flex w-full items-center justify-center gap-2 px-6 h-12 rounded-full font-bold text-sm border transition-all hover:opacity-80 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-main)' }}
            >
              {t.onchain.create}
            </button>
          </div>
          <SimulateButton
            t={consoleT.simulate}
            onClick={simulateCreate}
            disabled={!account || !docHash || busy}
            loading={preview.isSimulating}
          />
          <SimulateResultCard
            t={consoleT.simulate}
            preview={preview.preview}
            error={preview.error}
            onClose={preview.reset}
          />
        </ToolSection>

        <ManualKey
          t={t}
          value={keyInput}
          onChange={setKeyInput}
          onLoad={() => setRequestId(keyInput.trim())}
          busy={busy}
        />
      </div>
    );
  }

  // ── Request loaded: share + sign + status ──
  return (
    <div className="space-y-4">
      {shareUrl && (
        <ToolSection title={t.onchain.shareTitle} hint={t.onchain.shareHint}>
          <div className="flex gap-2">
            <input
              readOnly
              value={shareUrl}
              className="flex-1 rounded-xl border px-3 py-2 text-xs font-mono outline-none"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-card-border)',
                color: 'var(--color-text-main)',
              }}
            />
            <button
              type="button"
              onClick={copy}
              className="flex items-center gap-1.5 px-4 rounded-xl border font-bold text-xs"
              style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-main)' }}
            >
              <Copy className="size-3.5" />
              {copied ? t.onchain.copied : t.onchain.copy}
            </button>
          </div>
        </ToolSection>
      )}

      <ToolSection title={t.onchain.account}>
        {status?.docHash && (
          <p className="font-mono text-[11px] break-all" style={{ color: 'var(--color-text-muted)' }}>
            {t.onchain.requestHash}: {status.docHash}
          </p>
        )}
        {hashMismatch && (
          <p className="text-sm" style={{ color: 'var(--color-danger, #dc2626)' }}>
            {t.onchain.fileMismatch}
          </p>
        )}
        {notFound && (
          <p className="text-sm" style={{ color: 'var(--color-danger, #dc2626)' }}>
            {t.onchain.notFound}
          </p>
        )}
        {!docHash && (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {t.onchain.needFile}
          </p>
        )}
        <AccountPicker value={account} onChange={setAccount} disabled={busy} />
        <button
          type="button"
          disabled={!account || !docHash || hashMismatch || !status || busy}
          onClick={onSign}
          className="flex w-full items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          {phase === 'signing' ? (
            <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {phase === 'signing' ? t.onchain.signing : t.onchain.sign}
        </button>
        <SimulateButton
          t={consoleT.simulate}
          onClick={simulateSign}
          disabled={!account || !status || busy}
          loading={preview.isSimulating}
        />
        <SimulateResultCard
          t={consoleT.simulate}
          preview={preview.preview}
          error={preview.error}
          onClose={preview.reset}
        />
      </ToolSection>

      <ToolSection
        title={t.onchain.statusTitle}
        action={
          <button
            type="button"
            onClick={() => statusQuery.refetch()}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? t.onchain.checking : t.onchain.refresh}
          </button>
        }
      >
        {status?.signatures && (
          <>
            <p
              className="text-sm font-semibold"
              style={{ color: status.complete ? '#10b981' : 'var(--color-text-muted)' }}
            >
              {status.signatures.filter((s) => s.signed).length} {t.onchain.of}{' '}
              {status.signatures.length}
              {status.complete ? ` · ${t.onchain.complete}` : ''}
            </p>
            <ul className="space-y-1.5 text-sm">
              {status.signatures.map((s) => (
                <li key={s.account} className="flex items-center gap-2">
                  {s.signed ? (
                    <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="size-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                  )}
                  <span
                    className="font-mono text-[12px] break-all"
                    style={{ color: 'var(--color-text-main)' }}
                  >
                    {s.account}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </ToolSection>

      <ManualKey
        t={t}
        value={keyInput}
        onChange={setKeyInput}
        onLoad={() => setRequestId(keyInput.trim())}
        busy={busy}
      />
    </div>
  );
}

function ManualKey({
  t,
  value,
  onChange,
  onLoad,
  busy,
}: {
  t: SignDictionary;
  value: string;
  onChange: (v: string) => void;
  onLoad: () => void;
  busy: boolean;
}) {
  return (
    <ToolSection title={t.onchain.keyLabel}>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t.onchain.keyPlaceholder}
          disabled={busy}
          className="flex-1 rounded-xl border px-3 py-2 text-xs font-mono outline-none"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-card-border)',
            color: 'var(--color-text-main)',
          }}
        />
        <button
          type="button"
          onClick={onLoad}
          disabled={busy || !value.trim()}
          className="px-4 rounded-xl border font-bold text-xs disabled:opacity-40"
          style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-main)' }}
        >
          {t.onchain.load}
        </button>
      </div>
    </ToolSection>
  );
}
