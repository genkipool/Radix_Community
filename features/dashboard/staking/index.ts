/**
 * features/dashboard/staking/index.ts
 *
 * Public API barrel for the Validators slice.
 */

// ── Components ────────────────────────────────────────────────────────────────
export { ValidatorCard }         from './components/ValidatorCard';
export { ValidatorDetailView }   from './components/ValidatorDetailView';
export { ValidatorExpandedBody } from './components/ValidatorExpandedBody';

// ── Hooks ─────────────────────────────────────────────────────────────────────
export { useValidatorsQuery }       from './hooks/useValidatorsQuery';
export { useValidatorFilters }      from './hooks/useValidatorFilters';
export { usePrefetchValidatorEntity } from './hooks/usePrefetchValidator';
