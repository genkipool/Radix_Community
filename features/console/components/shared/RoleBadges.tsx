'use client';

import type React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';

import { useLanguage } from '@/context/LanguageContext';
import { dashboardRoutes } from '@/features/dashboard/lib/routes';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { gatewayPost } from '@/services/gateway/bases';
import { truncateAddress } from '@/utils/formatters';
import { isGlobalCallerBadge, isPackageCallerBadge } from '../../lib/role-lookup';
import type { ConsoleDictionary } from '../../types/i18n.types';
import { Heading } from './InfoParts';
import { ResourceCard } from './ResourceCard';

type MetadataList = { items?: { key: string; value?: { typed?: { value?: unknown } } }[] };
const readMeta = (list: MetadataList | undefined, key: string) => {
  const value = list?.items?.find((m) => m.key === key)?.value?.typed?.value;
  return typeof value === 'string' ? value : '';
};

export interface RoleBadge {
  resource: string;
  /** The roles this badge fills, already in words ("Owner", "Manager"…). */
  roles: string[];
}

interface RoleBadgesProps {
  t: ConsoleDictionary;
  title: string;
  badges: RoleBadge[];
  /** Whether the account holds the badge; undefined when no account is picked. */
  held: (resource: string) => boolean | undefined;
}

/**
 * The badges behind an entity's roles, as the selectable cards used for
 * resources elsewhere: name, icon and address, highlighted when the account
 * holds it, with the roles it grants and how many exist. A card opens the
 * badge in the explorer. Engine caller badges (a contract, a package) are
 * not something a person holds, so they are left out.
 */
export function RoleBadges({ t, title, badges, held }: RoleBadgesProps) {
  const labels = t.badges;
  const { language } = useLanguage();
  const { activeNetwork } = useRadixWallet();

  // One card per badge, with every role it fills.
  const merged = badges
    .filter((b) => !isGlobalCallerBadge(b.resource) && !isPackageCallerBadge(b.resource))
    .reduce<RoleBadge[]>((acc, b) => {
      const found = acc.find((x) => x.resource === b.resource);
      if (found) found.roles = [...new Set([...found.roles, ...b.roles])];
      else acc.push({ resource: b.resource, roles: [...b.roles] });
      return acc;
    }, []);
  const addresses = merged.map((b) => b.resource);

  const { data: meta } = useQuery({
    queryKey: ['console-role-badges', activeNetwork, addresses.join(',')],
    enabled: addresses.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const page = await gatewayPost<{
        items: Array<{ address: string; explicit_metadata?: MetadataList; details?: { total_supply?: string; type?: string } }>;
      }>(activeNetwork, '/state/entity/details', { addresses, opt_ins: { explicit_metadata: ['name', 'symbol', 'icon_url'] } });
      return Object.fromEntries(
        page.items.map((i) => [
          i.address,
          {
            name: readMeta(i.explicit_metadata, 'name') || readMeta(i.explicit_metadata, 'symbol'),
            iconUrl: readMeta(i.explicit_metadata, 'icon_url'),
            supply: i.details?.total_supply ?? '',
            nft: i.details?.type === 'NonFungibleResource',
          },
        ]),
      );
    },
  });

  if (merged.length === 0) return null;

  return (
    <div className="space-y-2">
      <Heading>{title}</Heading>
      <div className="space-y-3">
        {merged.map((badge) => {
          const info = meta?.[badge.resource];
          const isHeld = held(badge.resource);
          const rows: Array<[string, React.ReactNode]> = [
            [
              labels.grants,
              <span key="r" className="flex flex-wrap gap-1.5">
                {badge.roles.map((role) => (
                  <span
                    key={role}
                    className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                    style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-main)', background: 'var(--color-surface)' }}
                  >
                    {role}
                  </span>
                ))}
              </span>,
            ],
          ];
          if (info?.supply && !info.nft) {
            rows.push([labels.issuedLabel, Number(info.supply).toLocaleString(undefined, { maximumFractionDigits: 4 })]);
          }
          if (isHeld !== undefined) {
            rows.push([
              labels.yourAccount,
              <span
                key="h"
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={
                  isHeld
                    ? { background: 'color-mix(in srgb, var(--color-success) 14%, transparent)', color: 'var(--color-success)' }
                    : { background: 'color-mix(in srgb, var(--color-text-muted) 12%, transparent)', color: 'var(--color-text-muted)' }
                }
              >
                {isHeld ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
                {isHeld ? t.pool.youHold : t.pool.youDontHold}
              </span>,
            ]);
          }
          return (
            // The card on the left, its facts in a small table beside it (below it on a phone).
            <div key={badge.resource} className="grid grid-cols-1 items-center gap-3 sm:grid-cols-2 sm:gap-5">
              <ResourceCard
                isActive={!!isHeld}
                onClick={() => window.open(dashboardRoutes.entity(language, badge.resource, { network: activeNetwork }), '_blank', 'noopener')}
                name={info?.name || labels.unnamed}
                address={truncateAddress(badge.resource, 8, 6)}
                fullAddress={badge.resource}
                iconUrl={info?.iconUrl}
                title={badge.resource}
              />
              <dl className="divide-y divide-[var(--color-card-border)] text-xs">
                {rows.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 py-1.5">
                    <dt style={{ color: 'var(--color-text-muted)' }}>{label}</dt>
                    <dd className="text-right font-semibold" style={{ color: 'var(--color-text-main)' }}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </div>
    </div>
  );
}
