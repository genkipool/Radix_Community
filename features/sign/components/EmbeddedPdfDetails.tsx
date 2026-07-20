'use client';

import { useEffect, useState } from 'react';
import { FileText, Link2, Stamp } from 'lucide-react';
import { NETWORKS } from '@/features/wallet/constants/network';
import { extractRadixAttachments, isPdfBytes } from '../lib/pdf-extract';
import { parseRequestKey } from '../lib/share';
import type { DocumentFile } from '../hooks/useDocumentFile';
import type { SignDictionary } from '../types/dictionary';
import type { AttestationEnvelope } from '../types/sign.types';

/**
 * Breakdown of the Radix data embedded in the dropped PDF, shown inside the
 * Document box so the user sees at a glance WHAT the file carries: the
 * certificate (signers, hash, request), the intact original document, and the
 * on-ledger request pointer (collection resource address + invitation id).
 * Renders nothing for files without Radix attachments.
 */
export function EmbeddedPdfDetails({
  t,
  doc,
}: {
  t: SignDictionary;
  doc: DocumentFile;
}) {
  const { bytes, embeddedRequest } = doc;
  const [envelope, setEnvelope] = useState<AttestationEnvelope | null>(null);
  const [originalName, setOriginalName] = useState<string | null>(null);

  // Signed PDFs keep their carrier bytes in `doc.bytes`, so the certificate is
  // extracted here; request-carrier PDFs already swapped `bytes` for the
  // recovered original and expose the pointer via `doc.embeddedRequest`.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!bytes || embeddedRequest || !isPdfBytes(bytes)) {
        if (!cancelled) {
          setEnvelope(null);
          setOriginalName(null);
        }
        return;
      }
      const att = await extractRadixAttachments(bytes).catch(() => null);
      if (cancelled) return;
      setEnvelope(att?.envelope ?? null);
      setOriginalName(att?.originalName ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [bytes, embeddedRequest]);

  const networkName = (id: number) => NETWORKS[id]?.networkName ?? `#${id}`;

  if (embeddedRequest) {
    const parsed = parseRequestKey(embeddedRequest.requestKey);
    return (
      <Box title={t.pdfInfo.title} icon={<Link2 className="size-3.5" />}>
        <InfoRow label={t.pdfInfo.request} value={t.pdfInfo.requestPointer} />
        {parsed && (
          <>
            <InfoRow label={t.pdfInfo.collection} value={parsed.collection} mono />
            <InfoRow label={t.pdfInfo.inviteId} value={`#${parsed.id}#`} mono />
          </>
        )}
        <InfoRow
          label={t.pdfInfo.network}
          value={networkName(embeddedRequest.networkId)}
        />
        <InfoRow label={t.pdfInfo.hash} value={doc.docHash} mono />
        <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          {t.pdfInfo.originalRecovered}
        </p>
      </Box>
    );
  }

  if (!envelope) return null;

  const { payload } = envelope;
  const request = envelope.request;
  const parsedRequest = request ? parseRequestKey(request.requestId) : null;
  return (
    <Box title={t.pdfInfo.title} icon={<Stamp className="size-3.5" />}>
      <InfoRow
        label={t.pdfInfo.certificate}
        value={`${envelope.signatures.length} ${t.pdfInfo.signaturesSuffix}`}
      />
      {originalName && (
        <p
          className="flex items-center gap-1.5 text-[11px]"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <FileText className="size-3 shrink-0" />
          {t.pdfInfo.original}: {originalName}
        </p>
      )}
      <InfoRow label={t.pdfInfo.hash} value={payload.docHash} mono />
      <InfoRow label={t.pdfInfo.network} value={networkName(payload.networkId)} />
      <InfoRow
        label={t.pdfInfo.requiredSigners}
        value={
          payload.signers.length === 0
            ? t.pdfInfo.openSet
            : String(payload.signers.length)
        }
      />
      {parsedRequest && (
        <>
          <InfoRow
            label={t.pdfInfo.collection}
            value={parsedRequest.collection}
            mono
          />
          <InfoRow
            label={t.pdfInfo.inviteId}
            value={`#${parsedRequest.id}#`}
            mono
          />
        </>
      )}
      {envelope.onChain?.resourceAddress && (
        <InfoRow
          label={t.pdfInfo.anchored}
          value={envelope.onChain.resourceAddress}
          mono
        />
      )}
    </Box>
  );
}

function Box({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-3.5 space-y-1.5"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-card-border)',
      }}
    >
      <p
        className="flex items-center gap-1.5 text-xs font-bold"
        style={{ color: 'var(--color-text-main)' }}
      >
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      <span className="font-semibold" style={{ color: 'var(--color-text-main)' }}>
        {label}:
      </span>{' '}
      <span className={mono ? 'font-mono break-all' : ''}>{value}</span>
    </p>
  );
}
