'use client';

import { formatNumber } from '@/utils/formatters';
import type { ClaimableNft } from '../../hooks/useClaimableNfts';
import type { ConsoleDictionary } from '../../types/i18n.types';
import { ResourceCard } from '../shared/ResourceCard';

interface ClaimNftPickerProps {
  t: ConsoleDictionary;
  nfts: ClaimableNft[];
  isLoading: boolean;
  /** `${resourceAddress}:${localId}` of the picked NFTs. */
  selected: string[];
  onToggle: (key: string) => void;
  /** Validator whose NFTs cannot be picked right now, and why. */
  lockedValidator?: { address: string; reason: string };
  disabled?: boolean;
}

export const claimNftKey = (nft: ClaimableNft) => `${nft.resourceAddress}:${nft.localId}`;

/**
 * The account's stake claim NFTs as selectable cards.
 *
 * Every card names its validator, because an account that has unstaked from
 * several of them holds NFTs that are otherwise indistinguishable — same
 * resource shape, opaque RUID, and only the amount and epoch to tell apart.
 * Redeeming one against the wrong validator simply fails, so the attribution
 * is the point of the picker, not decoration.
 */
export function ClaimNftPicker({
  t,
  nfts,
  isLoading,
  selected,
  onToggle,
  lockedValidator,
  disabled,
}: ClaimNftPickerProps) {
  const labels = t.validator.forms.staking.claim;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" aria-busy="true">
        {[0, 1].map((slot) => (
          <span
            key={slot}
            className="h-[58px] rounded-xl animate-pulse"
            style={{ background: 'var(--color-card-border)' }}
          />
        ))}
      </div>
    );
  }

  if (nfts.length === 0) {
    return (
      <p className="text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
        {labels.noneFound}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {nfts.map((nft) => {
        const key = claimNftKey(nft);
        const locked = lockedValidator?.address === nft.validatorAddress;
        const blocked = !nft.isClaimable || locked;
        const reason = locked
          ? lockedValidator!.reason
          : !nft.isClaimable
            ? labels.notYet.replace('{epoch}', String(nft.claimEpoch))
            : undefined;

        return (
          <ResourceCard
            key={key}
            isActive={selected.includes(key)}
            disabled={disabled || blocked}
            onClick={() => onToggle(key)}
            name={`${formatNumber(nft.amount)} XRD`}
            address={nft.validatorName}
            fullAddress={nft.validatorAddress}
            iconUrl={nft.validatorIconUrl}
            title={reason ?? `${nft.validatorName} · ${nft.localId}`}
          />
        );
      })}
    </div>
  );
}
