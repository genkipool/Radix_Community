'use client';

import { useState } from 'react';

import { RADIX_TOKEN_ADDRESSES } from '@/features/wallet/constants/radix-addresses';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useOwnedValidators, type OwnedValidator } from './useOwnedValidators';
import type { ValidatorBatchContext } from '../lib/validator-operations';

export interface ValidatorFormContext {
  account: string | null;
  setAccount: (account: string) => void;
  /** The validator every form in the section acts on. */
  validator: string;
  setValidator: (validator: string) => void;
  validators: OwnedValidator[];
  isLoadingValidators: boolean;
  /** True when the account holds the owner badge of the chosen validator. */
  hasOwnerBadge: boolean;
  /** Ready to hand to `buildValidatorBatchManifest`. */
  batchContext: ValidatorBatchContext;
}

/**
 * The context every validator form shares: who signs, which validator, and the
 * badge that authorises the owner-gated calls.
 *
 * With exactly one owned validator the choice is made for the operator, which
 * is the common case — a node runner acting on their own node.
 */
export function useValidatorFormContext(): ValidatorFormContext {
  const { activeNetworkId } = useRadixWallet();
  const [account, setAccount] = useState<string | null>(null);
  const [picked, setPicked] = useState('');

  const { data, isLoading } = useOwnedValidators(account);
  const validators = data ?? [];

  const validator = picked || (validators.length === 1 ? validators[0].address : '');

  const badgeIdByValidator = Object.fromEntries(
    validators.map((entry) => [entry.address, entry.badgeLocalId]),
  );

  const addresses = RADIX_TOKEN_ADDRESSES[activeNetworkId ?? RadixNetworkId.Mainnet];

  return {
    account,
    setAccount,
    validator,
    setValidator: setPicked,
    validators,
    isLoadingValidators: isLoading,
    hasOwnerBadge: !!validator && !!badgeIdByValidator[validator],
    batchContext: {
      account: account ?? '',
      xrdAddress: addresses.XRD,
      ownerBadgeResource: addresses.OWNER_BADGE,
      badgeIdByValidator,
    },
  };
}
