'use client';

import { useState } from 'react';
import { AlertTriangle, HelpCircle, Info, KeyRound, ShieldCheck, ShieldOff } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { truncateAddress } from '@/utils/formatters';
import { securityInputState, useAccountSecurity } from '../../hooks/useAccountSecurity';
import { VERDICT_SEVERITY, type RuleSummary, type SecurityNote } from '../../lib/account-security';
import type { AccountSecurityReport } from '../../services/accountSecurity';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { ToolSection } from '../shared/ToolSection';
import { AddressField } from '../shared/fields';

type Labels = ConsoleToolProps['t']['accountSecurity'];

/* ─── Presentation of a verdict ──────────────────────────────────────────── */

/**
 * Severity is drawn with the theme's own semantic tokens, never with literal
 * colours: `--color-success` follows the selected theme's primary, so a
 * verdict box belongs to whatever theme the reader picked.
 *
 * The tint is derived from the same token as the border (`/5`) rather than
 * from `currentColor`, which would mix the inherited text colour and leave a
 * grey wash under a coloured border.
 */
const SEVERITY_STYLE = {
  good: {
    icon: ShieldCheck,
    text: 'text-[var(--color-success)]',
    box: 'border-[var(--color-success)]/40 bg-[var(--color-success)]/5',
  },
  warn: {
    icon: KeyRound,
    text: 'text-[var(--color-warning)]',
    box: 'border-[var(--color-warning)]/40 bg-[var(--color-warning)]/5',
  },
  bad: {
    icon: ShieldOff,
    text: 'text-[var(--color-danger)]',
    box: 'border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5',
  },
  neutral: {
    icon: HelpCircle,
    text: 'text-[var(--color-text-muted)]',
    box: 'border-[var(--color-card-border)] bg-[var(--color-surface)]',
  },
} as const;

/**
 * A finding is either a caution or a fact, and the icon has to say which: a
 * tick next to "a transfer is final" reads as approval of it.
 */
const NOTE_STYLE: Record<SecurityNote, { text: string; icon: typeof Info }> = {
  addressRuleMismatch: { text: 'text-[var(--color-danger)]', icon: AlertTriangle },
  singleTransferableBadge: { text: 'text-[var(--color-warning)]', icon: AlertTriangle },
  badgeHeldBySelf: { text: 'text-[var(--color-warning)]', icon: AlertTriangle },
  olympiaDerived: { text: 'text-[var(--color-text-muted)]', icon: Info },
  holderUnresolved: { text: 'text-[var(--color-text-muted)]', icon: Info },
};

/** One label + value line, the shape every detail row in this tool takes. */
function Row({ label, value, mono, copy }: { label: string; value: string; mono?: boolean; copy?: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3 py-1">
      <span className="text-xs shrink-0 sm:w-56 text-[var(--color-text-muted)]">{label}</span>
      <span className="flex items-center gap-1.5 min-w-0">
        <span
          className={`text-xs break-all text-[var(--color-text-main)] ${mono ? 'font-mono' : 'font-semibold'}`}
        >
          {value}
        </span>
        {copy && <CopyButton value={copy} size="xs" variant="minimal" />}
      </span>
    </div>
  );
}

function VerdictBanner({ report, labels }: { report: AccountSecurityReport; labels: Labels }) {
  const { icon: Icon, text, box } = SEVERITY_STYLE[VERDICT_SEVERITY[report.verdict]];
  const verdict = labels.verdicts[report.verdict];

  return (
    <div className={`rounded-xl border p-4 sm:p-5 flex items-start gap-3 ${box}`}>
      <Icon className={`size-6 shrink-0 mt-0.5 ${text}`} />
      <div className="space-y-1 min-w-0">
        <p className={`text-sm font-bold ${text}`}>{verdict.label}</p>
        <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">{verdict.meaning}</p>
      </div>
    </div>
  );
}

/* ─── Sections ───────────────────────────────────────────────────────────── */

function ControlDetails({ report, labels }: { report: AccountSecurityReport; labels: Labels }) {
  const control = report.ownerControl;
  const holder = report.badgeLocation?.holder;

  return (
    <div className="space-y-0.5">
      <Row
        label={labels.control.addressKind}
        value={report.accountKind ? labels.addressKind[report.accountKind] : labels.addressKind.unknown}
      />
      {control.kind === 'signature' && (
        <>
          <Row label={labels.control.ownerRule} value={labels.control.signature[control.curve]} />
          <Row label={labels.control.publicKeyHash} value={control.publicKeyHash} mono copy={control.publicKeyHash} />
          <Row
            label={labels.control.matchesAddress}
            value={control.matchesAddress ? labels.common.yes : labels.control.mismatch}
          />
        </>
      )}
      {control.kind === 'ownerBadge' && (
        <>
          <Row label={labels.control.ownerRule} value={labels.control.ownerBadge} />
          <Row label={labels.control.badgeId} value={control.localId} mono copy={control.localId} />
          <Row
            label={labels.control.holder}
            value={holder ? truncateAddress(holder, 14, 10) : labels.control.notReported}
            mono
            copy={holder}
          />
        </>
      )}
      {control.kind !== 'signature' && control.kind !== 'ownerBadge' && (
        <Row label={labels.control.ownerRule} value={labels.control.other[control.kind]} />
      )}
    </div>
  );
}

