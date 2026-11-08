'use client';

import React from 'react';
import { useConsoleDictionary } from '@/features/console/hooks/useConsoleDictionary';
import { useAccountSecurityOn } from '@/features/console/hooks/useAccountSecurity';
import { AccountSecurityReportView } from '@/features/console/components/shared/AccountSecurityReportView';
import type { Network, TranslationsT } from '@/features/dashboard/types';
import { OlympiaControlRows } from '../olympia/OlympiaControlRows';

type Tt = Partial<TranslationsT['dashboard']['transactions']>;

/**
 * An account's security: who controls it and how strongly. The same check the
 * console's "Account security" tool runs, drawn by the same component, only
 * started once the tab is open — it is two or three Gateway reads.
 *
 * An account that comes from Olympia (same key) adds a few rows about that
 * Olympia account under "who controls it".
 */
export function AccountSecurityTab({ address, network, tt, locale = 'en' }: { address: string; network: Network; tt?: Tt; locale?: string }) {
    return <AccountSecurityReport address={address} network={network} tt={tt} locale={locale} />;
}

function AccountSecurityReport({ address, network, tt, locale }: { address: string; network: Network; tt?: Tt; locale: string }) {
    const labels = useConsoleDictionary().accountSecurity;
    const text = tt?.account_summary?.security;
    const { data: report, isLoading, error } = useAccountSecurityOn(address, network);

    if (isLoading) {
        return (
            <p className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <span className="size-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                {text?.loading ?? 'Reading who controls the account…'}
            </p>
        );
    }
    if (error || !report || !labels) {
        return <p className="text-xs font-semibold text-[var(--color-danger)]">{text?.error ?? 'Could not check the account security.'}</p>;
    }
    return (
        <AccountSecurityReportView
            report={report}
            labels={labels}
            controlExtra={<OlympiaControlRows babylonAddress={address} network={network} tt={tt} locale={locale} />}
        />
    );
}
