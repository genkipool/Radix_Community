'use client';

import { ReactNode } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgeCheck,
  Braces,
  CheckCircle2,
  CircleDot,
  Flame,
  PackageOpen,
  Rocket,
  Sparkles,
  Tags,
  Wallet,
} from 'lucide-react';
import { truncateAddress } from '@/utils/formatters';
import type { FlowLabels, FlowStep, FlowStepKind } from '../../lib/manifest-flow';

/* ─── Per-kind visual identity ────────────────────────────────────────────── */

const KIND_STYLE: Record<FlowStepKind, { icon: ReactNode; gradient: string; accentRgb: string }> = {
  withdraw: { icon: <ArrowUpFromLine className="size-4" />, gradient: 'from-blue-500 to-cyan-400', accentRgb: '59,130,246' },
  take: { icon: <PackageOpen className="size-4" />, gradient: 'from-indigo-500 to-violet-500', accentRgb: '99,102,241' },
  deposit: { icon: <ArrowDownToLine className="size-4" />, gradient: 'from-emerald-500 to-teal-400', accentRgb: '16,185,129' },
  proof: { icon: <BadgeCheck className="size-4" />, gradient: 'from-amber-400 to-orange-500', accentRgb: '245,158,11' },
  metadata: { icon: <Tags className="size-4" />, gradient: 'from-sky-500 to-indigo-500', accentRgb: '14,165,233' },
  create: { icon: <Sparkles className="size-4" />, gradient: 'from-fuchsia-500 to-pink-500', accentRgb: '217,70,239' },
  publish: { icon: <Rocket className="size-4" />, gradient: 'from-violet-600 to-fuchsia-500', accentRgb: '139,92,246' },
  call: { icon: <Braces className="size-4" />, gradient: 'from-slate-500 to-slate-400', accentRgb: '100,116,139' },
  burn: { icon: <Flame className="size-4" />, gradient: 'from-rose-500 to-orange-400', accentRgb: '244,63,94' },
  other: { icon: <CircleDot className="size-4" />, gradient: 'from-slate-500 to-slate-400', accentRgb: '100,116,139' },
};

/* ─── Building blocks ─────────────────────────────────────────────────────── */

function Connector() {
  return (
    <div className="flex justify-center w-9 shrink-0" aria-hidden>
      <div
        className="w-px h-6"
        style={{
          background:
            'linear-gradient(to bottom, var(--color-card-border), rgba(var(--color-primary-rgb), 0.45), var(--color-card-border))',
        }}
      />
    </div>
  );
}

function TerminalNode({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
  return (
    <div className="flex items-start gap-3.5">
      <div className="size-9 shrink-0 rounded-full p-0.5 bg-gradient-to-br from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] shadow-md">
        <div
          className="size-full rounded-full flex items-center justify-center"
          style={{ background: 'var(--color-bg)', color: 'var(--color-primary)' }}
        >
          {icon}
        </div>
      </div>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-bold leading-tight" style={{ color: 'var(--color-text-main)' }}>
          {title}
        </p>
        <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          {hint}
        </p>
      </div>
    </div>
  );
}

function DetailChip({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const isLong = value.length > 24;
  return (
    <span
      className="inline-flex items-baseline gap-1.5 max-w-full rounded-lg border px-2 py-1 text-[11px]"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-card-border)' }}
      title={isLong ? value : undefined}
    >
      <span className="font-semibold uppercase tracking-wide text-[9px] shrink-0" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      <span
        className={`${mono ? 'font-mono' : 'font-medium'} truncate`}
        style={{ color: 'var(--color-text-main)' }}
      >
        {mono && isLong ? truncateAddress(value, 10, 6) : value}
      </span>
    </span>
  );
}

function StepNode({ step, index, stepLabel }: { step: FlowStep; index: number; stepLabel: string }) {
  const style = KIND_STYLE[step.kind];
  return (
    <div className="flex items-start gap-3.5 group">
      {/* Medallion */}
      <div className="relative shrink-0">
        <div
          className={`size-9 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center text-white shadow-md transition-transform duration-200 group-hover:scale-110`}
        >
          {style.icon}
        </div>
        <span
          className="absolute -top-1.5 -right-1.5 size-4 rounded-full text-[9px] font-bold flex items-center justify-center border"
          style={{
            background: 'var(--color-bg)',
            borderColor: 'var(--color-card-border)',
            color: 'var(--color-text-muted)',
          }}
        >
          {index + 1}
        </span>
      </div>

      {/* Content */}
      <div
        className="flex-1 min-w-0 rounded-xl px-3.5 py-3 -mt-0.5 transition-colors duration-200"
        style={{ background: `linear-gradient(135deg, rgba(${style.accentRgb},0.08) 0%, transparent 60%)` }}
      >
        <div className="flex flex-col gap-y-1">
          <span className="sr-only">{`${stepLabel} ${index + 1}`}</span>
          <p className="text-sm font-bold leading-tight" style={{ color: 'var(--color-text-main)' }}>
            {step.title}
            <code
              className="relative -top-[1px] text-[10px] font-bold tracking-wide uppercase ml-2.5"
              style={{
                color: `rgb(${style.accentRgb})`,
              }}
            >
              {step.instruction}
            </code>
          </p>
        </div>
        <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          {step.description}
        </p>
        {step.details.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {step.details.map((detail, detailIndex) => (
              <DetailChip key={`${detail.label}-${detailIndex}`} {...detail} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Diagram ─────────────────────────────────────────────────────────────── */

interface ManifestFlowDiagramProps {
  steps: FlowStep[];
  labels: FlowLabels;
}

/**
 * Premium vertical timeline explaining, step by step, everything a
 * transaction manifest will do once it is signed by the wallet.
 */
export function ManifestFlowDiagram({ steps, labels }: ManifestFlowDiagramProps) {
  return (
    <div className="min-w-0">
      <TerminalNode icon={<Wallet className="size-4" />} title={labels.start} hint={labels.startHint} />
      <Connector />
      {steps.map((step, index) => (
        <div key={index}>
          <StepNode step={step} index={index} stepLabel={labels.stepLabel} />
          <Connector />
        </div>
      ))}
      <TerminalNode icon={<CheckCircle2 className="size-4" />} title={labels.end} hint={labels.endHint} />
    </div>
  );
}
