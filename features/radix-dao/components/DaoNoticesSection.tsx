import { Bell, ExternalLink, GitBranch } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { DAO_EXTERNAL_LINKS, DAO_GITHUB_REPOS } from '../data/radixDaoData';
import type { DaoCopy, DaoNoticeItem } from '../types/radixDao.types';
import { DaoNoticesList } from './DaoNoticesList';
import { DaoSection } from './DaoSection';
import type { PdfPreviewCopy } from './InlinePdfPreview';

interface DaoNoticesSectionProps {
  notices: DaoCopy['notices'];
  docCopy: PdfPreviewCopy;
  items: DaoNoticeItem[];
  source: 'live' | 'fallback';
  locale: string;
}

export function DaoNoticesSection({
  notices,
  docCopy,
  items,
  source,
  locale,
}: DaoNoticesSectionProps) {
  return (
    <DaoSection id="notices" surface="muted" containerClassName="space-y-16">
        <SectionHeader
          icon={<Bell className="size-3.5 text-[var(--color-primary)]" aria-hidden="true" />}
          badge={notices.badge}
          title={notices.title}
          titleAccent={notices.titleAccent}
          subtitle={notices.subtitle}
        />

        {/* Official Notices: expandable inline rows with summary, inline PDF viewer, and source */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
              <span
                className="size-2 rounded-full"
                style={{
                  backgroundColor:
                    source === 'live' ? 'var(--color-accent)' : 'var(--color-primary)',
                }}
              />
              {source === 'live' ? notices.liveFeedBadge : notices.snapshotBadge}
            </span>

            <a
              href={DAO_EXTERNAL_LINKS.notices}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-bold bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)] text-white hover:opacity-90 transition-opacity shadow-sm"
            >
              <span>{notices.allNotices}</span>
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </div>

          <DaoNoticesList
            notices={notices}
            docCopy={docCopy}
            items={items}
            locale={locale}
          />
        </div>

        {/* Active GitHub Repositories: 3 clean open columns */}
        <div className="space-y-6">
          <div>
            <h3 className="text-2xl font-bold text-[var(--color-text-main)]">
              {notices.reposTitle}
            </h3>
            <p className="text-sm sm:text-base text-[var(--color-text-muted)] mt-1">
              {notices.reposSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4 border-t border-[var(--color-card-border)]">
            {DAO_GITHUB_REPOS.map((repo) => {
              const desc =
                notices.repos[repo.name as keyof typeof notices.repos] ?? '';
              return (
                <a
                  key={repo.name}
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <GitBranch
                        className="size-4 shrink-0 text-[var(--color-secondary)]"
                        aria-hidden="true"
                      />
                      <span className="font-mono text-base font-bold text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition-colors">
                        RadixDAO/{repo.name}
                      </span>
                      <ExternalLink
                        className="size-3.5 shrink-0 text-[var(--color-text-muted)] ml-auto"
                        aria-hidden="true"
                      />
                    </div>
                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                      {desc}
                    </p>
                  </div>

                  <div className="text-xs font-mono text-[var(--color-text-muted)]">
                    {repo.branch} · {notices.repoUpdated}: {repo.updatedAt}
                  </div>
                </a>
              );
            })}
          </div>
        </div>
    </DaoSection>
  );
}
