import { ExternalLink, Users2 } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import {
  DAO_DELEGATED_FUNCTION_IDS,
  DAO_EXTERNAL_LINKS,
  DAO_WORKING_GROUP_IDS,
} from '../data/radixDaoData';
import type { DaoCopy } from '../types/radixDao.types';
import { DaoSection } from './DaoSection';
import { DaoStatusBadge } from './DaoStatusBadge';
import { PermanentCandidatesTable } from './PermanentCandidatesTable';
import { TransitionCouncilTable } from './TransitionCouncilTable';

interface DaoPeopleSectionProps {
  people: DaoCopy['people'];
}

export function DaoPeopleSection({ people }: DaoPeopleSectionProps) {
  return (
    <DaoSection id="people" surface="muted" containerClassName="space-y-16">
      <SectionHeader
        icon={<Users2 className="size-3.5 text-[var(--color-primary)]" aria-hidden="true" />}
        badge={people.badge}
        title={people.title}
        titleAccent={people.titleAccent}
        subtitle={people.subtitle}
      />

      {/* Acronyms Legend: RAC / TRAC / PRAC */}
      <dl className="grid grid-cols-1 md:grid-cols-3 gap-6 py-5 border-y border-[var(--color-card-border)]">
        {[
          { code: people.acronyms.racCode, label: people.acronyms.racLabel },
          { code: people.acronyms.tracCode, label: people.acronyms.tracLabel },
          { code: people.acronyms.pracCode, label: people.acronyms.pracLabel },
        ].map((item) => (
          <div key={item.code} className="flex items-baseline gap-3">
            <dt className="font-mono text-xs font-black tracking-wider text-[var(--color-primary)] shrink-0">
              {item.code}
            </dt>
            <dd className="text-xs sm:text-sm text-[var(--color-text-muted)] leading-relaxed">
              {item.label}
            </dd>
          </div>
        ))}
      </dl>

      {/* 1. Full-width Transition RAC Table */}
      <TransitionCouncilTable people={people} />

      {/* 2. Full-width 15 Permanent RAC Candidates Table (GP-ELECT-1) */}
      <PermanentCandidatesTable people={people} />

      {/* 3. Balanced 2-column row: Permanent RAC | Working Groups (matched heights & full width) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-16 items-stretch">
        <div className="flex flex-col">
          <div className="flex items-baseline justify-between gap-2 flex-wrap mb-3">
            <h3 className="text-xl font-bold text-[var(--color-text-main)]">
              {people.permanentTitle}
            </h3>
            <span className="text-xs font-semibold text-[var(--color-text-muted)]">
              {people.permanentBadge}
            </span>
          </div>
          <div className="flex-1 flex flex-col justify-between pt-4 border-t border-[var(--color-card-border)] space-y-4">
            <p className="text-sm sm:text-base text-[var(--color-text-muted)] leading-relaxed">
              {people.permanentDesc}
            </p>
            <a
              href={DAO_EXTERNAL_LINKS.permanentRacThread}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-secondary)] hover:underline self-start"
            >
              <span>{people.permanentCta}</span>
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="flex items-baseline justify-between gap-2 flex-wrap mb-3">
            <h3 className="text-xl font-bold text-[var(--color-text-main)]">
              {people.workingGroupsTitle}
            </h3>
            <span className="text-xs font-semibold text-[var(--color-text-muted)]">
              {people.workingGroupsBadge}
            </span>
          </div>
          <div className="flex-1 flex flex-col justify-between border-t border-[var(--color-card-border)]">
            <ul className="divide-y divide-[var(--color-card-border)]">
              {DAO_WORKING_GROUP_IDS.map((wgId) => {
                const wg = people.workingGroups[wgId];
                return (
                  <li
                    key={wgId}
                    className="py-4 flex items-start justify-between gap-4"
                  >
                    <div className="min-w-0 space-y-1">
                      <h4 className="text-sm sm:text-base font-bold text-[var(--color-text-main)]">
                        {wg.title}
                      </h4>
                      <p className="text-xs sm:text-sm text-[var(--color-text-muted)] leading-relaxed">
                        {wg.status}
                      </p>
                    </div>
                    <DaoStatusBadge variant="neutral" className="shrink-0 mt-0.5">
                      {people.workingGroupsPendingTag}
                    </DaoStatusBadge>
                  </li>
                );
              })}
            </ul>
            <a
              href="#doc-working-group-framework"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-secondary)] hover:underline self-start pt-4"
            >
              <span>{people.workingGroupsCta}</span>
            </a>
          </div>
        </div>
      </div>

      {/* 4. Full-width Delegated Functions — spans entire width with zero empty gaps */}
      <div className="pt-12 border-t border-[var(--color-card-border)]">
        <div className="mb-8 max-w-3xl">
          <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-2">
            {people.delegatedTitle}
          </h3>
          <p className="text-sm sm:text-base text-[var(--color-text-muted)] leading-relaxed">
            {people.delegatedDesc}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
          {DAO_DELEGATED_FUNCTION_IDS.map((roleId) => {
            const role = people.delegated[roleId];
            return (
              <div
                key={roleId}
                className="border-t-2 border-[var(--color-card-border)] pt-4"
              >
                <h4 className="text-sm sm:text-base font-bold text-[var(--color-text-main)] mb-1.5">
                  {role.title}
                </h4>
                <p className="text-xs sm:text-sm text-[var(--color-text-muted)] leading-relaxed">
                  {role.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </DaoSection>
  );
}
