'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { truncateAddress } from '@/utils/formatters';
import { getMetadataItem, type GatewayMetadataItem } from '../../lib/metadata-manifests';
import type { ConsoleDictionary } from '../../types/i18n.types';

export type TwoWayLinkKind = 'website' | 'entity';

/* ─── Verification queries ────────────────────────────────────────────────── */

async function verifyWebsite(origin: string, dappDefinition: string): Promise<boolean> {
  const res = await fetch(`${origin.replace(/\/$/, '')}/.well-known/radix.json`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { dApps?: Array<{ dAppDefinitionAddress?: string }> };
  return (data.dApps ?? []).some((dApp) => dApp.dAppDefinitionAddress === dappDefinition);
}

const BACKLINK_KEYS = ['dapp_definition', 'dapp_definitions', 'claimed_entities'];

async function verifyEntity(
  otherAddress: string,
  dappDefinition: string,
  network: 'mainnet' | 'stokenet',
): Promise<boolean> {
  const details = (await apiFetchEntityDetails(otherAddress, network)) as unknown as {
    metadata?: { items?: GatewayMetadataItem[] };
  };
  const items = details.metadata?.items;
  return BACKLINK_KEYS.some((key) => {
    const typed = getMetadataItem(items, key)?.value?.typed;
    if (!typed) return false;
    if (typed.value === dappDefinition) return true;
    return Array.isArray(typed.values) && typed.values.map(String).includes(dappDefinition);
  });
}

/* ─── Status chip ─────────────────────────────────────────────────────────── */

interface TwoWayLinkStatusProps {
  t: ConsoleDictionary['metadata'];
  kind: TwoWayLinkKind;
  /** Declared value: a website origin or an entity address */
  value: string;
  /** The entity whose metadata is being edited (the dApp definition account) */
  entityAddress: string;
}

/**
 * Live two-way link verification (claimed_websites / claimed_entities /
 * dapp_definitions): checks that the other side links back to this entity.
 */
export function TwoWayLinkStatus({ t, kind, value, entityAddress }: TwoWayLinkStatusProps) {
  const { activeNetwork } = useRadixWallet();
  const trimmed = value.trim();

  const { data: verified, isLoading } = useQuery({
    queryKey: ['console-two-way-link', activeNetwork, kind, trimmed, entityAddress],
    queryFn: () =>
      kind === 'website'
        ? verifyWebsite(trimmed, entityAddress)
        : verifyEntity(trimmed, entityAddress, activeNetwork),
    enabled: trimmed.length > 0,
    staleTime: 60_000,
    retry: false,
  });

  if (!trimmed) return null;

  const display = kind === 'entity' ? truncateAddress(trimmed, 10, 6) : trimmed;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] max-w-full"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-card-border)' }}
      title={isLoading ? undefined : verified ? t.linkVerifiedHint : t.linkUnverifiedHint}
    >
      <span className="truncate font-mono" style={{ color: 'var(--color-text-main)' }} title={trimmed}>
        {display}
      </span>
      {isLoading ? (
        <span className="size-3 shrink-0 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
      ) : verified ? (
        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
      ) : (
        <CircleAlert className="size-3.5 shrink-0 text-amber-500" />
      )}
    </span>
  );
}
