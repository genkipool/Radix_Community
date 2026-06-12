'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import type { GatewayMetadataItem } from '../lib/metadata-manifests';

export type MetadataEntityKind =
  | 'account'
  | 'fungible'
  | 'nonFungible'
  | 'component'
  | 'validator'
  | 'package';

export interface MetadataEntity {
  address: string;
  kind: MetadataEntityKind;
  metadataItems: GatewayMetadataItem[];
}

function classifyEntity(address: string, detailsType: string | undefined): MetadataEntityKind {
  if (address.startsWith('account_')) return 'account';
  if (address.startsWith('validator_')) return 'validator';
  if (address.startsWith('package_')) return 'package';
  if (detailsType === 'FungibleResource') return 'fungible';
  if (detailsType === 'NonFungibleResource') return 'nonFungible';
  return 'component';
}

/** Loads an entity's full metadata set (configure-metadata tool). */
export function useEntityMetadata(address: string | null) {
  const { activeNetwork } = useRadixWallet();

  return useQuery({
    queryKey: ['console-entity-metadata', activeNetwork, address],
    queryFn: async (): Promise<MetadataEntity> => {
      const details = (await apiFetchEntityDetails(address!, activeNetwork, true)) as unknown as {
        address: string;
        details?: { type?: string };
        metadata?: { items?: GatewayMetadataItem[] };
      };
      return {
        address: details.address,
        kind: classifyEntity(details.address, details.details?.type),
        metadataItems: details.metadata?.items ?? [],
      };
    },
    enabled: !!address,
    staleTime: 30_000,
    retry: false,
  });
}
