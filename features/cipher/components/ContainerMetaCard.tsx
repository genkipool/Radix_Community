'use client';

import { FileLock2 } from 'lucide-react';
import { NETWORKS } from '@/features/wallet/constants/network';
import type { CipherDictionary } from '../types/dictionary';
import type { ContainerHead } from '../types/cipher.types';
import { formatBytes, shortAddress, shortFingerprint } from '../lib/format';

/** Metadata card for a parsed .radixenc head (decrypt tab, receive, unlock). */
export function ContainerMetaCard({
  t,
  head,
}: {
  t: CipherDictionary;
  head: ContainerHead;
}) {
  const { header } = head;
  const rows: Array<[string, string]> = [
    [t.file.metaName, header.fileName],
    [t.file.metaSize, formatBytes(header.fileSize)],
    [t.file.metaSender, shortAddress(header.senderAccount)],
    [t.file.metaDate, new Date(header.createdAt).toLocaleString()],
    [t.file.metaNetwork, NETWORKS[header.networkId]?.networkName ?? String(header.networkId)],
    [
      t.file.metaAccess,
      header.access === 'rola-ledger' ? t.file.accessRolaLedger : t.file.accessRola,
    ],
    [t.file.fingerprint, shortFingerprint(head.headerHash)],
  ];

  return (
    <div
      className="rounded-2xl border p-4 flex gap-4"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-card-border)',
      }}
    >
      <div className="size-10 shrink-0 rounded-xl flex items-center justify-center bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)]">
        <FileLock2 className="size-5 text-white" />
      </div>
      <dl className="grid flex-1 grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 min-w-0">
            <dt className="shrink-0 font-semibold" style={{ color: 'var(--color-text-muted)' }}>
              {label}
            </dt>
            <dd
              className="truncate font-mono text-right"
              style={{ color: 'var(--color-text-main)' }}
              title={value}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
