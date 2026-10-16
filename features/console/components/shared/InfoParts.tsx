'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';

import { CopyButton } from '@/components/ui/CopyButton';
import { SafeImage } from '@/components/ui/SafeImage';
import { truncateAddress } from '@/utils/formatters';
import { ConsoleToolLink } from '../../ConsoleNav';
import type { ConsoleToolSlug } from '../../types/console.types';
import { isGlobalCallerBadge, isPackageCallerBadge, type RuleView } from '../../lib/role-lookup';
import type { ConsoleDictionary } from '../../types/i18n.types';
import { ToolSection } from './ToolSection';

/*
 * The pieces the read-only info views (pool, validator, locker) are built
 * from, so the three read the same: one card per entity, a header with its
 * identity, coloured notes for what matters, and label/value rows.
 */

export function Heading({ children }: { children: ReactNode }) {
  return (
    <span className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
      {children}
    </span>
  );
}

/** A secondary line under a value. */
export const Sub = ({ children }: { children: ReactNode }) => (
  <span className="block text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>
    {children}
  </span>
);

type Row = [string, ReactNode] | null | false | undefined | 0;

/** Label on the left, value on the right; stacked on a phone. Falsy rows are skipped. */
export function Facts({ rows, numeric = true }: { rows: Row[]; numeric?: boolean }) {
  return (
    <dl className="divide-y divide-[var(--color-card-border)] text-sm">
      {rows
        .filter((r): r is [string, ReactNode] => !!r)
        .map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:gap-4">
            <dt className="text-xs sm:w-44 sm:shrink-0 sm:pt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {label}
            </dt>
            <dd className={`min-w-0 font-semibold ${numeric ? 'tabular-nums' : ''}`} style={{ color: 'var(--color-text-main)' }}>
              {value}
            </dd>
          </div>
        ))}
    </dl>
  );
}

export type NoteTone = 'danger' | 'warning' | 'success' | 'muted';

export function Note({ tone, children }: { tone: NoteTone; children: ReactNode }) {
  const color = tone === 'muted' ? 'var(--color-text-muted)' : `var(--color-${tone})`;
  return (
    <p
      className="rounded-xl p-3 text-xs leading-relaxed"
      style={{ background: `color-mix(in srgb, ${color} ${tone === 'muted' ? 8 : 10}%, transparent)`, color }}
    >
      {children}
    </p>
  );
}

export const fmtNumber = (value: number, digits = 2) => value.toLocaleString(undefined, { maximumFractionDigits: digits });
export const isWebUrl = (url: string) => /^https?:\/\//.test(url);

