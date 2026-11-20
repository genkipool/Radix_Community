import Link from 'next/link';
import { ArrowUpRight, ExternalLink } from 'lucide-react';
import { FadeIn } from '@/components/ui/FadeIn';
import { DAO_PERMANENT_CANDIDATES } from '../data/radixDaoData';
import type { DaoCopy } from '../types/radixDao.types';
import { DaoStatusBadge } from './DaoStatusBadge';

interface PermanentCandidatesTableProps {
  people: DaoCopy['people'];
  locale: string;
}

export function PermanentCandidatesTable({ people, locale }: PermanentCandidatesTableProps) {
  return (
    <div>
      <FadeIn className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
        <h3 className="text-2xl font-bold text-[var(--color-text-main)]">
          {people.candidatesTitle}
        </h3>
        <div className="flex flex-col sm:items-end divide-y divide-[var(--color-card-border)]/70">
          <span className="pb-1.5 text-xs font-bold uppercase tracking-widest text-[var(--color-primary)]">
            {people.candidatesBadge}
          </span>
          <Link
            href={`/${locale}/governance/radix-dao/temperature-check/4`}
            className="pt-1.5 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-secondary)] hover:underline"
          >
            <span>{people.tc4Cta}</span>
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </FadeIn>
      <FadeIn className="mb-6">
        <p className="text-sm sm:text-base text-[var(--color-text-muted)] leading-relaxed max-w-4xl">
          {people.candidatesDesc}
        </p>
      </FadeIn>

      {/* Mobile stacked layout (< md) */}
      <ul className="md:hidden divide-y divide-[var(--color-card-border)] border-y border-[var(--color-card-border)]">
        {DAO_PERMANENT_CANDIDATES.map((candidate) => {
          const profile =
            people.candidates[candidate.id as keyof typeof people.candidates] ?? '';

          return (
            <li key={candidate.id} className="py-4 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-baseline gap-2.5 min-w-0">
                  <span className="font-mono text-xs font-bold text-[var(--color-primary)] shrink-0">
                    {candidate.number}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[var(--color-text-main)]">
                      {candidate.name}
                    </div>
                    {candidate.handle && (
                      <div className="font-mono text-xs text-[var(--color-text-muted)]">
                        {candidate.handle}
                      </div>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  {candidate.isCurrentTrac ? (
                    <DaoStatusBadge variant="primary" size="sm" title={people.candidateTracTitle}>
                      {people.candidateTracBadge}
                    </DaoStatusBadge>
                  ) : (
                    <span
                      title={people.candidateCommunityTitle}
                      className="text-xs font-medium text-[var(--color-text-muted)] cursor-help"
                    >
                      {people.candidateCommunityBadge}
                    </span>
                  )}
                </div>
              </div>

              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                {profile}
              </p>

              <div className="flex justify-end pt-0.5">
                <a
                  href={candidate.threadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-secondary)] hover:underline"
                >
                  <span>{people.candidateViewThread}</span>
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Desktop table (md+) */}
      <div className="hidden md:block overflow-x-auto border-y border-[var(--color-card-border)]">
        <table className="w-full text-left border-collapse min-w-[760px]">
          <thead>
            <tr className="border-b border-[var(--color-card-border)] text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
              <th scope="col" className="py-3.5 pr-4 w-14">
                {people.candidatesHeaders.number}
              </th>
              <th scope="col" className="py-3.5 px-4 w-64">
                {people.candidatesHeaders.candidate}
              </th>
              <th scope="col" className="py-3.5 px-4">
                {people.candidatesHeaders.background}
              </th>
              <th scope="col" className="py-3.5 px-4 w-36">
                {people.candidatesHeaders.status}
              </th>
              <th scope="col" className="py-3.5 pl-4 text-right w-40">
                {people.candidatesHeaders.thread}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-card-border)]">
            {DAO_PERMANENT_CANDIDATES.map((candidate) => {
              const profile =
                people.candidates[candidate.id as keyof typeof people.candidates] ?? '';

              return (
                <tr
                  key={candidate.id}
                  className="hover:bg-[var(--color-bg)]/60 transition-colors"
                >
                  <td className="py-3.5 pr-4 font-mono text-xs font-bold text-[var(--color-primary)] whitespace-nowrap">
                    {candidate.number}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="text-sm sm:text-base font-bold text-[var(--color-text-main)]">
                      {candidate.name}
                    </div>
                    {candidate.handle && (
                      <div className="font-mono text-xs text-[var(--color-text-muted)]">
                        {candidate.handle}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-xs sm:text-sm text-[var(--color-text-muted)] leading-relaxed">
                    {profile}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {candidate.isCurrentTrac ? (
                      <DaoStatusBadge variant="primary" size="sm" title={people.candidateTracTitle}>
                        {people.candidateTracBadge}
                      </DaoStatusBadge>
                    ) : (
                      <span
                        title={people.candidateCommunityTitle}
                        className="text-xs font-medium text-[var(--color-text-muted)] cursor-help"
                      >
                        {people.candidateCommunityBadge}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 pl-4 text-right whitespace-nowrap">
                    <a
                      href={candidate.threadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-[var(--color-secondary)] hover:underline"
                    >
                      <span>{people.candidateViewThread}</span>
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
