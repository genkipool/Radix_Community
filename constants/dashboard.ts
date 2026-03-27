/**
 * constants/dashboard.ts
 *
 * All static constants consumed by the Dashboard feature.
 * Centralised here so they are easy to extend without hunting through components.
 */

/* ── Validator tag filters ──────────────────────────────────── */
export const DASHBOARD_TAGS = [
  'All', 'Active', 'Inactive', 'Low Fee', 'High Uptime', 'Foundation', 'Community',
] as const;

export type DashboardTag = typeof DASHBOARD_TAGS[number];

/* ── Grid column → Tailwind class map ──────────────────────── */
const GRID_CLASS_MAP: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  6: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6',
  7: 'grid-cols-3 sm:grid-cols-5 lg:grid-cols-7',
  8: 'grid-cols-4 sm:grid-cols-6 lg:grid-cols-8',
};

/** Returns the Tailwind responsive grid-cols class string for a given column count. */
export const getGridClass = (cols: number): string =>
  GRID_CLASS_MAP[cols] ?? GRID_CLASS_MAP[8];

/* ── Threshold: grid density above which cards open in a modal ─ */
export const VALIDATOR_MODAL_THRESHOLD = 4;

/* ── Progressive rendering page size for validators ────────── */
export const VALIDATOR_PAGE_SIZE = 24;

/* ── Cookie keys ─────────────────────────────────────────────── */
export const COOKIE_KEYS = {
  activeTag:            'db_active_tag',
  txTag:                'db_tx_tag',
  valSortMode:          'db_val_sort_mode',
  txSortMode:           'db_tx_sort_mode',
  valColumns:           'db_val_columns',
  txColumns:            'db_tx_columns',
  valReadingMode:       'db_val_reading_mode',
  txReadingMode:        'db_tx_reading_mode',
  valAutoCollapse:      'db_val_auto_collapse',
  txAutoCollapse:       'db_tx_auto_collapse',
  expandedValidators:   'dashboard_expanded_validators',
  expandedTxs:          'dashboard_expanded_txs',
} as const;
