'use client';

import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/context/LanguageContext';
import { loadFeatureDictionaries, type Dictionary } from '@/i18n';

/**
 * The dashboard's words (staking and explorer included) for views outside it
 * that reuse its blocks, such as the console's validator card. Loaded on first
 * use only, once per language for the whole visit; pages that already carry
 * them get theirs straight away.
 */
export function useDashboardDictionary(): Dictionary | undefined {
  const { language, t } = useLanguage();
  const loaded = !!t.dashboard?.details && !!t.dashboard?.transactions;
  const { data } = useQuery({
    queryKey: ['dashboard-dictionary', language],
    enabled: !loaded,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: () => loadFeatureDictionaries(language, ['dashboard', 'dashboardStaking', 'dashboardExplorador']),
  });
  return loaded ? t : data;
}
