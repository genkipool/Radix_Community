'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, FileCode2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { CopyButton } from '@/components/ui/CopyButton';
import { ManifestCode } from '@/features/console/components/shared/ManifestCode';
import { apiFetchTransactionDetails } from '@/features/dashboard/services/apiClient';
import { useLanguage } from '@/context/LanguageContext';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { explorerTxUrl } from '../lib/explorer';
import type { SignDictionary } from '../types/dictionary';

/**
 * The transaction behind an on-ledger signing request, shown beside the share
 * link: its id (a link into this project's explorer) and, on demand, the exact
 * manifest that was executed.
 *
 * The link and the QR say where to sign; this says what was actually recorded,
 * which is the part somebody receiving the link may reasonably want to read
 * before signing. The manifest is fetched from the ledger rather than kept from
 * the session that built it, so it is the same answer for the issuer and for
 * every co-signer who opens the request later.
 */
export function RequestTransactionLinks({
  t,
  txId,
  networkId,
}: {
  t: SignDictionary;
  /** Intent hash of the transaction that created the request. */
  txId: string;
  /** Network the request lives on (defaults to Stokenet's gateway pair). */
  networkId?: number;
}) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const network =
    networkId === RadixNetworkId.Mainnet ? ('mainnet' as const) : ('stokenet' as const);

  const details = useQuery({
    queryKey: ['sign-request-manifest', network, txId],
    // Only asked for once the reader opens it: the manifest is a large
    // response nobody needs for sharing a link.
    enabled: open,
    staleTime: Infinity,
    queryFn: async () => {
      const data = await apiFetchTransactionDetails(txId, network);
      const manifest = (data as { manifest_instructions?: unknown })
        ?.manifest_instructions;
      return typeof manifest === 'string' ? manifest : '';
    },
  });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {t.onchain.requestTx}
        </span>
        <Link
          href={explorerTxUrl(language, txId)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-w-0 items-center gap-1.5 font-mono text-[11px] break-all transition-opacity hover:opacity-80"
          style={{ color: 'var(--color-primary)' }}
        >
          <span className="min-w-0 break-all">{txId}</span>
          <ExternalLink className="size-3 shrink-0" />
        </Link>
        <CopyButton value={txId} variant="minimal" size="xs" />
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs font-bold transition-opacity hover:opacity-80"
        style={{ color: 'var(--color-primary)' }}
      >
        <FileCode2 className="size-3.5" />
        {open ? t.onchain.hideManifest : t.onchain.viewManifest}
      </button>

      {open && (
        <div
          className="relative rounded-xl border p-3 overflow-x-auto"
          style={{
            borderColor: 'var(--color-card-border)',
            background: 'var(--code-bg, var(--color-surface))',
          }}
        >
          {details.isFetching && !details.data ? (
            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              {t.onchain.manifestLoading}
            </p>
          ) : details.data ? (
            <>
              <div className="absolute top-2 right-2">
                <CopyButton value={details.data} variant="ghost" size="xs" />
              </div>
              <ManifestCode code={details.data} className="mt-5 sm:mt-0" />
            </>
          ) : (
            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              {t.onchain.manifestError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
