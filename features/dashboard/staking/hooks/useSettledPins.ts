'use client';

/**
 * The wallet's pinned validators, held steady while they are being re-read.
 *
 * Which validators belong to the connected wallet decides which cards go first
 * and, with the wallet filter on, which cards exist at all. That answer is a
 * separate read, and it is re-read whenever ANYTHING about the wallet moves:
 * switching ledger from the toolbar, switching it from the wallet popover or
 * the profile modal (which swaps `sessions[activeNetwork]`, so the account list
 * itself changes), or picking different accounts.
 *
 * Reported raw, every one of those re-reads passes through "no pinned
 * validators" on its way to the answer, and the grid believes it: it paints
 * skeletons, and with the filter on it announces that no staking nodes were
 * found — both for a fraction of a second, both wrong, and both from paths that
 * had nothing to do with each other.
 *
 * So the last settled answer stands until the next one exists. The grid never
 * sees the gap, whichever control opened it.
 */
import { useState } from 'react';

export interface Pins {
  pinnedValidatorAddresses: string[];
  ownerValidatorAddresses: string[];
}

/** Content identity, since each read builds fresh arrays. */
function signature({ pinnedValidatorAddresses, ownerValidatorAddresses }: Pins): string {
  return `${pinnedValidatorAddresses.join('|')}#${ownerValidatorAddresses.join('|')}`;
}

export function useSettledPins(pins: Pins, isLoading: boolean): Pins {
  const [settled, setSettled] = useState<{ key: string; value: Pins }>(() => ({
    key: signature(pins),
    value: pins,
  }));

  const key = signature(pins);
  if (!isLoading && key !== settled.key) {
    setSettled({ key, value: pins });
  }

  // Mid-read: whatever was true a moment ago is still the best answer there is.
  return isLoading ? settled.value : pins;
}
