'use client';

import { useLanguage } from '@/context/LanguageContext';
import dashboardStakingEn from '../locales/en.json';
import dashboardStakingEs from '../locales/es.json';

type StakingLocaleDict = (typeof dashboardStakingEn)['dashboard']['staking'];

/**
 * Returns the `dashboard.staking` translation object with a safe fallback to
 * the bundled EN/ES locale JSON so staking components work identically in
 * both the dashboard and the console.
 */
export function useStakingLocale(localeOverride?: string): StakingLocaleDict {
    const { t: contextT, language } = useLanguage();
    const lang = localeOverride ?? language;
    const fallback = (lang === 'es' ? dashboardStakingEs : dashboardStakingEn).dashboard.staking;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fromContext = ((contextT?.dashboard as any)?.staking ?? {}) as Partial<StakingLocaleDict>;

    return {
        ...fallback,
        ...fromContext,
        tooltips: {
            ...fallback.tooltips,
            ...(fromContext.tooltips ?? {}),
        },
        errors: {
            ...fallback.errors,
            ...(fromContext.errors ?? {}),
        },
    };
}
