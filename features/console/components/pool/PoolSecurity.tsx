'use client';

import type { ReactNode } from 'react';

import { poolFindingAddresses, poolFindingText } from '../../lib/finding-text';
import type { PoolFinding, PoolFindingId } from '../../lib/pool-security';
import type { ConsoleDictionary } from '../../types/i18n.types';
import { fmtNumber } from '../shared/InfoParts';
import { SecurityAnalysis, type AnalysisItem } from '../shared/SecurityAnalysis';

/** Findings the card's headline note already states; the summary does not repeat them. */
const IN_HEADLINE: PoolFindingId[] = ['drainable', 'xrdBadge'];

interface PoolSecurityProps {
  t: ConsoleDictionary;
  findings: PoolFinding[] | null;
  /** Display name of a resource. */
  name: (resource: string) => string;
  /** An address as a line with explorer link and copy button. */
  address: (address: string) => ReactNode;
  /** A date as the user reads it. */
  date: (iso: string) => string;
}

/** The pool's security findings, in words, as the shared analysis view shows them. */
export function PoolSecurity({ t, findings, name, address, date }: PoolSecurityProps) {
  const labels = t.pool.security;

  const items: AnalysisItem[] | null =
    findings?.map((f) => ({
      severity: f.severity,
      text: poolFindingText(labels.findings, f, { name, date, number: fmtNumber, unnamedDapp: labels.unnamedDapp }),
      addresses: poolFindingAddresses(f),
      notInSummary: IN_HEADLINE.includes(f.id),
    })) ?? null;

  return <SecurityAnalysis labels={labels} items={items} address={address} />;
}
