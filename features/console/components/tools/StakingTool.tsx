'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid, Split } from 'lucide-react';

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
import { OptionButtons } from '../shared/OptionButtons';

type StakingSectionTranslations = Parameters<typeof AccountStakingSection>[0]['tt'];
type StakingSectionErrors = Parameters<typeof AccountStakingSection>[0]['stakingErrors'];

/** The two ways of staking to more than one validator at once. */
type StakingTab = 'distributed' | 'multiple';

/**
 * Staking tool — the same per-validator staking section used in the wallet
 * profile modal (stake, unstake, claim, batch and owner mode), scoped to the
 * account picked in the console.
 *
 * The section emits two zones, and they answer different questions: the
 * distribution panel splits ONE amount equally across the validators you
 * select, while the validator list takes a DIFFERENT amount per validator and
 * combines them into a single transaction. Stacked they read as one long page
 * where the second half looks like a detail of the first; as tabs the choice
 * is explicit.
 *
 * Both stay mounted so the selected validators, the amounts typed and the
 * mixed-operation cart survive switching between them.
 */
export default function StakingTool({ t }: ConsoleToolProps) {
  const labels = t.staking;
  const { t: fullDictionary, language } = useLanguage();
  const { activeNetwork } = useRadixWallet();
  const { copiedText, copy } = useCopyToClipboard();

  const [account, setAccount] = useState<string | null>(null);
  const [tab, setTab] = useState<StakingTab>('distributed');

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

  /** Which tab owns each zone the staking section emits. */
  const TAB_OF_ZONE: Record<string, StakingTab> = { batch: 'distributed', validators: 'multiple' };

  return (
    <div className="space-y-5">
      <ToolSection title={labels.accountTitle}>
        <AccountPicker value={account} onChange={setAccount} />
      </ToolSection>

      {account && (
        <>
          <OptionButtons<StakingTab>
            value={tab}
            onChange={setTab}
            options={[
              {
                value: 'distributed',
                label: labels.tabDistributed,
                icon: <Split className="size-4" />,
                title: labels.tabDistributedHint,
              },
              {
                value: 'multiple',
                label: labels.tabMultiple,
                icon: <LayoutGrid className="size-4" />,
                title: labels.tabMultipleHint,
              },
            ]}
          />

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
            listTitle={labels.sectionTitle}
            /*
             * Both zones are rendered on every pass and the inactive one is
             * hidden rather than unmounted: switching tabs must not reset the
             * validator selection or the amounts already typed.
             */
            sectionWrapper={({ key, title, hint, action, children }) => (
              <div key={key} className={TAB_OF_ZONE[key] === tab ? '' : 'hidden'}>
                <ToolSection
                  title={title}
                  hint={hint ?? (key === 'batch' ? labels.tabDistributedHint : labels.tabMultipleHint)}
                  action={action}
                >
                  {children}
                </ToolSection>
              </div>
            )}
          />
        </>
      )}
    </div>
  );
}
