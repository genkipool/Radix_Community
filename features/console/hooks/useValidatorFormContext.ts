'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { RADIX_TOKEN_ADDRESSES } from '@/features/wallet/constants/radix-addresses';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { parseValidatorState, type ValidatorState } from '../lib/validator-lookup';
import type { ValidatorBatchContext } from '../lib/validator-operations';
import { useOwnedValidators } from './useOwnedValidators';

/** One address the form can act on, and whether it is switched on. */
export interface ValidatorRow {
  id: string;
  address: string;
  selected: boolean;
  /** Came from an owner badge this account holds, rather than being typed. */
  detected: boolean;
  /** `name` metadata, when the validator has one. */
  name?: string;
}

export interface ValidatorFormContext {
  account: string | null;
  setAccount: (account: string) => void;
  /** Detected + manually added addresses, in the order they are shown. */
  rows: ValidatorRow[];
  setRowAddress: (id: string, address: string) => void;
  toggleRow: (id: string) => void;
  addRow: () => void;
  removeRow: (id: string) => void;
  /** Addresses of the selected, non-empty rows: what the form acts on. */
  validators: string[];
  isLoadingValidators: boolean;
  /** On-ledger state of each selected validator, by address. */
  states: Record<string, ValidatorState | null>;
  batchContext: ValidatorBatchContext;
}

const MANUAL_PREFIX = 'manual:';
const FIRST_MANUAL_ROW = { id: `${MANUAL_PREFIX}0`, address: '' };

/**
 * The context every validator form shares: who signs, which validators, and the
 * badges that authorise the owner-gated calls.
 *
 * Several validators at once, because the ledger allows it: one badge proof
 * covers every owner call in a transaction, so voting a protocol update on
 * four validators is one transaction and one proof, not four of each.
 *
 * The rows are derived from the detected badges plus whatever was typed — no
 * effect copies query results into state, so the detected validators appear
 * already selected without a render pass that first shows them unselected.
 */
export function useValidatorFormContext(): ValidatorFormContext {
  const { activeNetwork, activeNetworkId } = useRadixWallet();
  const [account, setAccount] = useState<string | null>(null);
  const [manual, setManual] = useState<Array<{ id: string; address: string }>>([]);
  const [unselected, setUnselected] = useState<string[]>([]);
  const [nextManualId, setNextManualId] = useState(1);

  const { data: owned, isLoading } = useOwnedValidators(account);
  const detected = owned ?? [];

  /*
   * With nothing detected there is still one empty row to type into; it only
   * becomes a real manual row once something is written in it.
   */
  const manualRows = manual.length || detected.length ? manual : [FIRST_MANUAL_ROW];

  const rows: ValidatorRow[] = [
    ...detected.map((validator) => ({
      id: `owned:${validator.address}`,
      address: validator.address,
      detected: true,
      name: validator.name,
      selected: !unselected.includes(`owned:${validator.address}`),
    })),
    ...manualRows.map((row) => ({
      id: row.id,
      address: row.address,
      detected: false,
      selected: !unselected.includes(row.id),
    })),
  ];

  const setRowAddress = (id: string, address: string) =>
    setManual((prev) =>
      prev.some((row) => row.id === id)
        ? prev.map((row) => (row.id === id ? { ...row, address } : row))
        : [...prev, { id, address }],
    );

  const toggleRow = (id: string) =>
    setUnselected((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));

  const addRow = () => {
    setManual((prev) => [...prev, { id: `${MANUAL_PREFIX}${nextManualId}`, address: '' }]);
    setNextManualId((id) => id + 1);
  };

  const removeRow = (id: string) => {
    setManual((prev) => prev.filter((row) => row.id !== id));
    setUnselected((prev) => prev.filter((entry) => entry !== id));
  };

  const validators = [
    ...new Set(rows.filter((row) => row.selected && row.address.trim()).map((row) => row.address.trim())),
  ];

  const { data: states } = useQuery({
    queryKey: ['console-validator-states', activeNetwork, [...validators].sort().join(',')],
    enabled: validators.length > 0,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      const entries = await Promise.all(
        validators.map(async (address) => {
          const details = await apiFetchEntityDetails(address, activeNetwork).catch(() => null);
          return [address, details ? parseValidatorState(details) : null] as const;
        }),
      );
      return Object.fromEntries(entries);
    },
  });

  const addresses = RADIX_TOKEN_ADDRESSES[activeNetworkId ?? RadixNetworkId.Mainnet];

  return {
    account,
    setAccount,
    rows,
    setRowAddress,
    toggleRow,
    addRow,
    removeRow,
    validators,
    isLoadingValidators: isLoading,
    states: states ?? {},
    batchContext: {
      account: account ?? '',
      xrdAddress: addresses.XRD,
      ownerBadgeResource: addresses.OWNER_BADGE,
      badgeIdByValidator: Object.fromEntries(
        detected.map((validator) => [validator.address, validator.badgeLocalId]),
      ),
    },
  };
}
