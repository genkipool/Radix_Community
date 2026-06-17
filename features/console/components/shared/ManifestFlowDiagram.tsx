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
  withdraw: { icon: <ArrowUpFromLine className="size-4" />, gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]', accentRgb: '59,130,246' },
  take: { icon: <PackageOpen className="size-4" />, gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]', accentRgb: '99,102,241' },
  deposit: { icon: <ArrowDownToLine className="size-4" />, gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]', accentRgb: '16,185,129' },
  proof: { icon: <BadgeCheck className="size-4" />, gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]', accentRgb: '245,158,11' },
  metadata: { icon: <Tags className="size-4" />, gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]', accentRgb: '14,165,233' },
  create: { icon: <Sparkles className="size-4" />, gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]', accentRgb: '217,70,239' },
  publish: { icon: <Rocket className="size-4" />, gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]', accentRgb: '139,92,246' },
  call: { icon: <Braces className="size-4" />, gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]', accentRgb: '100,116,139' },
  burn: { icon: <Flame className="size-4" />, gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]', accentRgb: '244,63,94' },
  other: { icon: <CircleDot className="size-4" />, gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]', accentRgb: '100,116,139' },
};

/* ─── Building blocks ─────────────────────────────────────────────────────── */



function TerminalNode({ icon, title, hint, isLast }: { icon: ReactNode; title: string; hint: string; isLast?: boolean }) {
  return (
    <div className="flex items-stretch gap-3.5 relative">
      {/* Timeline line connecting to the next node */}
      {!isLast && (
        <div 
          className="absolute left-[18px] top-[36px] bottom-0 w-px -translate-x-1/2" 
          style={{
            background: 'linear-gradient(to bottom, var(--color-card-border), rgba(var(--color-primary-rgb), 0.45) 50%, var(--color-card-border))'
          }}
        />
      )}
      <div className="size-9 shrink-0 rounded-full p-0.5 bg-gradient-to-br from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] shadow-md relative z-10">
        <div
          className="size-full rounded-full flex items-center justify-center"
          style={{ background: 'var(--color-bg)', color: 'var(--color-primary)' }}
        >
          {icon}
        </div>
      </div>
      <div className="min-w-0 pt-0.5 pb-8">
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
    <div className="flex items-stretch gap-3.5 group relative">
      {/* Timeline line connecting to the next node */}
      <div 
        className="absolute left-[18px] top-[36px] bottom-0 w-px -translate-x-1/2" 
        style={{
          background: 'linear-gradient(to bottom, var(--color-card-border), rgba(var(--color-primary-rgb), 0.45) 50%, var(--color-card-border))'
        }}
      />
      
      {/* Medallion */}
      <div className="relative shrink-0">
        <div
          className={`size-9 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center text-white shadow-md transition-transform duration-200 group-hover:scale-110 relative z-10`}
        >
          {style.icon}
        </div>
        <span
          className="absolute -top-1.5 -right-1.5 size-4 rounded-full text-[9px] font-bold flex items-center justify-center border z-20"
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
      <div className="flex-1 min-w-0 pb-8">
        <div
          className="rounded-xl px-3.5 py-3 transition-colors duration-200 relative z-10"
          style={{ background: `linear-gradient(135deg, rgba(var(--color-primary-rgb),0.08) 0%, transparent 60%)` }}
        >
          <div className="flex flex-col gap-y-1">
            <span className="sr-only">{`${stepLabel} ${index + 1}`}</span>
            <p className="text-sm font-bold leading-tight" style={{ color: 'var(--color-text-main)' }}>
              {step.title}
              <code
                className="relative -top-[1px] text-[10px] font-bold tracking-wide uppercase ml-2.5"
                style={{
                  color: `var(--color-primary)`,
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
    <div className="min-w-0 flex flex-col">
      <TerminalNode icon={<Wallet className="size-4" />} title={labels.start} hint={labels.startHint} />
      
      {steps.map((step, index) => (
        <StepNode key={index} step={step} index={index} stepLabel={labels.stepLabel} />
      ))}

      <TerminalNode icon={<CheckCircle2 className="size-4" />} title={labels.end} hint={labels.endHint} isLast />
    </div>
  );
}