/** A link out, shown as the bare host and path. */
export function WebLink({ url }: { url?: string }) {
  if (!url || !isWebUrl(url)) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-bold hover:opacity-70"
      style={{ color: 'var(--color-primary)' }}
    >
      {url.replace(/^https?:\/\//, '')}
    </a>
  );
}

interface EntityCardProps {
  address: string;
  name: string;
  iconUrl?: string;
  /** Under the name: a kind, a status line. */
  meta?: ReactNode;
  description?: string;
  url?: string;
  onRemove: () => void;
  removeLabel: string;
  /** Tooltip of the copy button next to the address. */
  copyLabel?: string;
  children?: ReactNode;
  /** Buttons under the card, outside it. With `tool` they open that console tool in place. */
  shortcuts?: Array<{ href: string; label: string; icon: ReactNode; tool?: { slug: ConsoleToolSlug; query?: string } }>;
}

const SHORTCUT_CLASS =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition-opacity hover:opacity-80';
const SHORTCUT_STYLE = { borderColor: 'var(--color-card-border)', color: 'var(--color-text-main)', background: 'var(--color-surface)' };

/** One entity of a read-only view: its identity on top, then whatever the view says about it. */
export function EntityCard({ address, name, iconUrl, meta, description, url, onRemove, removeLabel, copyLabel, children, shortcuts }: EntityCardProps) {
  return (
    <div className="space-y-3">
      <ToolSection>
        <div className="space-y-6">
          <div className="flex items-start gap-3">
            <SafeImage src={iconUrl} alt="" fallbackName={name} zoomable={false} className="size-12 shrink-0 rounded-full object-cover" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-base font-bold" style={{ color: 'var(--color-text-main)' }}>
                {name}
              </p>
              <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }} title={address}>
                {truncateAddress(address, 14, 6)}
                <CopyButton value={address} size="xs" variant="minimal" title={copyLabel} />
              </p>
              {meta}
              {description && (
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-main)' }}>
                  {description}
                </p>
              )}
              <WebLink url={url} />
            </div>
            <button
              type="button"
              onClick={onRemove}
              aria-label={removeLabel}
              title={removeLabel}
              className="shrink-0 grid size-7 place-items-center rounded-lg transition-opacity hover:opacity-70"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <X className="size-4" />
            </button>
          </div>
          {children}
        </div>
      </ToolSection>
      {shortcuts && shortcuts.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {shortcuts.map((s, i) => {
            // An odd one out takes the whole row instead of leaving half of it empty.
            const className = i === shortcuts.length - 1 && shortcuts.length % 2 === 1 ? `${SHORTCUT_CLASS} sm:col-span-2` : SHORTCUT_CLASS;
            return s.tool ? (
              <ConsoleToolLink key={s.href} slug={s.tool.slug} query={s.tool.query} href={s.href} className={className} style={SHORTCUT_STYLE}>
                {s.icon}
                {s.label}
              </ConsoleToolLink>
            ) : (
              <a key={s.href} href={s.href} className={className} style={SHORTCUT_STYLE}>
                {s.icon}
                {s.label}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** A card for an address that could not be shown: not that kind, or not readable. */
export function EntityCardMessage({ address, message, onRemove, removeLabel }: { address: string; message: ReactNode; onRemove: () => void; removeLabel: string }) {
  return (
    <ToolSection>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs break-all" style={{ color: 'var(--color-text-muted)' }}>
            {address}
          </p>
          <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
            {message}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          title={removeLabel}
          className="shrink-0 grid size-7 place-items-center rounded-lg transition-opacity hover:opacity-70"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <X className="size-4" />
        </button>
      </div>
    </ToolSection>
  );
}

/**
 * What a card says when its address could not be read: "not a pool" (or
 * validator, locker) for an address the ledger does not know, the Gateway's
 * own message for anything else (a network failure is worth seeing as is).
 */
export const cardError = (error: unknown, notThatKind: string) =>
  !error || /not found|404/i.test(error instanceof Error ? error.message : String(error))
    ? notThatKind
    : error instanceof Error
      ? error.message
      : String(error);

export const CardSkeleton = () => (
  <span className="block h-48 rounded-2xl animate-pulse" style={{ background: 'var(--color-card-border)' }} aria-busy="true" />
);

/** `[714041…8e89]`: long non-fungible ids shortened, short ones (`#1#`, `<gold>`) kept as they are. */
export const shortId = (id: string) => (id.length > 20 ? `${id.slice(0, 7)}…${id.slice(-5)}` : id);

interface RuleSummaryProps {
  t: ConsoleDictionary;
  rule: RuleView;
  /** Badge resource → display name. */
  badgeName: (resource: string) => string;
  /** Whether the account holds the badge; undefined hides the status. */
  held?: boolean;
  note?: string;
  /** What "a component" means where this rule lives (a DEX pool, a dApp's locker). */
  callerHints?: { component: string; package: string };
}

/** Who a role belongs to, in words: anyone, nobody, a badge (and whether you hold it), or a contract. */
export function RuleSummary({ t, rule, badgeName, held, note, callerHints }: RuleSummaryProps) {
  const labels = t.pool;
  if (rule.type === 'resource' || rule.type === 'nonFungible') {
    // Engine caller badges are not something a person holds: say who acts instead.
    const caller = isGlobalCallerBadge(rule.resource) ? 'component' : isPackageCallerBadge(rule.resource) ? 'package' : null;
    if (caller) {
      return (
        <>
          <span className="font-semibold">{labels.rule[caller]}</span>
          <Sub>{callerHints?.[caller] ?? labels.rule[`${caller}Hint`]}</Sub>
          {note && <Sub>{note}</Sub>}
        </>
      );
    }
  }
  const isBadge = rule.type === 'resource' || rule.type === 'nonFungible';
  return (
    <>
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold">
          {rule.type === 'allowAll'
            ? labels.rule.allowAll
            : rule.type === 'denyAll'
              ? labels.rule.denyAll
              : isBadge
                ? labels.rule.badge.replace('{badge}', badgeName(rule.resource))
                : labels.rule.other}
        </span>
        {isBadge && held !== undefined && (
          <span className="text-xs font-semibold" style={{ color: held ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
            {held ? labels.youHold : labels.youDontHold}
          </span>
        )}
      </span>
      {rule.type === 'nonFungible' && <Sub>{labels.rule.nonFungible.replace('{id}', shortId(rule.localId))}</Sub>}
      {note && <Sub>{note}</Sub>}
    </>
  );
}

/** Badge resource → name, falling back to a short address. */
export const badgeNamer = (names: Record<string, string>) => (resource: string) =>
  names[resource] ?? truncateAddress(resource, 10, 6);
