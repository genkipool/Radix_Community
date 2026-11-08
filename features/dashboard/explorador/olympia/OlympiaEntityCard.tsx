'use client';
/**
 * The explorer card for any Olympia identifier typed in the search box: picks
 * the card of its kind, and says plainly when the archive has no such thing.
 */
import React from 'react';
import type { ComponentType } from 'react';
import { History } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { olympiaKindOf, type OlympiaKind } from '@/features/dashboard/lib/olympia';
import { olympiaApi, olympiaKeys } from '@/features/dashboard/services/olympiaApi';
import type { AccountCardProps } from '../types/components.types';
import { olympiaDict, type OlympiaDict } from './dict';
import { OlympiaAccountCard } from './OlympiaAccountCard';
import { OlympiaResourceCard } from './OlympiaResourceCard';
import { OlympiaTxCard } from './OlympiaTxCard';
import { OlympiaValidatorCard } from './OlympiaValidatorCard';
import { Loading, OlympiaBadge } from './OlympiaParts';

const CARDS: Record<OlympiaKind, ComponentType<AccountCardProps>> = {
  account: OlympiaAccountCard,
  validator: OlympiaValidatorCard,
  resource: OlympiaResourceCard,
  tx: OlympiaTxCard,
};

/** The query each kind's card reads (same key), so this component can tell loading, found and not found apart. */
type Source = { key(v: string): readonly unknown[]; read(v: string): Promise<unknown> };

const SOURCES: Record<OlympiaKind, Source> = {
  account: { key: olympiaKeys.account, read: olympiaApi.account },
  validator: { key: olympiaKeys.validator, read: olympiaApi.validator },
  resource: { key: olympiaKeys.resource, read: olympiaApi.resource },
  tx: { key: olympiaKeys.tx, read: olympiaApi.tx },
};

function useExists(kind: OlympiaKind, value: string) {
  const source = SOURCES[kind];
  return useQuery({ queryKey: source.key(value), queryFn: () => source.read(value), staleTime: Infinity, gcTime: 30 * 60_000, retry: 1 });
}

function Notice({ o, title, desc }: { o: OlympiaDict; title: string; desc?: string }) {
  return (
    <Card className="col-span-full p-5 border border-amber-500/30 bg-[var(--color-surface)]">
      <div className="flex items-start gap-3">
        <History className="size-6 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2"><span className="text-sm font-bold text-[var(--color-text-main)]">{title}</span><OlympiaBadge o={o} className="ml-auto" /></div>
          {desc && <p className="text-xs text-[var(--color-text-muted)]">{desc}</p>}
        </div>
      </div>
    </Card>
  );
}

export function OlympiaEntityCard(props: AccountCardProps) {
  const value = props.address.trim();
  const kind = olympiaKindOf(value) ?? 'account';
  const o = olympiaDict(props.t?.dashboard?.transactions);
  const { data, isLoading, isError } = useExists(kind, value);
  if (isLoading) return <Card className="col-span-full p-5 bg-[var(--color-surface)]"><Loading text={o.loading} /></Card>;
  if (isError) return <Notice o={o} title={o.error} />;
  if (!data) return <Notice o={o} title={o.not_found} desc={o.not_found_desc} />;
  const Kind = CARDS[kind];
  return <Kind {...props} address={value} />;
}
