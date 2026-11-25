'use client';

import { useEffect } from 'react';
import {
  BadgeCheck,
  Globe,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import { SidePanelControls } from '@/components/shared/SidePanelControls';
import { SidePanelModal } from '@/components/shared/SidePanelModal';
import { useSidePanelControls } from '@/components/shared/hooks/useSidePanelControls';
import { CopyButton } from '@/components/ui/CopyButton';
import { useLanguage } from '@/context/LanguageContext';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { truncateAddress } from '@/utils/formatters';
import {
  buildDnsTxtRecord,
  buildWellKnownSnippet,
  buildWellKnownUrl,
  type DomainVerificationResult,
} from '../../lib/domain-verify';
import { networkIdFromResource } from '../../lib/network';
import type { CollectionLabels } from './CollectionPrimitives';

export { DomainStatusButton } from '../DomainVerifiedBadge';

/**
 * Console-style slide-over side drawer explaining and testing custody-free
 * domain verification (`/.well-known/radix-seal.json` or DNS TXT
 * `_radix-seal.<domain>`) for a signing collection on Mainnet or Stokenet.
 */
export function DomainVerificationDrawer({
  isOpen,
  onClose,
  labels,
  collection,
  domain,
  result,
  checking,
  error,
  onCheckNow,
}: {
  isOpen: boolean;
  onClose: () => void;
  labels: CollectionLabels['identity']['domainVerify'];
  collection: string;
  domain: string | null;
  result: DomainVerificationResult | null;
  checking: boolean;
  error: boolean;
  onCheckNow: () => void;
}) {
  const { t } = useLanguage();
  const {
    isPinned,
    togglePin,
    handlePiP,
    handlePopupWindow,
    externalWindow,
    closeExternalWindow,
    resetPin,
  } = useSidePanelControls('domainVerifyPinned');

  const isStandaloneMode = !!externalWindow;

  const handleClose = () => {
    resetPin();
    closeExternalWindow();
    onClose();
  };

  useEffect(() => {
    if (!isOpen || isPinned || isStandaloneMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        resetPin();
        closeExternalWindow();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isPinned, isStandaloneMode, onClose, resetPin, closeExternalWindow]);

  const verified = !!result?.verified && result.domain === domain;
  const wellKnownUrl = domain ? buildWellKnownUrl(domain) : '';
  const wellKnownJson = buildWellKnownSnippet(collection);
  const dnsRecord = domain ? buildDnsTxtRecord(domain, collection) : null;
  const networkId = networkIdFromResource(collection);
  const networkLabel =
    networkId === RadixNetworkId.Mainnet
      ? 'Mainnet'
      : networkId === RadixNetworkId.Stokenet
        ? 'Stokenet'
        : null;

  return (
    <SidePanelModal
      isOpen={isOpen}
      onClose={handleClose}
      isStandalone={isStandaloneMode}
      isPinned={isPinned}
      portalTarget={externalWindow ? externalWindow.document.body : undefined}
    >
      <div className="flex flex-col h-full">
        {/* Header — matches Console ToolInfoModal guide drawer */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 bg-[var(--color-surface)]/85 mb-2">
          <div className="flex items-center gap-4 min-w-0">
            <div className="size-10 rounded-full bg-gradient-to-tr from-[var(--color-primary)] to-[var(--color-accent)] flex items-center justify-center shrink-0 shadow-lg shadow-[var(--color-primary)]/20">
              {verified ? (
                <BadgeCheck className="size-5 text-white" strokeWidth={2} />
              ) : (
                <Globe className="size-5 text-white" strokeWidth={2} />
              )}
            </div>
            <h2 className="text-lg font-bold tracking-tight text-[var(--color-text-main)] truncate">
              {labels.title}
            </h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <SidePanelControls
              isPinned={isPinned}
              togglePin={togglePin}
              handlePiP={handlePiP}
              handlePopupWindow={handlePopupWindow}
              pinText={t.nav?.wallet_pin_sidebar || 'Anclar como barra lateral'}
              unpinText={
                t.nav?.wallet_pin_sidebar_remove || 'Desanclar barra lateral'
              }
              pipText={
                t.nav?.wallet_picture_in_picture ||
                'Convertir a ventana picture in picture'
              }
              popupText={
                t.nav?.wallet_popup_window || 'Convertir en ventana emergente'
              }
            />
            <button
              type="button"
              onClick={handleClose}
              aria-label={labels.closeLabel}
              className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-bg)] transition-colors opacity-80 hover:opacity-100 duration-300 cursor-pointer"
            >
              <X strokeWidth={2} className="size-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-5 custom-scrollbar">
          <div className="space-y-6">
            <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
              {labels.hint}
            </p>

            {/* Target collection + network badge */}
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5"
              style={{
                borderColor: 'var(--color-card-border)',
                background: 'var(--color-surface)',
              }}
            >
              <div className="min-w-0">
                <span
                  className="block text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {labels.collectionLabel}
                </span>
                <span
                  className="block truncate font-mono text-xs"
                  style={{ color: 'var(--color-text-main)' }}
                  title={collection}
                >
                  {truncateAddress(collection)}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {networkLabel && (
                  <span
                    className="rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      borderColor: 'var(--color-card-border)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    {networkLabel}
                  </span>
                )}
                <CopyButton value={collection} variant="minimal" size="xs" />
              </div>
            </div>

            {!domain ? (
              <div
                className="flex items-start gap-2.5 rounded-xl border p-4 text-xs leading-relaxed"
                style={{
                  borderColor: 'var(--color-card-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-muted)',
                }}
              >
                <Globe className="size-4 shrink-0 mt-0.5" />
                <span>{labels.needUrl}</span>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Live status + plain right-aligned Check now action */}
                <div
                  className="rounded-xl border p-3.5 space-y-2.5"
                  style={{
                    borderColor: verified
                      ? 'var(--color-success)'
                      : 'var(--color-card-border)',
                    background: verified
                      ? 'color-mix(in srgb, var(--color-success) 10%, transparent)'
                      : 'var(--color-surface)',
                  }}
                >
                  <div
                    className="flex items-start gap-2 text-xs font-semibold leading-relaxed"
                    style={{
                      color: verified
                        ? 'var(--color-success)'
                        : 'var(--color-text-muted)',
                    }}
                  >
                    {verified ? (
                      <BadgeCheck className="size-4 shrink-0 mt-0.5" />
                    ) : (
                      <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                    )}
                    <span>
                      {verified && result
                        ? labels.verifiedStatus
                            .replace('{domain}', result.domain ?? domain)
                            .replace(
                              '{method}',
                              result.method === 'dns-txt'
                                ? 'DNS TXT'
                                : '.well-known/radix-seal.json',
                            )
                        : labels.unverifiedStatus.replace('{domain}', domain)}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={checking}
                      onClick={onCheckNow}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] transition-opacity hover:opacity-80 cursor-pointer disabled:opacity-40"
                    >
                      <RefreshCw
                        className={`size-3.5 ${checking ? 'animate-spin' : ''}`}
                      />
                      {checking ? labels.checking : labels.checkNow}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-[var(--color-danger)]">
                    {labels.checkError}
                  </p>
                )}

                {/* Option A: /.well-known/radix-seal.json */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-xs font-bold"
                      style={{ color: 'var(--color-text-main)' }}
                    >
                      {labels.wellKnownTitle}
                    </span>
                    <CopyButton
                      value={wellKnownJson}
                      variant="minimal"
                      size="xs"
                    />
                  </div>
                  <p
                    className="font-mono text-[11px] break-all"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {wellKnownUrl}
                  </p>
                  <pre
                    className="overflow-x-auto rounded-xl border p-3 font-mono text-[11px] leading-relaxed"
                    style={{
                      background: 'var(--color-surface)',
                      borderColor: 'var(--color-card-border)',
                      color: 'var(--color-text-main)',
                    }}
                  >
                    {wellKnownJson}
                  </pre>
                </div>

                {/* Option B: DNS TXT record */}
                {dnsRecord && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-xs font-bold"
                        style={{ color: 'var(--color-text-main)' }}
                      >
                        {labels.dnsTitle}
                      </span>
                      <CopyButton
                        value={dnsRecord.value}
                        variant="minimal"
                        size="xs"
                      />
                    </div>
                    <div
                      className="rounded-xl border p-3 font-mono text-[11px] space-y-1 break-all"
                      style={{
                        background: 'var(--color-surface)',
                        borderColor: 'var(--color-card-border)',
                        color: 'var(--color-text-main)',
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          TXT{' '}
                        </span>
                        {dnsRecord.host}
                      </div>
                      <div>{dnsRecord.value}</div>
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-1">
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {labels.note}
                  </p>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {labels.accountOptionalNote}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SidePanelModal>
  );
}
