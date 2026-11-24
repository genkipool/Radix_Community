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
import { accountFromQuery, consoleQueryParam } from '../../lib/console-query';
import { useConsoleQueryState } from '../../hooks/useConsoleQueryState';
import { useTransactionPreview } from '../../hooks/useTransactionPreview';
import { ToolSection } from '../shared/ToolSection';
import { AccountPicker } from '../shared/AccountPicker';
import { OptionButtons } from '../shared/OptionButtons';
import { CollapsibleManifest } from '../shared/CollapsibleManifest';
import { SimulateResultCard } from '../shared/SimulatePanel';

type StakingSectionTranslations = Parameters<typeof AccountStakingSection>[0]['tt'];
type StakingSectionErrors = Parameters<typeof AccountStakingSection>[0]['stakingErrors'];

/** The two ways of staking to more than one validator at once. */
type StakingTab = 'distributed' | 'multiple';

/**
 * Staking tool — the same per-validator staking section used in the wallet
 * profile modal (stake, unstake, claim, batch and owner mode), enhanced in
 * console mode with full owner controls, shared full-width validator picker,
 * operations summary on both tabs, and manifest preview + simulation.
 */
export default function StakingTool({ t }: ConsoleToolProps) {
  const labels = t.staking;
  const { t: fullDictionary, language } = useLanguage();
  const { activeNetwork } = useRadixWallet();
  const { copiedText, copy } = useCopyToClipboard();
  const preview = useTransactionPreview();

  const [account, setAccount] = useConsoleQueryState<string | null>(accountFromQuery, null);
  const [tab, setTab] = useState<StakingTab>('distributed');
  const [manifest, setManifest] = useState('');
  // `?validator=a,b` (from a validator's profile) starts with those selected.
  const [initialValidators] = useConsoleQueryState(
    () => (consoleQueryParam('validator') ?? '').split(',').map((v) => v.trim()).filter((v) => v.startsWith('validator_')),
    [],
  );

  const handleAccountChange = (next: string | null) => {
    setAccount(next);
    setManifest('');
    preview.reset();
  };

  const handleTabChange = (next: StakingTab) => {
    setTab(next);
    preview.reset();
  };

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
        <AccountPicker value={account} onChange={handleAccountChange} />
      </ToolSection>

      {account && (
        <>
          <OptionButtons<StakingTab>
            value={tab}
            onChange={handleTabChange}
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
            initialValidators={initialValidators.length ? initialValidators : undefined}
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
            consoleMode
            activeConsoleTab={tab}
            onConsoleManifestChange={setManifest}
            onConsoleSimulate={(nextManifest) => preview.simulate(nextManifest)}
            isConsoleSimulating={preview.isSimulating}
            consoleSimulateResult={
              <SimulateResultCard
                t={t.simulate}
                preview={preview.preview}
                error={preview.error}
                onClose={preview.reset}
              />
            }
            stakingErrors={stakingErrors}
            listTitle={labels.sectionTitle}
            /*
             * Both zones are rendered on every pass and the inactive one is
             * hidden rather than unmounted: switching tabs must not reset the
             * validator selection or the amounts already typed.
             * The shared validator selector (`selector`) stays visible above
             * whichever tab is active, spanning the full width.
             */
            sectionWrapper={({ key, title, hint, action, children }) => (
              <div key={key} className={key === 'selector' || TAB_OF_ZONE[key] === tab ? '' : 'hidden'}>
                <ToolSection
                  title={title}
                  hint={
                    hint ??
                    (key === 'batch'
                      ? labels.tabDistributedHint
                      : key === 'validators'
                        ? labels.tabMultipleHint
                        : undefined)
                  }
                  action={action}
                >
                  {children}
                </ToolSection>
              </div>
            )}
          />

          <CollapsibleManifest
            manifest={manifest}
            showLabel={t.validator.showManifest}
            hideLabel={t.validator.hideManifest}
            copyLabel={t.common.copy}
          />
        </>
      )}
    </div>
  );
}
