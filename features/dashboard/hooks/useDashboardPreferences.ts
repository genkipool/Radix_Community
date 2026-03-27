'use client';

/**
 * features/dashboard/hooks/useDashboardPreferences.ts
 *
 * Manages all cookie-persisted UI preferences for the dashboard.
 * Consolidates the 10 individual cookie-sync useEffects that previously
 * lived directly in DashboardClient into a single composable hook.
 */

import { useState, useEffect } from 'react';
import { setCookie as _setCookie } from '@/utils/cookies';
import type { SortMode } from '@/features/dashboard/types';
import { COOKIE_KEYS } from '@/constants/dashboard';

const DASHBOARD_COOKIE_MAX_AGE = 604800; // 7 days
const setCookie = (name: string, value: string) =>
  _setCookie(name, value, DASHBOARD_COOKIE_MAX_AGE);

import { type UseDashboardPreferencesOptions } from '../types';

export function useDashboardPreferences({
  initialValSortMode,     initialTxSortMode,
  initialValColumns,      initialTxColumns,
  initialValReadingMode,  initialTxReadingMode,
  initialValAutoCollapse, initialTxAutoCollapse,
  initialActiveTag,       initialTransactionActiveTag,
}: UseDashboardPreferencesOptions) {
  const [activeTag,            setActiveTag]            = useState<string[]>(initialActiveTag);
  const [transactionActiveTag, setTransactionActiveTag] = useState(initialTransactionActiveTag);
  const [valSortMode,          setValSortMode]          = useState<SortMode>(initialValSortMode);
  const [txSortMode,           setTxSortMode]           = useState<SortMode>(initialTxSortMode);
  const [valColumns,           setValColumns]           = useState(initialValColumns);
  const [txColumns,            setTxColumns]            = useState(initialTxColumns);
  const [valReadingMode,       setValReadingMode]       = useState(initialValReadingMode);
  const [txReadingMode,        setTxReadingMode]        = useState(initialTxReadingMode);
  const [valAutoCollapse,      setValAutoCollapse]      = useState(initialValAutoCollapse);
  const [txAutoCollapse,       setTxAutoCollapse]       = useState(initialTxAutoCollapse);

  // ── Cookie sync — each effect fires only when its own value changes ──
  useEffect(() => { setCookie(COOKIE_KEYS.activeTag,       activeTag.join(','));  }, [activeTag]);
  useEffect(() => { setCookie(COOKIE_KEYS.txTag,           transactionActiveTag); }, [transactionActiveTag]);
  useEffect(() => { setCookie(COOKIE_KEYS.valSortMode,     valSortMode);          }, [valSortMode]);
  useEffect(() => { setCookie(COOKIE_KEYS.txSortMode,      txSortMode);           }, [txSortMode]);
  useEffect(() => { setCookie(COOKIE_KEYS.valColumns,      String(valColumns));   }, [valColumns]);
  useEffect(() => { setCookie(COOKIE_KEYS.txColumns,       String(txColumns));    }, [txColumns]);
  useEffect(() => { setCookie(COOKIE_KEYS.valReadingMode,  String(valReadingMode)); }, [valReadingMode]);
  useEffect(() => { setCookie(COOKIE_KEYS.txReadingMode,   String(txReadingMode));  }, [txReadingMode]);
  useEffect(() => { setCookie(COOKIE_KEYS.valAutoCollapse, String(valAutoCollapse));}, [valAutoCollapse]);
  useEffect(() => { setCookie(COOKIE_KEYS.txAutoCollapse,  String(txAutoCollapse)); }, [txAutoCollapse]);

  return {
    activeTag,            setActiveTag,
    transactionActiveTag, setTransactionActiveTag,
    valSortMode,          setValSortMode,
    txSortMode,           setTxSortMode,
    valColumns,           setValColumns,
    txColumns,            setTxColumns,
    valReadingMode,       setValReadingMode,
    txReadingMode,        setTxReadingMode,
    valAutoCollapse,      setValAutoCollapse,
    txAutoCollapse,       setTxAutoCollapse,
  };
}
