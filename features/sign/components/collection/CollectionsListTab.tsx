'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { BadgeCheck, Check, ChevronDown, ExternalLink, Plus } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { SafeImage } from '@/components/ui/SafeImage';
import { useLanguage } from '@/context/LanguageContext';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { useNftData } from '@/features/console/hooks/useNftData';
import { NftCollectionPanel } from '@/features/dashboard/explorador/components/NftCollectionPanel';
import { ResourceInlinePanel } from '@/features/dashboard/explorador/components/ResourceInlinePanel';
import { entityKeys } from '@/features/dashboard/hooks/useEntityData';
import { networkOfAddress } from '@/features/dashboard/lib/routes';
import {
  apiFetchEntityDetails,
  apiFetchNonFungibleData,
} from '@/features/dashboard/services/apiClient';
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

function useResourcePanelState(resourceAddress: string, enabled: boolean) {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const { t, language } = useLanguage();
  const network = networkOfAddress(resourceAddress) ?? 'mainnet';
  const tt = t?.dashboard?.transactions;

  const { data: entityDetails, isLoading: detailsLoading } = useQuery({
    queryKey: entityKeys.full(resourceAddress, network),
    queryFn: () => apiFetchEntityDetails(resourceAddress, network),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 10,
    retry: 2,
    enabled,
  });

  const handleCopy = (addr: string) => {
    navigator.clipboard?.writeText(addr).catch(() => {});
    setCopiedAddress(addr);
    setTimeout(() => setCopiedAddress((cur) => (cur === addr ? null : cur)), 2000);
  };

  return {
    entityDetails: entityDetails ?? null,
    detailsLoading,
    copiedAddress,
    handleCopy,
    tt,
    network,
    language,
  };
}

