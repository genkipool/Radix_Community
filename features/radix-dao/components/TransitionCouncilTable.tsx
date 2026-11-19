import { ExternalLink } from 'lucide-react';
import { FadeIn } from '@/components/ui/FadeIn';
import { DAO_EXTERNAL_LINKS, DAO_TRANSITION_COUNCIL } from '../data/radixDaoData';
import type { DaoCopy } from '../types/radixDao.types';
import { DaoStatusBadge } from './DaoStatusBadge';

interface TransitionCouncilTableProps {
  people: DaoCopy['people'];
}

export function TransitionCouncilTable({ people }: TransitionCouncilTableProps) {
  return (
    <div>
      <FadeIn className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-3">
        <h3 className="text-2xl font-bold text-[var(--color-text-main)]">
          {people.transitionTitle}
        </h3>
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-accent)]">
          {people.transitionBadge}
        </span>
      </FadeIn>
      <FadeIn className="mb-6 space-y-2.5">
        <p className="text-sm sm:text-base text-[var(--color-text-muted)] leading-relaxed max-w-4xl">
          {people.transitionDesc}
        </p>
        <a
          href={DAO_EXTERNAL_LINKS.councilTelegram}
          target="_blank"
          rel="noopener noreferrer"
          title={people.councilTelegramTitle}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-secondary)] hover:underline"
        >
          <span>{people.councilTelegramLabel}</span>
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      </FadeIn>

      <div className="overflow-x-auto border-y border-[var(--color-card-border)]">
        <table className="w-full text-left border-collapse min-w-[680px]">
          <thead>
            <tr className="border-b border-[var(--color-card-border)] text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
              <th scope="col" className="py-3.5 pr-4 w-24">
                {people.tableHeaders.seat}
              </th>
              <th scope="col" className="py-3.5 px-4">
                {people.tableHeaders.holder}
              </th>
              <th scope="col" className="py-3.5 px-4">
                {people.tableHeaders.legalRole}
              </th>
              <th scope="col" className="py-3.5 px-4">
                {people.tableHeaders.term}
              </th>
              <th scope="col" className="py-3.5 pl-4 text-right">
                {people.tableHeaders.contact}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-card-border)]">
            {DAO_TRANSITION_COUNCIL.map((member) => (
              <tr
                key={member.seat}
                className="hover:bg-[var(--color-bg)]/60 transition-colors"
              >
                <td className="py-4 pr-4 font-mono text-xs font-bold text-[var(--color-primary)] whitespace-nowrap">
                  {people.seatPrefix} {member.seat}
                </td>
                <td className="py-4 px-4 text-sm sm:text-base font-bold text-[var(--color-text-main)] whitespace-nowrap">
                  {member.name}
                </td>
                <td className="py-4 px-4 whitespace-nowrap">
                  {member.isLlcMember ? (
                    <DaoStatusBadge variant="primary" size="sm" title={people.llcMemberTitle}>
                      {people.llcMemberBadge}
                    </DaoStatusBadge>
                  ) : (
                    <span
                      title={people.councilSeatTitle}
                      className="text-xs font-medium text-[var(--color-text-muted)] cursor-help underline decoration-dotted underline-offset-2"
                    >
                      {people.councilSeatLabel}
                    </span>
                  )}
                </td>
                <td className="py-4 px-4 text-xs sm:text-sm text-[var(--color-text-muted)]">
                  {people.termLabel}
                </td>
                <td className="py-4 pl-4 text-right whitespace-nowrap">
                  <a
                    href={`https://t.me/${member.telegram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-secondary)] hover:underline"
                  >
                    <span>@{member.telegram}</span>
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
