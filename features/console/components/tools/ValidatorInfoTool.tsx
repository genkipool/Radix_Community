'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Landmark, ShieldCheck, Tags } from 'lucide-react';

import { useLanguage } from '@/context/LanguageContext';
import { apiFetchEntityDetails, apiFetchValidators } from '@/features/dashboard/services/apiClient';
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
import { CardSkeleton, cardError, EntityCard, EntityCardMessage, Facts, Heading, Note, Sub, fmtNumber as fmt, type NoteTone } from '../shared/InfoParts';
import { MultiAddressSelect, addressesFromUrl } from '../shared/MultiAddressSelect';
import { ToolSection } from '../shared/ToolSection';
import { TopHoldersList } from '../shared/TopHoldersList';
import { accountFromQuery, toolQuery } from '../../lib/console-query';

/**
 * Read-only view of one or several validators for whoever is about to stake
 * or runs them: their public profile, the figures that matter when choosing
 * (stake, fee, uptime, APY), the account's stake and pending withdrawals, and
 * shortcuts to the tools that act on them. Nothing here is signed.
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
  const { activeNetwork } = useRadixWallet();

  // The ledger is the truth for "is this a validator at all".
  const { data: state, isLoading, error } = useQuery({
    queryKey: ['console-validator-info-state', activeNetwork, address],
    staleTime: 60_000,
    retry: false,
    queryFn: async () => parseValidatorState(await apiFetchEntityDetails(address, activeNetwork)),
  });
  // Rank, uptime, APY and the rest come from the site's cached validator set,
  // the same query the address picker uses, so it is usually already loaded.
  const { data: list } = useQuery({
    queryKey: ['console-picker-validators', activeNetwork],
    enabled: !!state,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => (await apiFetchValidators(activeNetwork)).validators,
  });
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

  const v = list?.find((entry) => entry.address === address);
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
      description={v?.description}
      url={v?.website}
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

      <div className="space-y-2">
        <Heading>{info.figuresTitle}</Heading>
        <Facts
          rows={[
            v && [
              info.stake,
              <>
                {fmt(v.delegatedStake, 0)} XRD
                {v.rank > 0 && (
                  <Sub>{info.stakeShare.replace('{percent}', fmt(v.delegatedStakePercent)).replace('{rank}', String(v.rank))}</Sub>
                )}
              </>,
            ],
            [
              info.fee,
              <>
                {fmt(fee)} %
                {v?.hasPendingFeeChange && v.upcomingFee !== undefined && <Sub>{info.feeChange.replace('{fee}', fmt(v.upcomingFee))}</Sub>}
              </>,
            ],
            v && v.apy > 0 && [info.apy, `${fmt(v.apy)} %`],
            v && [
              info.uptime,
              <>
                {fmt(v.recentUptime)} %
                <Sub>{info.uptimeSub.replace('{total}', fmt(v.totalUptime))}</Sub>
              </>,
            ],
            v && [info.ownerStake, `${fmt(v.ownerDelegation, 0)} XRD`],
            v && v.delegators > 0 && [info.delegators, fmt(v.delegators, 0)],
            v && v.lsu2xrdFactor > 0 && [info.lsuValue, `${fmt(v.lsu2xrdFactor, 6)} XRD`],
          ]}
        />
      </div>

      {stakers && stakers.holders.length > 0 && v && v.lsu2xrdFactor > 0 && (
        <div className="space-y-2">
          <Heading>{info.topStakersTitle.replace('{count}', String(stakers.total ?? stakers.holders.length))}</Heading>
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
        <Heading>{info.positionTitle}</Heading>
        {!account ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{info.pickAccount}</p>
        ) : lsuHeld > 0 || claims.length > 0 ? (
          <Facts
            rows={[
              lsuHeld > 0 && [
                info.yourLsu,
                <>
                  {fmt(lsuHeld, 4)} LSU
                  {v && v.lsu2xrdFactor > 0 && <Sub>{info.worth.replace('{amount}', fmt(lsuHeld * v.lsu2xrdFactor, 4))}</Sub>}
                </>,
              ],
              ready > 0 && [info.claimReady, `${fmt(ready, 4)} XRD`],
              waiting.length > 0 && [
                info.claimWaiting,
                waiting.map((c) => (
                  <span key={c.localId} className="block">
                    {info.claimAt.replace('{amount}', fmt(c.amount, 4)).replace('{epoch}', String(c.claimEpoch))}
                  </span>
                )),
              ],
            ]}
          />
        ) : (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{info.noPosition}</p>
        )}
        {isOwner && (
          <p className="text-xs font-semibold" style={{ color: 'var(--color-success)' }}>{info.youOwn}</p>
        )}
      </div>
    </EntityCard>
  );
}