function SealRowCard({
  seal,
  inUse,
  imageUrl,
  name,
  labels,
}: {
  seal: SealItem;
  inUse: boolean;
  imageUrl?: string | null;
  name: string;
  labels: CollectionLabels;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const sealResource = splitNftGlobalId(seal.globalId).resource;
  const panel = useResourcePanelState(sealResource, detailsOpen);
  const { data: nftData, isLoading: nftLoading } = useQuery({
    queryKey: ['nft-raw-data', panel.network, sealResource, seal.localId],
    queryFn: () =>
      apiFetchNonFungibleData(sealResource, [seal.localId], panel.network),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 10,
    retry: 2,
    enabled: detailsOpen,
  });

  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{
        borderColor: inUse
          ? 'var(--color-primary)'
          : 'var(--color-card-border)',
        background: 'var(--color-surface)',
      }}
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <span className="flex min-w-0 items-center gap-3">
          <SafeImage
            src={imageUrl ?? undefined}
            alt={name}
            fallbackName={name}
            className="size-11 shrink-0 rounded-lg object-cover"
          />
          <span className="min-w-0">
            <span
              className="block truncate text-sm font-bold"
              style={{ color: 'var(--color-text-main)' }}
            >
              {name}
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
        <div className="flex shrink-0 items-center gap-3">
          {inUse && (
            <span
              className="flex shrink-0 items-center gap-1 text-[11px] font-semibold"
              style={{ color: 'var(--color-primary)' }}
            >
              <BadgeCheck className="size-3.5" />
              {labels.seals.inUse}
            </span>
          )}
          <button
            type="button"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((prev) => !prev)}
            className="inline-flex shrink-0 items-center justify-end gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-card-bg)] hover:text-[var(--color-primary)] cursor-pointer sm:w-[84px]"
          >
            <span>{labels.list.details}</span>
            <ChevronDown
              className={`size-3.5 shrink-0 transition-transform duration-200 ${
                detailsOpen ? 'rotate-180 text-[var(--color-primary)]' : ''
              }`}
            />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {detailsOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-[var(--color-card-border)]"
          >
            <NftCollectionPanel
              resourceAddress={sealResource}
              meta={panel.entityDetails}
              nftData={(nftData ?? []) as unknown as Record<string, unknown>[]}
              nftLoading={panel.detailsLoading || nftLoading}
              ids={[seal.localId]}
              type="neutral"
              onCopy={panel.handleCopy}
              copiedAddress={panel.copiedAddress}
              tt={panel.tt}
              network={panel.network}
              locale={panel.language}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CollectionRowCard({
  collection,
  isActive,
  isVerified,
  isChecking,
  domainTooltip,
  labels,
  onSelect,
  onOpenDomainDrawer,
}: {
  collection: SignCollectionItem;
  isActive: boolean;
  isVerified: boolean;
  isChecking: boolean;
  domainTooltip: string;
  labels: CollectionLabels;
  onSelect: () => void;
  onOpenDomainDrawer: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const panel = useResourcePanelState(collection.resourceAddress, detailsOpen);

  return (
    <div
      className={`overflow-hidden rounded-xl border transition-colors ${
        isActive ? '' : 'hover:border-[var(--color-primary)] cursor-pointer'
      }`}
      style={{
        borderColor: isActive
          ? 'var(--color-primary)'
          : 'var(--color-card-border)',
        background: 'var(--color-surface)',
      }}
      onClick={() => {
        if (!isActive) onSelect();
      }}
    >
      <div className="flex w-full flex-wrap items-center justify-between gap-3 px-3 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <SafeImage
            src={collection.iconUrl}
            alt={collection.name || labels.list.untitled}
            fallbackName={collection.name || collection.resourceAddress}
            className="size-11 shrink-0 rounded-lg object-cover"
          />
          <div className="min-w-0">
            <div
              className="truncate text-sm font-bold"
              style={{ color: 'var(--color-text-main)' }}
              title={collection.resourceAddress}
            >
              {collection.name || labels.list.untitled}
            </div>
            <span className="flex min-w-0 items-center gap-1">
              <span
                className="truncate font-mono text-[11px]"
                style={{ color: 'var(--color-text-muted)' }}
                title={collection.resourceAddress}
              >
                {truncateAddress(collection.resourceAddress)}
              </span>
              <CopyButton
                value={collection.resourceAddress}
                variant="minimal"
                size="xs"
              />
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3 sm:grid sm:grid-cols-[200px_116px_164px_84px] sm:items-center sm:gap-3">
          <div className="min-w-0 sm:w-[200px] sm:text-right">
            {collection.orgUrl && (
              <a
                href={collection.orgUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={collection.orgUrl}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex max-w-full items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
              >
                <span className="truncate">{collection.orgUrl}</span>
                <ExternalLink className="size-3 shrink-0" />
              </a>
            )}
          </div>
          <div
            className="flex sm:w-[116px] sm:justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <DomainStatusButton
              size="xs"
              verified={isVerified}
              checking={isChecking}
              verifiedLabel={labels.list.domainVerified}
              unverifiedLabel={labels.list.domainUnverified}
              checkingLabel={labels.list.domainChecking}
              title={domainTooltip}
              onClick={onOpenDomainDrawer}
            />
          </div>
          <div className="flex shrink-0 items-center justify-end gap-3 sm:w-[164px]">
            <span
              className="text-[11px] tabular-nums sm:w-[76px] sm:text-right truncate"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {labels.list.records.replace(
                '{count}',
                String(collection.totalSupply),
              )}
            </span>
            <span
              className="flex items-center justify-end gap-1 text-[11px] font-semibold sm:w-[76px]"
              style={{
                color: isActive
                  ? 'var(--color-primary)'
                  : 'var(--color-text-muted)',
              }}
            >
              {isActive && <Check className="size-3.5 shrink-0" />}
              {isActive ? labels.list.active : labels.list.use}
            </span>
          </div>
          <button
            type="button"
            aria-expanded={detailsOpen}
            onClick={(e) => {
              e.stopPropagation();
              setDetailsOpen((prev) => !prev);
            }}
            className="inline-flex shrink-0 items-center justify-end gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-card-bg)] hover:text-[var(--color-primary)] cursor-pointer sm:w-[84px]"
          >
            <span>{labels.list.details}</span>
            <ChevronDown
              className={`size-3.5 shrink-0 transition-transform duration-200 ${
                detailsOpen ? 'rotate-180 text-[var(--color-primary)]' : ''
              }`}
            />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {detailsOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="overflow-hidden border-t border-[var(--color-card-border)]"
          >
            <ResourceInlinePanel
              address={collection.resourceAddress}
              details={panel.entityDetails}
              loading={panel.detailsLoading}
              onCopy={panel.handleCopy}
              copiedAddress={panel.copiedAddress}
              tt={panel.tt}
              network={panel.network}
              locale={panel.language}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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
                <SealRowCard
                  key={seal.globalId}
                  seal={seal}
                  inUse={inUse}
                  imageUrl={data?.imageUrl}
                  name={data?.name || labels.seals.title}
                  labels={labels}
                />
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
                <CollectionRowCard
                  key={collection.resourceAddress}
                  collection={collection}
                  isActive={isActive}
                  isVerified={isVerified}
                  isChecking={isChecking}
                  domainTooltip={domainTooltip}
                  labels={labels}
                  onSelect={() => setup.selectCollection(collection.resourceAddress)}
                  onOpenDomainDrawer={() =>
                    setDrawerCollectionAddr(collection.resourceAddress)
                  }
                />
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
