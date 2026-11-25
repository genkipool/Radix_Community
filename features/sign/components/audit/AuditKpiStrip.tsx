'use client';

import { AlertTriangle, CheckCircle2, Clock, FileCheck2, Users } from 'lucide-react';
import type { AuditKpis } from '../../lib/collection-audit';
import type { AuditLabels } from './AuditFormatters';

/**
 * Clean executive metric strip with explicit theme-colored hairlines
 * (`border-[var(--color-card-border)]`, zero harsh black `divide-*` borders).
 */
export function AuditKpiStrip({
  kpis,
  labels,
  onSelectAnomalies,
}: {
  kpis: AuditKpis;
  labels: AuditLabels;
  onSelectAnomalies: () => void;
}) {
  const hasAnomalies = kpis.anomalyCount > 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 border-y border-[var(--color-card-border)] divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-card-border)]">
      <KpiCell
        icon={<FileCheck2 className="size-3.5 text-[var(--color-text-muted)]" />}
        label={labels.kpis.total}
        value={String(kpis.totalRecords)}
      />
      <KpiCell
        icon={<CheckCircle2 className="size-3.5 text-[var(--color-success)]" />}
        label={labels.kpis.completed}
        value={String(kpis.completeCount)}
        sub={labels.kpis.ofRequests.replace('{rate}', String(kpis.completionRate))}
      />
      <KpiCell
        icon={<Clock className="size-3.5 text-[var(--color-warning)]" />}
        label={labels.kpis.pending}
        value={String(kpis.pendingCount)}
      />
      <KpiCell
        icon={<Users className="size-3.5 text-[var(--color-primary)]" />}
        label={labels.kpis.uniqueSigners}
        value={String(kpis.uniqueSigners)}
      />
      <button
        type="button"
        onClick={hasAnomalies ? onSelectAnomalies : undefined}
        disabled={!hasAnomalies}
        className={`col-span-2 sm:col-span-1 flex flex-col justify-center px-3 py-3 text-left transition-colors ${
          hasAnomalies ? 'cursor-pointer hover:bg-[var(--color-surface)]/40' : 'cursor-default'
        }`}
      >
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-text-muted)]">
          <AlertTriangle
            className="size-3.5"
            style={{
              color: hasAnomalies ? 'var(--color-danger)' : 'var(--color-success)',
            }}
          />
          {labels.kpis.anomalies}
        </span>
        <span
          className="mt-1 text-xl font-bold tabular-nums"
          style={{
            color: hasAnomalies ? 'var(--color-danger)' : 'var(--color-text-main)',
          }}
        >
          {kpis.anomalyCount}
        </span>
      </button>
    </div>
  );
}

function KpiCell({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col justify-center px-3 py-3">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-text-muted)]">
        {icon}
        {label}
      </span>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-xl font-bold tabular-nums text-[var(--color-text-main)]">
          {value}
        </span>
        {sub && (
          <span className="text-[11px] font-medium text-[var(--color-text-muted)]">
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}
