'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Landmark, ShieldCheck, Tags } from 'lucide-react';

import { useLanguage } from '@/context/LanguageContext';
import { BalanceCard } from '@/features/dashboard/explorador/components/AccountSummaryTab';
import { claimTimeLeft } from '@/features/dashboard/explorador/components/ValidatorSummaryMetrics';
import { useCopyToClipboard } from '@/features/dashboard/hooks/useCopyToClipboard';
import { useDashboardDictionary } from '@/features/dashboard/hooks/useDashboardDictionary';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { ValidatorExpandedBody, useValidatorList } from '@/features/dashboard/staking';
import { entityKeys } from '@/features/dashboard/utils/entityCache';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { truncateAddress } from '@/utils/formatters';
import { useAccountResources } from '../../hooks/useAccountResources';
import { useConsoleQueryState } from '../../hooks/useConsoleQueryState';
import { useClaimableNfts } from '../../hooks/useClaimableNfts';
import { useOwnedValidators } from '../../hooks/useOwnedValidators';
import { useTopHolders } from '../../hooks/useTopHolders';
import { parseValidatorState } from '../../lib/validator-lookup';
import type { ConsoleDictionary } from '../../types/i18n.types';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { AccountPicker } from '../shared/AccountPicker';
import { CardSkeleton, cardError, EntityCard, EntityCardMessage, Heading, Note, fmtNumber as fmt, type NoteTone } from '../shared/InfoParts';
import { MultiAddressSelect, addressesFromUrl } from '../shared/MultiAddressSelect';
import { ToolSection } from '../shared/ToolSection';
import { TopHoldersList } from '../shared/TopHoldersList';
import { accountFromQuery, toolQuery } from '../../lib/console-query';

/**
 * Read-only view of one or several validators for whoever is about to stake
 * or runs them: the same profile, delegation, performance and history the
 * staking list and the explorer show (their own blocks), the largest stakers,
 * the account's stake and pending withdrawals, and shortcuts to the tools that
 * act on them. Nothing here is signed.
 */
export default function ValidatorInfoTool({ t }: ConsoleToolProps) {
  const info = t.validator.info;
  const [account, setAccount] = useConsoleQueryState<string | null>(accountFromQuery, null);
  const [validators, setValidators] = useConsoleQueryState<string[]>(() => addressesFromUrl('validator'), []);
  const { data: owned } = useOwnedValidators(account);

  return (
    <div className="space-y-5">
      <ToolSection title={info.contextTitle}>
        <div className="space-y-5">
          <div className="flex flex-col gap-2">
            <Heading>{t.pool.accountLabel}</Heading>
            <AccountPicker value={account} onChange={setAccount} />
          </div>
          <MultiAddressSelect
            label={info.validatorLabel}
            kind="validator"
            values={validators}
            onChange={setValidators}
            suggestions={(owned ?? []).map((o) => ({
              address: o.address,
              label: o.name || truncateAddress(o.address, 10, 6),
              description: o.name ? truncateAddress(o.address, 8, 6) : undefined,
            }))}
            placeholder="validator_rdx1…"
          />
        </div>
      </ToolSection>

      {validators.map((address) => (
        <ValidatorInfoCard
          key={address}
          t={t}
          address={address}
          account={account}
          isOwner={!!owned?.some((o) => o.address === address)}
          onRemove={() => setValidators((v) => v.filter((a) => a !== address))}
        />
      ))}
    </div>
  );
}

interface CardProps {
  t: ConsoleDictionary;
  address: string;
  account: string | null;
  isOwner: boolean;
  onRemove: () => void;
}

