'use client';
/**
 * The rewards CSV button of a Babylon account, for the places in the Olympia
 * views that show the Babylon account an Olympia account became: the same
 * button and dialog (AccountRewardsCsvModal) the Babylon account card has.
 * Self-contained: words and language come from the app context.
 */
import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useDashboardDictionary } from '@/features/dashboard/hooks/useDashboardDictionary';
import { AccountRewardsCsvModal } from '../components/AccountRewardsCsvModal';

export function BabylonCsvButton({ address }: { address: string }) {
  const [open, setOpen] = useState(false);
  const dict = useDashboardDictionary();
  const { language } = useLanguage();
  if (!address.startsWith('account_rdx1')) return null;
  const accT = dict?.dashboard?.transactions?.account_summary;
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="p-1 rounded transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-primary)] shrink-0"
        title={accT?.download_rewards_tooltip}
        aria-label={accT?.download_rewards_tooltip}
      >
        <Download className="size-3" />
      </button>
      {open && (
        <AccountRewardsCsvModal isOpen={open} onClose={() => setOpen(false)} accountAddress={address} tt={accT} locale={language} />
      )}
    </>
  );
}
