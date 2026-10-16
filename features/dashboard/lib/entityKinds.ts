/**
 * The kinds of ledger entity the explorer knows, read from the address prefix.
 *
 * One table for everything that depends on the kind: which prefixes belong to
 * it, whether the explorer has a card for it, and the label and colours its
 * badge wears. The search box, the card grid, the reading modal and the badges
 * all read it, so adding a kind is one entry here (plus its card in
 * `explorador/components/cards/entityCards.tsx`), and none of them can disagree
 * about what an address is.
 *
 * Pure: no React, so server code can use it too.
 */

export type ExplorerEntityKind =
  | 'account'
  | 'package'
  | 'component'
  | 'pool'
  | 'locker'
  | 'resource'
  | 'validator'
  | 'identity'
  | 'system';

/** Keys of `dashboard.transactions` holding each kind's badge label. */
type LabelKey =
  | 'entity_type_account'
  | 'entity_type_package'
  | 'entity_type_component'
  | 'entity_type_pool'
  | 'entity_type_locker'
  | 'entity_type_resource'
  | 'entity_type_validator'
  | 'entity_type_identity'
  | 'entity_type_system';

interface EntityKindInfo {
  prefixes: readonly string[];
  /** The explorer has a dedicated card for it (search result, reading modal). */
  hasCard: boolean;
  labelKey: LabelKey;
  fallbackLabel: string;
  /** Tailwind classes for the badge text and its frame. */
  color: string;
  bg: string;
}

export const ENTITY_KINDS: Record<ExplorerEntityKind, EntityKindInfo> = {
  account: {
    prefixes: ['account_'],
    hasCard: true,
    labelKey: 'entity_type_account',
    fallbackLabel: 'Account',
    color: 'text-blue-400',
    bg: 'bg-blue-500/6 border-blue-500/20',
  },
  package: {
    prefixes: ['package_'],
    hasCard: true,
    labelKey: 'entity_type_package',
    fallbackLabel: 'Package',
    color: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-500/6 border-cyan-500/30',
  },
  component: {
    prefixes: ['component_'],
    hasCard: true,
    labelKey: 'entity_type_component',
    fallbackLabel: 'Component',
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-500/6 border-purple-500/30',
  },
  pool: {
    prefixes: ['pool_'],
    hasCard: true,
    labelKey: 'entity_type_pool',
    fallbackLabel: 'Pool',
    color: 'text-teal-700 dark:text-teal-400',
    bg: 'bg-teal-500/8 border-teal-500/40',
  },
  locker: {
    prefixes: ['locker_'],
    hasCard: true,
    labelKey: 'entity_type_locker',
    fallbackLabel: 'Locker',
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-500/8 border-indigo-500/40',
  },
  resource: {
    prefixes: ['resource_'],
    hasCard: true,
    labelKey: 'entity_type_resource',
    fallbackLabel: 'Resource',
    color: 'text-amber-800 dark:text-amber-400 font-black tracking-wide',
    bg: 'bg-amber-500/10 border-amber-500/60',
  },
  validator: {
    prefixes: ['validator_'],
    hasCard: true,
    labelKey: 'entity_type_validator',
    fallbackLabel: 'Validator',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-500/8 border-emerald-500/40',
  },
  identity: {
    prefixes: ['identity_'],
    hasCard: false,
    labelKey: 'entity_type_identity',
    fallbackLabel: 'Identity',
    color: 'text-pink-400',
    bg: 'bg-pink-500/6 border-pink-500/20',
  },
  system: {
    prefixes: ['transactiontracker_', 'consensusmanager_'],
    hasCard: true,
    labelKey: 'entity_type_system',
    fallbackLabel: 'System',
    color: 'text-[var(--color-text-muted)]',
    bg: 'bg-[var(--color-surface)] border-[var(--color-card-border)]',
  },
};

const BY_PREFIX = (Object.entries(ENTITY_KINDS) as Array<[ExplorerEntityKind, EntityKindInfo]>).flatMap(
  ([kind, info]) => info.prefixes.map((prefix) => [prefix, kind] as const),
);

/** Every entity address prefix the explorer recognises. */
export const ENTITY_ADDRESS_PREFIXES: readonly string[] = BY_PREFIX.map(([prefix]) => prefix);

/** The kind of an entity address, or null when it is not one. */
export function entityKindOf(address: string | null | undefined): ExplorerEntityKind | null {
  if (!address) return null;
  return BY_PREFIX.find(([prefix]) => address.startsWith(prefix))?.[1] ?? null;
}

/** A whole entity address the explorer can show a card for (not a prefix being typed). */
export function isCardEntity(value: string): boolean {
  const kind = entityKindOf(value);
  return value.length >= 60 && !!kind && ENTITY_KINDS[kind].hasCard;
}
