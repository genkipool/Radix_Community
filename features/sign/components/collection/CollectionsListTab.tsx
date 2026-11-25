'use client';

import { useState } from 'react';
import { BadgeCheck, Check, ExternalLink, Plus } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { SafeImage } from '@/components/ui/SafeImage';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { useNftData } from '@/features/console/hooks/useNftData';
import { truncateAddress } from '@/utils/formatters';
import {
  useCollectionsDomainVerification,
  useDomainVerification,
} from '../../hooks/useDomainVerification';
import { splitNftGlobalId } from '../../lib/network';
import {
  shortLocalId,
  type CollectionLabels,
  type SealItem,
  type SealSetupState,
  type SignCollectionItem,
} from './CollectionPrimitives';
import {
  DomainStatusButton,
  DomainVerificationDrawer,
} from './DomainVerificationDrawer';

export function CollectionsListTab({
  labels,
  account,
  setup,
  seals,
  collections,
  loading,
  onCreate,
}: {
  labels: CollectionLabels;
  account: string | null;
  setup: SealSetupState;
  seals: SealItem[];
  collections: SignCollectionItem[];
  loading: boolean;
  onCreate: () => void;
}) {
  const [drawerCollectionAddr, setDrawerCollectionAddr] = useState<string | null>(
    null,
  );
  const sealResource = seals[0]
    ? splitNftGlobalId(seals[0].globalId).resource
    : null;
  const { data: sealData } = useNftData(
    sealResource,
    seals.map((s) => s.localId),
  );
  const domainStatuses = useCollectionsDomainVerification(collections, account);
  const drawerCollection = drawerCollectionAddr
    ? (collections.find((c) => c.resourceAddress === drawerCollectionAddr) ??
      null)
    : null;
  const drawerCheck = useDomainVerification({
    orgUrl: drawerCollection?.orgUrl,
    collection: drawerCollection?.resourceAddress ?? null,
    account,
  });

  return (
    <div className="space-y-6">
      <ToolSection title={labels.seals.title} hint={labels.seals.hint}>
        {seals.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {labels.seals.none}
          </p>
        ) : (
          <div className="space-y-1.5">
            {seals.map((seal) => {
              const inUse = setup.seal?.globalId === seal.globalId;
              const data = sealData?.find((d) => d.id === seal.localId);
              return (
                <div
                  key={seal.globalId}
                  className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5"
                  style={{
                    borderColor: inUse
                      ? 'var(--color-primary)'
                      : 'var(--color-card-border)',
                    background: 'var(--color-surface)',
                  }}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <SafeImage
                      src={data?.imageUrl}
                      alt={data?.name || labels.seals.title}
                      fallbackName={data?.name || labels.seals.title}
                      className="size-11 shrink-0 rounded-lg object-cover"
                    />
                    <span className="min-w-0">
                      <span
                        className="block truncate text-sm font-bold"
                        style={{ color: 'var(--color-text-main)' }}
                      >
                        {data?.name || labels.seals.title}
                      </span>
                      <span className="flex min-w-0 items-center gap-1">
                        <span
                          className="truncate font-mono text-[11px]"
                          style={{ color: 'var(--color-text-muted)' }}
                          title={seal.localId}
                        >
                          {shortLocalId(seal.localId)}
                        </span>
                        <CopyButton value={seal.localId} variant="minimal" size="xs" />
                      </span>
                    </span>
                  </span>
                  {inUse && (
                    <span
                      className="flex shrink-0 items-center gap-1 text-[11px] font-semibold"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      <BadgeCheck className="size-3.5" />
                      {labels.seals.inUse}
                    </span>
                  )}
                </div>
              );
            })}
            {seals.length > 1 && (
              <p
                className="text-xs leading-relaxed"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {labels.seals.severalNote}
              </p>
            )}
          </div>
        )}
      </ToolSection>

      <ToolSection title={labels.list.title} hint={labels.list.hint}>
        {loading && (
          <p
            className="flex items-center gap-2 text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <span className="size-3.5 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
            {labels.list.loading}
          </p>
        )}
        {!loading && collections.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {labels.list.none}
            </p>
            <button
              type="button"
              onClick={onCreate}
              className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95"
            >
              <Plus className="size-4" />
              {labels.list.createFirst}
            </button>
          </div>
        )}
        {collections.length > 0 && (
          <div className="space-y-1.5">
            {collections.map((collection) => {
              const isActive = collection.resourceAddress === setup.activeAddress;
              const domainStatus = domainStatuses.get(collection.resourceAddress);
              const isVerified =
                !!domainStatus?.result?.verified &&
                domainStatus.result.domain === domainStatus.domain;
              const isChecking = !!domainStatus?.checking;
              const domainTooltip = isVerified
                ? labels.list.domainVerifiedTooltip
                    .replace('{domain}', domainStatus.result?.domain ?? '')
                    .replace(
                      '{method}',
                      domainStatus.result?.method === 'dns-txt'
                        ? 'DNS TXT'
                        : '.well-known/radix-seal.json',
                    )
                : domainStatus?.domain
                  ? labels.list.domainUnverifiedTooltip.replace(
                      '{domain}',
                      domainStatus.domain,
                    )
                  : labels.list.domainNoUrlTooltip;

              return (
                <div
                  key={collection.resourceAddress}
                  className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                    isActive
                      ? ''
                      : 'hover:border-[var(--color-primary)]'
                  }`}
                  style={{
                    borderColor: isActive
                      ? 'var(--color-primary)'
                      : 'var(--color-card-border)',
                    background: 'var(--color-surface)',
                  }}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() =>
                        !isActive && setup.selectCollection(collection.resourceAddress)
                      }
                      title={collection.resourceAddress}
                      className={`shrink-0 ${
                        isActive ? 'cursor-default' : 'cursor-pointer'
                      }`}
                    >
                      <SafeImage
                        src={collection.iconUrl}
                        alt={collection.name || labels.list.untitled}
                        fallbackName={collection.name || collection.resourceAddress}
                        className="size-11 shrink-0 rounded-lg object-cover"
                      />
                    </button>
                    <div className="min-w-0">
                      <button
                        type="button"
                        aria-pressed={isActive}
                        onClick={() =>
                          !isActive && setup.selectCollection(collection.resourceAddress)
                        }
                        title={collection.resourceAddress}
                        className={`block max-w-full truncate text-left text-sm font-bold ${
                          isActive ? 'cursor-default' : 'cursor-pointer'
                        }`}
                        style={{ color: 'var(--color-text-main)' }}
                      >
                        {collection.name || labels.list.untitled}
                      </button>
                      <span className="flex min-w-0 items-center gap-1">
                        <button
                          type="button"
                          aria-pressed={isActive}
                          onClick={() =>
                            !isActive && setup.selectCollection(collection.resourceAddress)
                          }
                          title={collection.resourceAddress}
                          className={`truncate font-mono text-[11px] ${
                            isActive ? 'cursor-default' : 'cursor-pointer'
                          }`}
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          {truncateAddress(collection.resourceAddress)}
                        </button>
                        <CopyButton
                          value={collection.resourceAddress}
                          variant="minimal"
                          size="xs"
                        />
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-3">
                    {collection.orgUrl && (
                      <a
                        href={collection.orgUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={collection.orgUrl}
                        className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline truncate max-w-[220px]"
                      >
                        <span className="truncate">{collection.orgUrl}</span>
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                    )}
                    <DomainStatusButton
                      size="xs"
                      verified={isVerified}
                      checking={isChecking}
                      verifiedLabel={labels.list.domainVerified}
                      unverifiedLabel={labels.list.domainUnverified}
                      checkingLabel={labels.list.domainChecking}
                      title={domainTooltip}
                      onClick={() =>
                        setDrawerCollectionAddr(collection.resourceAddress)
                      }
                    />
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() =>
                        !isActive && setup.selectCollection(collection.resourceAddress)
                      }
                      className={`flex shrink-0 items-center gap-3 ${
                        isActive ? 'cursor-default' : 'cursor-pointer'
                      }`}
                    >
                      <span
                        className="text-[11px]"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {labels.list.records.replace(
                          '{count}',
                          String(collection.totalSupply),
                        )}
                      </span>
                      <span
                        className="flex items-center gap-1 text-[11px] font-semibold"
                        style={{
                          color: isActive
                            ? 'var(--color-primary)'
                            : 'var(--color-text-muted)',
                        }}
                      >
                        {isActive && <Check className="size-3.5" />}
                        {isActive ? labels.list.active : labels.list.use}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
            {collections.length > 1 && (
              <p
                className="text-xs leading-relaxed"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {labels.list.severalNote}
              </p>
            )}
          </div>
        )}
      </ToolSection>

      {drawerCollection && (
        <DomainVerificationDrawer
          isOpen
          onClose={() => setDrawerCollectionAddr(null)}
          labels={labels.identity.domainVerify}
          collection={drawerCollection.resourceAddress}
          domain={drawerCheck.domain}
          result={drawerCheck.result}
          checking={drawerCheck.checking}
          error={drawerCheck.error}
          onCheckNow={() => void drawerCheck.refetch()}
        />
      )}
    </div>
  );
}
