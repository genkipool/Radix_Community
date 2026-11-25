'use client';

import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Link2,
  ShieldCheck,
} from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { Portal } from '@/components/ui/Portal';
import { SafeImage } from '@/components/ui/SafeImage';
import { SelectPopup, SelectPopupRow } from '@/components/ui/SelectPopup';
import { usePickerPopup } from '@/features/console/hooks/usePickerPopup';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { truncateAddress } from '@/utils/formatters';
import { DomainStatusButton } from '../collection/DomainVerificationDrawer';
import {
  entityExplorerHref,
  type AuditExportFormat,
  type AuditHeaderProps,
} from './AuditFormatters';

export type { AuditExportFormat };

/**
 * Compact header for the audited collection: identity name (as a `SelectPopup`
 * switcher when owned collections exist), network badge, truncated address,
 * and Share / Export actions.
 */
export function AuditHeader({
  audit,
  labels,
  domainVerifyLabels,
  domainVerification,
  domainChecking,
  onOpenDomainDrawer,
  locale,
  exporting,
  includeAliases,
  ownedCollections = [],
  onSelectCollection,
  onToggleIncludeAliases,
  onCopyShareLink,
  onExport,
}: AuditHeaderProps) {
  const [linkCopied, setLinkCopied] = useState(false);

  const {
    open: collectionOpen,
    show: showCollection,
    close: closeCollection,
    buttonRef: collectionButtonRef,
    popupRef: collectionPopupRef,
    layoutFor: collectionLayoutFor,
  } = usePickerPopup();
  const collectionLayout = collectionLayoutFor(340);

  const {
    open: exportOpen,
    show: showExport,
    close: closeExport,
    buttonRef: exportButtonRef,
    popupRef: exportPopupRef,
    layoutFor: exportLayoutFor,
  } = usePickerPopup();
  const exportLayout = exportLayoutFor(310);

  const isTestnet = audit.networkId === RadixNetworkId.Stokenet;
  const displayName =
    audit.issuer.orgName || audit.issuer.name || truncateAddress(audit.collection, 10, 6);
  const canSwitchCollection = !!onSelectCollection && ownedCollections.length > 0;

  const handleShare = async () => {
    await onCopyShareLink();
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <SafeImage
          src={audit.issuer.iconUrl ?? undefined}
          alt={displayName}
          fallbackName={displayName}
          className="size-10 shrink-0 rounded-xl border border-[var(--color-card-border)] object-cover"
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {canSwitchCollection ? (
              <div>
                <button
                  ref={collectionButtonRef}
                  type="button"
                  onClick={() => (collectionOpen ? closeCollection() : showCollection())}
                  aria-expanded={collectionOpen}
                  title={labels.selector.myCollections}
                  className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 -ml-1.5 text-left text-base font-bold text-[var(--color-text-main)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-primary)]"
                >
                  <span className="truncate max-w-[280px] sm:max-w-[380px]">{displayName}</span>
                  <ChevronDown
                    className={`size-4 shrink-0 text-[var(--color-text-muted)] transition-transform ${
                      collectionOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <Portal>
                  <AnimatePresence>
                    {collectionOpen && (
                      <SelectPopup
                        ref={collectionPopupRef}
                        title={labels.selector.myCollections}
                        onClose={closeCollection}
                        closeLabel={labels.filters.closePopup}
                        direction={collectionLayout.direction}
                        style={{
                          ...collectionLayout.style,
                          height: 'auto',
                          maxHeight: collectionLayout.style.height,
                        }}
                      >
                        {ownedCollections.map((c) => (
                          <SelectPopupRow
                            key={c.resourceAddress}
                            selected={c.resourceAddress === audit.collection}
                            label={c.name || truncateAddress(c.resourceAddress, 10, 6)}
                            sublabel={truncateAddress(c.resourceAddress, 12, 8)}
                            trailing={
                              <span className="font-mono text-[10px] tabular-nums text-[var(--color-text-muted)]">
                                ({c.totalSupply})
                              </span>
                            }
                            onClick={() => {
                              onSelectCollection(c.resourceAddress);
                              closeCollection();
                            }}
                          />
                        ))}
                      </SelectPopup>
                    )}
                  </AnimatePresence>
                </Portal>
              </div>
            ) : (
              <h2 className="truncate text-base font-bold text-[var(--color-text-main)]">
                {displayName}
              </h2>
            )}

            <span
              title={isTestnet ? labels.network.stokenetNotice : undefined}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{
                background: isTestnet
                  ? 'color-mix(in srgb, var(--color-warning) 14%, transparent)'
                  : 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                color: isTestnet ? 'var(--color-warning)' : 'var(--color-primary)',
              }}
            >
              {isTestnet ? (
                <FlaskConical className="size-3" />
              ) : (
                <ShieldCheck className="size-3" />
              )}
              {isTestnet ? labels.network.stokenet : labels.network.mainnet}
            </span>
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--color-text-muted)]">
            <span
              className="inline-flex items-center gap-1"
              title={labels.tooltips.collectionAddress}
            >
              <a
                href={entityExplorerHref(locale, audit.collection, audit.networkId)}
                target="_blank"
                rel="noopener noreferrer"
                title={audit.collection}
                className="inline-flex items-center gap-1 font-mono text-[var(--color-primary)] hover:underline"
              >
                {truncateAddress(audit.collection, 10, 6)}
                <ExternalLink className="size-3" />
              </a>
              <CopyButton value={audit.collection} variant="minimal" size="xs" />
            </span>

            <DomainStatusButton
              size="xs"
              verified={!!domainVerification?.verified}
              checking={domainChecking}
              verifiedLabel={domainVerifyLabels.verifiedBadge}
              unverifiedLabel={domainVerifyLabels.unverifiedBadge}
              checkingLabel={domainVerifyLabels.checkingBadge}
              title={domainVerifyLabels.badgeTooltip}
              onClick={onOpenDomainDrawer}
            />
          </div>
        </div>
      </div>

      {/* Action buttons (Share + Export) */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => void handleShare()}
          title={labels.header.copyLinkTooltip}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors hover:border-[var(--color-primary)] ${
            linkCopied
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-[var(--color-card-border)] text-[var(--color-text-main)]'
          }`}
        >
          {linkCopied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
          {linkCopied ? labels.header.linkCopied : labels.header.copyLink}
        </button>

        <div>
          <button
            ref={exportButtonRef}
            type="button"
            onClick={() => (exportOpen ? closeExport() : showExport())}
            disabled={exporting !== null}
            aria-expanded={exportOpen}
            title={labels.header.exportTooltip}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Download className="size-3.5" />
            {labels.header.exportButton}
            <ChevronDown
              className={`size-3.5 transition-transform ${exportOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <Portal>
            <AnimatePresence>
              {exportOpen && (
                <SelectPopup
                  ref={exportPopupRef}
                  title={labels.header.exportButton}
                  onClose={closeExport}
                  closeLabel={labels.filters.closePopup}
                  direction={exportLayout.direction}
                  style={{
                    ...exportLayout.style,
                    height: 'auto',
                    maxHeight: exportLayout.style.height,
                  }}
                >
                  {(
                    [
                      ['pdf', labels.header.exportPdf, FileText],
                      ['csv-records', labels.header.exportCsvRecords, FileSpreadsheet],
                      ['csv-signers', labels.header.exportCsvSigners, FileSpreadsheet],
                      ['json', labels.header.exportJson, FileJson],
                    ] as const
                  ).map(([fmt, text, Icon]) => (
                    <SelectPopupRow
                      key={fmt}
                      selected={exporting === fmt}
                      showCheck={false}
                      disabled={exporting !== null}
                      icon={
                        <Icon
                          className="size-4 shrink-0"
                          style={{ color: 'var(--color-primary)' }}
                        />
                      }
                      label={text}
                      onClick={() => {
                        closeExport();
                        void onExport(fmt);
                      }}
                    />
                  ))}

                  <div className="mt-1 border-t border-[var(--color-card-border)] pt-2.5 px-2.5 pb-1">
                    <label className="flex cursor-pointer items-start gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={includeAliases}
                        onChange={(e) => onToggleIncludeAliases(e.target.checked)}
                        className="mt-0.5 accent-[var(--color-primary)]"
                      />
                      <span>
                        <span className="block font-semibold text-[var(--color-text-main)]">
                          {labels.header.includeAliasesLabel}
                        </span>
                        <span className="block text-[11px] leading-snug text-[var(--color-text-muted)]">
                          {labels.header.includeAliasesHint}
                        </span>
                      </span>
                    </label>
                  </div>
                </SelectPopup>
              )}
            </AnimatePresence>
          </Portal>
        </div>
      </div>
    </div>
  );
}
