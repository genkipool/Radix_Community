'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { AccountStakingSection } from '@/features/dashboard/staking/components/AccountStakingSection';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { entityKeys } from '@/features/dashboard/utils/entityCache';
import { useCopyToClipboard } from '@/features/dashboard/hooks/useCopyToClipboard';
import dashboardExploradorEn from '@/features/dashboard/explorador/locales/en.json';
import dashboardExploradorEs from '@/features/dashboard/explorador/locales/es.json';
import dashboardStakingEn from '@/features/dashboard/staking/locales/en.json';
import dashboardStakingEs from '@/features/dashboard/staking/locales/es.json';

import type { ConsoleToolProps } from '../ConsoleToolView';
import { ToolSection } from '../shared/ToolSection';
import { AccountPicker } from '../shared/AccountPicker';

type StakingSectionTranslations = Parameters<typeof AccountStakingSection>[0]['tt'];
type StakingSectionErrors = Parameters<typeof AccountStakingSection>[0]['stakingErrors'];

/**
 * Staking tool — the same per-validator staking section used in the wallet
 * profile modal (stake, unstake, claim, batch and owner mode), scoped to the
 * account picked in the console.
 */
export default function StakingTool({ t }: ConsoleToolProps) {
  const labels = t.staking;
  const { t: fullDictionary, language } = useLanguage();
  const { activeNetwork } = useRadixWallet();
  const { copiedText, copy } = useCopyToClipboard();

  const [account, setAccount] = useState<string | null>(null);

  const { data: entityData } = useQuery({
    queryKey: entityKeys.detail(account ?? '', activeNetwork),
    queryFn: () => apiFetchEntityDetails(account!, activeNetwork, true),
    enabled: !!account,
    staleTime: 0,
    gcTime: 10 * 60_000,
  });

  const dashboardLocale = language === 'es' ? dashboardExploradorEs : dashboardExploradorEn;
  const stakingLocale = language === 'es' ? dashboardStakingEs : dashboardStakingEn;
  const tt = (fullDictionary?.dashboard?.transactions ||
    dashboardLocale.dashboard.transactions) as unknown as StakingSectionTranslations;
  const stakingErrors = (fullDictionary?.dashboard?.staking?.errors ||
    stakingLocale.dashboard.staking.errors) as unknown as StakingSectionErrors;

  return (
    <div className="space-y-5">
      <ToolSection title={labels.accountTitle}>
        <AccountPicker value={account} onChange={setAccount} />
      </ToolSection>

      {account && (
        <ToolSection title={labels.sectionTitle}>
          <AccountStakingSection
            address={account}
            entityData={entityData ?? null}
            network={activeNetwork}
            locale={language}
            tt={tt}
            onCopy={copy}
            copiedAddress={copiedText}
            isModal
            alwaysShowControls
            summaryPlacement="side"
            stakingErrors={stakingErrors}
          />
        </ToolSection>
      )}
    </div>
  );
}
