'use client';

import { ExternalLink, FlaskConical } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { truncateAddress } from '@/utils/formatters';
import type {
  AuditKpis,
  CollectionAuditResponse,
} from '../../lib/collection-audit';
import {
  entityExplorerHref,
  formatUtcTimestamp,
  type AuditLabels,
} from './AuditFormatters';
import { AuditKpiStrip } from './AuditKpiStrip';

/**
 * Overview sub-tab of the Audit workspace: testnet notice, executive KPI
 * strip, issuing account & website metadata, and ledger cutoff timestamp.
 */
export function AuditOverviewTab({
  audit,
  kpis,
  labels,
  locale,
  onSelectAnomalies,
}: {
  audit: CollectionAuditResponse;
  kpis: AuditKpis;
  labels: AuditLabels;
  locale: string;
  onSelectAnomalies: () => void;
}) {
  return (
    <div className="space-y-5">
      {audit.networkId === RadixNetworkId.Stokenet && (
        <div className="flex items-start gap-2.5 border-l-2 border-[var(--color-warning)] pl-3 py-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-[var(--color-warning)]" />
          <span>{labels.network.stokenetNotice}</span>
        </div>
      )}

      <AuditKpiStrip
        kpis={kpis}
        labels={labels}
        onSelectAnomalies={onSelectAnomalies}
      />

      <dl className="border-y border-[var(--color-card-border)] divide-y divide-[var(--color-card-border)] text-xs">
        {audit.issuer.account && (
          <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <dt
              className="text-[var(--color-text-muted)]"
              title={labels.tooltips.issuerAccount}
            >
              {labels.header.issuerLabel}
            </dt>
            <dd className="inline-flex items-center gap-1.5 font-mono">
              <a
                href={entityExplorerHref(
                  locale,
                  audit.issuer.account,
                  audit.networkId,
                )}
                target="_blank"
                rel="noopener noreferrer"
                title={audit.issuer.account}
                className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"
              >
                {truncateAddress(audit.issuer.account, 10, 6)}
                <ExternalLink className="size-3" />
              </a>
              <CopyButton
                value={audit.issuer.account}
                variant="minimal"
                size="xs"
              />
            </dd>
          </div>
        )}

        {audit.issuer.orgUrl && (
          <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <dt className="text-[var(--color-text-muted)]">
              {labels.header.websiteLabel}
            </dt>
            <dd>
              <a
                href={audit.issuer.orgUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-[var(--color-primary)] hover:underline"
              >
                {audit.issuer.orgUrl}
                <ExternalLink className="size-3" />
              </a>
            </dd>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
          <dt
            className="text-[var(--color-text-muted)]"
            title={labels.tooltips.ledgerCutoff}
          >
            {labels.header.ledgerCutoff}
          </dt>
          <dd className="tabular-nums text-[var(--color-text-main)]">
            <strong>
              {audit.ledgerStateVersion != null
                ? `#${audit.ledgerStateVersion.toLocaleString(locale)}`
                : '-'}
            </strong>{' '}
            · {formatUtcTimestamp(audit.ledgerTimestamp, locale).utc}
          </dd>
        </div>
      </dl>

      <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
        <strong className="text-[var(--color-text-main)]">
          {labels.intro.title}.
        </strong>{' '}
        {labels.intro.body}
      </p>
    </div>
  );
}