/** "1 / 3" — how many of the badges a controller role actually needs. */
function ruleText(rule: RuleSummary | null, labels: Labels): string {
  if (!rule) return '—';
  if (rule.kind === 'allowAll') return labels.controller.anyone;
  if (rule.kind === 'denyAll') return labels.controller.nobody;
  if (rule.badges.length === 0) return labels.controller.unreadable;
  const need = rule.threshold ?? rule.badges.length;
  return labels.controller.factors.replace('{need}', String(need)).replace('{total}', String(rule.badges.length));
}

function ControllerPanel({ report, labels }: { report: AccountSecurityReport; labels: Labels }) {
  const config = report.controllerConfig;
  if (!config) return null;
  const alerts = [
    config.recoveryInProgress && labels.controller.recoveryInProgress,
    config.badgeWithdrawAttempt && labels.controller.withdrawAttempt,
  ].filter(Boolean) as string[];

  return (
    <ToolSection title={labels.controllerTitle} hint={labels.controllerHint}>
      {alerts.length > 0 && (
        <div className="rounded-lg border p-3 space-y-1 border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5">
          {alerts.map((alert) => (
            <p
              key={alert}
              className="text-xs font-semibold flex items-center gap-2 text-[var(--color-danger)]"
            >
              <AlertTriangle className="size-4 shrink-0" />
              {alert}
            </p>
          ))}
        </div>
      )}
      <div className="space-y-0.5">
        <Row label={labels.controller.address} value={truncateAddress(config.address, 16, 10)} mono copy={config.address} />
        <Row label={labels.controller.primary} value={ruleText(config.roles.primary, labels)} />
        <Row label={labels.controller.recovery} value={ruleText(config.roles.recovery, labels)} />
        <Row label={labels.controller.confirmation} value={ruleText(config.roles.confirmation, labels)} />
        <Row
          label={labels.controller.delay}
          value={
            config.timedRecoveryDelayMinutes === null
              ? labels.controller.delayDisabled
              : labels.controller.delayValue.replace('{minutes}', String(config.timedRecoveryDelayMinutes))
          }
        />
        <Row
          label={labels.controller.primaryLocked}
          value={config.primaryRoleLocked ? labels.common.yes : labels.common.no}
        />
        <Row label={labels.controller.feeVault} value={config.hasFeeVault ? labels.common.yes : labels.common.no} />
      </div>
    </ToolSection>
  );
}

/* ─── Tool ───────────────────────────────────────────────────────────────── */

export default function AccountSecurityTool({ t }: ConsoleToolProps) {
  const labels = t.accountSecurity;
  const { activeNetwork } = useRadixWallet();
  const [address, setAddress] = useState('');

  const inputState = securityInputState(address, activeNetwork);
  const { data: report, isFetching, error } = useAccountSecurity(address);

  const hint =
    inputState === 'malformed'
      ? labels.states.malformed
      : inputState === 'notAccount'
        ? labels.states.notAccount
        : inputState === 'wrongNetwork'
          ? labels.states.wrongNetwork.replace('{network}', activeNetwork)
          : undefined;

  return (
    <div className="space-y-5">
      <ToolSection title={labels.checkTitle} hint={labels.checkHint}>
        <AddressField
          value={address}
          onChange={setAddress}
          placeholder={labels.placeholder}
          categories={['account']}
          error={hint}
        />
        {isFetching && (
          <p className="text-xs flex items-center gap-2 text-[var(--color-text-muted)]">
            <span className="size-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
            {labels.checking}
          </p>
        )}
        {error && !isFetching && (
          <p className="text-xs font-semibold text-[var(--color-danger)]">{labels.error}</p>
        )}
      </ToolSection>

      {report && !isFetching && (
        <>
          <VerdictBanner report={report} labels={labels} />

          <ToolSection title={labels.controlTitle} hint={labels.controlHint}>
            <ControlDetails report={report} labels={labels} />
          </ToolSection>

          {report.notes.length > 0 && (
            <ToolSection title={labels.notesTitle}>
              <ul className="space-y-2">
                {report.notes.map((note) => {
                  const { text, icon: NoteIcon } = NOTE_STYLE[note];
                  return (
                    <li key={note} className="text-xs leading-relaxed flex items-start gap-2">
                      <NoteIcon className={`size-3.5 shrink-0 mt-0.5 ${text}`} />
                      <span className="text-[var(--color-text-main)]">{labels.notes[note]}</span>
                    </li>
                  );
                })}
              </ul>
            </ToolSection>
          )}

          <ControllerPanel report={report} labels={labels} />
        </>
      )}
    </div>
  );
}
