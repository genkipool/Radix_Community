import Link from 'next/link';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { CopyButton } from '@/components/ui/CopyButton';
import { dashboardRoutes } from '@/features/dashboard/lib/routes';
import {
  DAO_ON_CHAIN_ENTITIES,
  DAO_SIGNING_CERTIFICATE,
} from '../data/radixDaoData';
import type { DaoCopy } from '../types/radixDao.types';
import { DaoSection } from './DaoSection';
import { DaoStatusBadge } from './DaoStatusBadge';
import { PdfHashVerifier } from './PdfHashVerifier';

interface DaoVerifySectionProps {
  verify: DaoCopy['verify'];
  docItems: DaoCopy['documents']['items'];
  locale: string;
}

export function DaoVerifySection({ verify, docItems, locale }: DaoVerifySectionProps) {
  return (
    <DaoSection id="verify" containerClassName="space-y-20">
        <SectionHeader
          icon={<ShieldCheck className="size-3.5 text-[var(--color-primary)]" aria-hidden="true" />}
          badge={verify.badge}
          title={verify.title}
          titleAccent={verify.titleAccent}
          subtitle={verify.subtitle}
        />

        {/* 1. Full-width On-Chain Identifiers Register (links to our own Explorer/Dashboard) */}
        <div>
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-[var(--color-text-main)]">
              {verify.registryTitle}
            </h3>
            <p className="text-sm sm:text-base text-[var(--color-text-muted)] mt-1">
              {verify.registrySubtitle}
            </p>
          </div>

          <div className="overflow-x-auto border-y border-[var(--color-card-border)]">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-[var(--color-card-border)] text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                  <th scope="col" className="py-3.5 pr-4 w-28">
                    {verify.tableHeaders.status}
                  </th>
                  <th scope="col" className="py-3.5 px-4 w-[32%]">
                    {verify.tableHeaders.function}
                  </th>
                  <th scope="col" className="py-3.5 px-4">
                    {verify.tableHeaders.identifier}
                  </th>
                  <th scope="col" className="py-3.5 pl-4 text-right w-48">
                    {verify.tableHeaders.verify}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-card-border)]">
                {DAO_ON_CHAIN_ENTITIES.map((entity) => {
                  const label =
                    verify.entities[entity.id as keyof typeof verify.entities] ?? entity.id;
                  const isLive = entity.status === 'live';

                  return (
                    <tr
                      key={entity.id}
                      className="hover:bg-[var(--color-surface)]/60 transition-colors"
                    >
                      <td className="py-4 pr-4 whitespace-nowrap">
                        <DaoStatusBadge
                          variant={isLive ? 'accent' : 'neutral'}
                          title={isLive ? verify.statusLiveTitle : verify.statusPendingTitle}
                        >
                          {isLive ? verify.statusLive : verify.statusPending}
                        </DaoStatusBadge>
                      </td>
                      <td className="py-4 px-4 text-sm sm:text-base font-bold text-[var(--color-text-main)]">
                        {label}
                      </td>
                      <td className="py-4 px-4">
                        {entity.address ? (
                          <code
                            title={entity.address}
                            className="block text-xs font-mono text-[var(--color-text-muted)] truncate max-w-[280px] xl:max-w-[440px]"
                          >
                            {entity.address}
                          </code>
                        ) : (
                          <span className="text-xs sm:text-sm italic text-[var(--color-text-muted)]">
                            {verify.notDeployed}
                          </span>
                        )}
                      </td>
                      <td className="py-4 pl-4 text-right whitespace-nowrap">
                        {entity.address ? (
                          <div className="inline-flex items-center justify-end gap-2">
                            <CopyButton value={entity.address} variant="ghost" size="xs" />
                            <Link
                              href={dashboardRoutes.entity(locale, entity.address)}
                              className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-secondary)] hover:underline"
                            >
                              <span>{verify.verifyOnDashboard}</span>
                              <ArrowUpRight className="size-3.5" aria-hidden="true" />
                            </Link>
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--color-text-muted)]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. Signing Certificate Strip — weighted columns so 64-char SHA-256 fits on 1 line */}
        <div>
          <div className="mb-6 max-w-3xl">
            <h3 className="text-2xl font-bold text-[var(--color-text-main)]">
              {verify.certTitle}
            </h3>
            <p className="text-sm sm:text-base text-[var(--color-text-muted)] mt-1 leading-relaxed">
              {verify.certDesc}
            </p>
          </div>

          <dl className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 pt-6 border-t border-[var(--color-card-border)]">
            {[
              { label: verify.certSerial, value: DAO_SIGNING_CERTIFICATE.serialNumber },
              { label: verify.certSha1, value: DAO_SIGNING_CERTIFICATE.sha1Thumbprint },
              { label: verify.certSha256, value: DAO_SIGNING_CERTIFICATE.sha256Fingerprint },
            ].map((row) => (
              <div key={row.label} className="space-y-2 min-w-0">
                <dt className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                  {row.label}
                </dt>
                <dd className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                  <code className="text-xs font-mono text-[var(--color-text-main)] whitespace-nowrap">
                    {row.value}
                  </code>
                  <CopyButton value={row.value} variant="ghost" size="xs" className="shrink-0" />
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* 3. Full-width Browser SHA-256 PDF Verifier + Terminal Commands */}
        <div className="pt-12 border-t border-[var(--color-card-border)]">
          <PdfHashVerifier verify={verify} docItems={docItems} />
        </div>
    </DaoSection>
  );
}
