/**
 * features/dashboard/index.ts — Public API barrel
 *
 * Import from '@/features/dashboard' instead of deep paths wherever possible.
 * Only export what is genuinely consumed OUTSIDE this feature.
 */

// ── Entry point ──────────────────────────────────────────────────
export { default as DashboardClient } from './DashboardClient';

// ── Prefetch hook (used in Navbar for hover-prefetch) ────────────
export { usePrefetchDashboard } from './hooks/usePrefetchDashboard';

// ── Types ────────────────────────────────────────────────────────
export type {
  DashboardInitialProps,
  Network,
  DashboardView,
  SortMode,
} from '@/features/dashboard/types';

// ── Utils ────────────────────────────────────────────────────────
export { getMetaValue } from './explorador/utils/metadataUtils';