function ValidatorInfoCard({ t, address, account, isOwner, onRemove }: CardProps) {
  const info = t.validator.info;
  const { language } = useLanguage();
  // The staking and explorer blocks below speak the dashboard's words.
  const site = useDashboardDictionary();
  const { activeNetwork } = useRadixWallet();
  const { copiedText, copy } = useCopyToClipboard();

  // The ledger is the truth for "is this a validator at all". Same cache entry
  // as the explorer's card for this address, so either fills it for the other.
  const { data: details, isLoading, error } = useQuery({
    queryKey: entityKeys.full(address, activeNetwork),
    staleTime: 60_000,
    retry: false,
    queryFn: () => apiFetchEntityDetails(address, activeNetwork),
  });
  const state = details ? parseValidatorState(details) : null;
  const currentEpoch = (details as { ledger_state?: { epoch?: number } } | undefined)?.ledger_state?.epoch;
  // Rank, uptime, APY and the rest come from the site's validator set, the
  // entry the staking list and the explorer use, so it is usually loaded.
  const { data: list } = useValidatorList(activeNetwork, !!state);
  const { data: holdings } = useAccountResources(state ? account : null);
  const { data: claimNfts } = useClaimableNfts(state ? account : null);
  const { data: stakers } = useTopHolders(state?.stakeUnitResource, activeNetwork);

  if (isLoading) return <CardSkeleton />;
  if (!state) {
    return (
      <EntityCardMessage
        address={address}
        message={cardError(error, info.notAValidator)}
        onRemove={onRemove}
        removeLabel={info.remove}
      />
    );
  }

  const listed = list?.validators.find((entry) => entry.address === address);
  // Delegators: every address holding the LSU, counted live by the Gateway with
  // the stakers read below, so the list's title and the delegation figures say
  // the same; the list's count until then.
  const liveDelegators = stakers ? stakers.total ?? stakers.holders.length : undefined;
  const v = listed && { ...listed, delegators: liveDelegators ?? listed.delegators };
  const as = site?.dashboard?.transactions?.account_summary;
  const lsuHeld = Number(holdings?.fungibles.find((f) => f.resourceAddress === state.stakeUnitResource)?.amount ?? 0);
  const claims = (claimNfts ?? []).filter((nft) => nft.validatorAddress === address);
  const ready = claims.filter((c) => c.isClaimable).reduce((sum, c) => sum + c.amount, 0);
  const waiting = claims.filter((c) => !c.isClaimable);
  const name = v?.name && v.name !== address ? v.name : '';
  const fee = v?.nominalFee ?? Number(state.feeFactor) * 100;
  const feeUp = v?.hasPendingFeeChange && v.upcomingFee !== undefined && v.upcomingFee > fee;

  const notes = [
    !state.isRegistered && { tone: 'danger', text: info.noteUnregistered },
    !state.acceptsDelegatedStake && { tone: 'muted', text: info.noteClosed },
    fee >= 100 && { tone: 'danger', text: info.noteFeeAll },
    feeUp && { tone: 'danger', text: info.noteFeeUp.replace('{fee}', fmt(v!.upcomingFee!)) },
    v?.onlineStatus === false && { tone: 'danger', text: info.noteOffline },
  ].filter((n): n is { tone: NoteTone; text: string } => !!n);

  const status = [
    state.isRegistered ? [info.registered, true] : [info.unregistered, false],
    v && (v.status === 'active' ? [info.active, true] : [info.inactive, false]),
    state.acceptsDelegatedStake ? [info.acceptsStake, true] : [info.closedStake, false],
    v?.onlineStatus === true ? [info.online, true] : v?.onlineStatus === false ? [info.offline, false] : null,
  ].filter((s): s is [string, boolean] => !!s);

  const tool = (slug: 'staking' | 'validator-profile' | 'validator-registration' | 'validator-staking') => {
    // The tool opens with the same account and, for Staking, this validator already picked.
    const query = toolQuery({ validator: slug === 'staking' ? address : null, account });
    return {
      href: `/${language}/console/${slug}${query ? `?${query}` : ''}`,
      label: t.tools[slug].title,
      tool: { slug, query },
    };
  };

  return (
    <EntityCard
      address={address}
      name={name || info.unnamed}
      iconUrl={v?.iconUrl}
      meta={
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold">
          {status.map(([label, good]) => (
            <span key={label} style={{ color: good ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {label}
            </span>
          ))}
        </p>
      }
      // The profile block below shows both once the dashboard's words arrive.
      description={v && site ? undefined : v?.description}
      url={v && site ? undefined : v?.website}
      onRemove={onRemove}
      removeLabel={info.remove}
      copyLabel={t.common.copy}
      shortcuts={[
        { ...tool('staking'), icon: <Landmark className="size-4" /> },
        ...(isOwner
          ? [
              { ...tool('validator-profile'), icon: <Tags className="size-4" /> },
              { ...tool('validator-registration'), icon: <ShieldCheck className="size-4" /> },
              { ...tool('validator-staking'), icon: <Landmark className="size-4" /> },
            ]
          : []),
        { href: `/${language}/dashboard/validator/${address}`, label: info.goDashboard, icon: <ExternalLink className="size-4" /> },
      ]}
    >
      {notes.length > 0 && (
        <div className="space-y-2">
          {notes.map((n) => (
            <Note key={n.text} tone={n.tone}>
              {n.text}
            </Note>
          ))}
        </div>
      )}

      {v && site && (
        // The staking list's expanded card, without its Stake button: the
        // console's own shortcuts above do that.
        <ValidatorExpandedBody
          validator={v}
          t={site}
          onCopy={copy}
          copiedAddress={copiedText}
          network={activeNetwork}
          columns={2}
          hideCta
          locale={language}
        />
      )}

      {stakers && stakers.holders.length > 0 && v && v.lsu2xrdFactor > 0 && (
        <div className="space-y-2">
          <Heading>{info.topStakersTitle.replace('{count}', fmt(liveDelegators ?? stakers.holders.length, 0))}</Heading>
          <TopHoldersList
            holders={stakers.holders}
            supply={v.delegatedStake / v.lsu2xrdFactor}
            unit="LSU"
            network={activeNetwork}
            copyLabel={t.common.copy}
            detail={(holder) => info.worth.replace('{amount}', fmt(Number(holder.amount) * v.lsu2xrdFactor, 2))}
          />
        </div>
      )}

      <div className="space-y-2">
        {!account ? (
          <>
            <Heading>{info.positionTitle}</Heading>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{info.pickAccount}</p>
          </>
        ) : lsuHeld > 0 || claims.length > 0 ? (
          <>
            <Heading>{info.positionTitle}</Heading>
            {/* The explorer account card's balance tiles: staked, on its way out, ready to claim. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
              <BalanceCard
                title={as?.stake_xrd || 'Stake XRD'}
                amount={String(v && v.lsu2xrdFactor > 0 ? lsuHeld * v.lsu2xrdFactor : 0)}
                symbol="XRD"
                valueColor="text-[var(--color-primary)]"
                locale={language}
                note={lsuHeld > 0 && <span className="font-mono">{fmt(lsuHeld, 4)} LSU</span>}
              />
              <BalanceCard
                title={as?.unstake_xrd || 'Unstake XRD'}
                amount={String(waiting.reduce((sum, c) => sum + c.amount, 0))}
                symbol="XRD"
                valueColor="text-[var(--color-secondary)]"
                locale={language}
                note={waiting.map((c) => (
                  <span key={c.localId} title={info.claimAtEpoch.replace('{epoch}', String(c.claimEpoch))}>
                    {fmt(c.amount, 2)} XRD · {claimTimeLeft(c.claimEpoch, currentEpoch, as)}
                  </span>
                ))}
              />
              <BalanceCard
                title={as?.claim_xrd || 'Claim XRD'}
                amount={String(ready)}
                symbol="XRD"
                valueColor="text-[var(--color-accent)]"
                locale={language}
                note={ready > 0 && (as?.claim_ready || 'Ready to claim')}
              />
            </div>
          </>
        ) : (
          <>
            <Heading>{info.positionTitle}</Heading>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{info.noPosition}</p>
          </>
        )}
        {isOwner && (
          <p className="text-xs font-semibold" style={{ color: 'var(--color-success)' }}>{info.youOwn}</p>
        )}
      </div>
    </EntityCard>
  );
}
