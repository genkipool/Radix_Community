/**
 * Institutional Audit Report PDF generator (`pdf-lib`, 100% client-side).
 *
 * Reuses the shared A4 layout primitives (`pdf-layout.ts`), text sanitiser
 * (`pdf-text.ts`), and Explorer URL builder (`explorer.ts`) so the audit
 * report shares exact typography, branding, clickable transaction links, and
 * security guarantees with individual Radix Seal signature certificates.
 */
import { NETWORKS, RadixNetworkId } from '@/features/wallet/constants/network';
import type { Network } from '@/features/dashboard/types';
import type {
  AuditFilterState,
  AuditKpis,
  AuditRecord,
  AuditSignerSummary,
  CollectionAuditResponse,
} from './collection-audit';
import { explorerTxUrl } from './explorer';
import {
  ACCENT,
  CONTENT_W,
  DANGER_INK,
  INK,
  LINE,
  MARGIN,
  MUTED,
  PAGE_W,
  PdfCursor,
  SURFACE_TINT,
  WARNING_BG,
  WARNING_INK,
  base64PngToBytes,
  createPdfLinkFn,
  drawBrandedHeaderBand,
  embedRemoteImage,
  readBrandAccent,
  readableOnWhite,
  type Rgb01,
} from './pdf-layout';
import { pdfSafeText } from './pdf-text';

export interface AuditPdfLabels {
  title: string;
  tagline: string;
  testnetWarning: string;
  scopeSection: string;
  institution: string;
  collection: string;
  issuerAccount: string;
  network: string;
  ledgerCutoff: string;
  period: string;
  periodAll: string;
  generatedAt: string;
  integritySection: string;
  integrityStandard: string;
  integrityCustody: string;
  integrityImmutable: string;
  integrityPass: string;
  integrityWarn: string;
  summarySection: string;
  kpiTotal: string;
  kpiCompleted: string;
  kpiPending: string;
  kpiSigners: string;
  kpiAnomalies: string;
  recordsSection: string;
  noRecords: string;
  signersDirectorySection: string;
  aliasesNote: string;
  statusComplete: string;
  statusPartial: string;
  statusPending: string;
  statusRecorded: string;
  statusAnomaly: string;
  hashLabel: string;
  txLabel: string;
  signedLabel: string;
  pendingLabel: string;
  sealVerified: string;
  sealMissing: string;
  verifySection: string;
  verifyInstruction: string;
  disclaimerTitle: string;
  disclaimerBody: string;
  pageOf: string;
}

export interface AuditPdfInput {
  audit: CollectionAuditResponse;
  records: AuditRecord[];
  signers: AuditSignerSummary[];
  kpis: AuditKpis;
  filters: AuditFilterState;
  labels: AuditPdfLabels;
  kindLabels: Record<AuditRecord['kind'], string>;
  locale: string;
  origin?: string;
  sealImageUrl?: string;
  auditUrl?: string;
  includeAliases?: boolean;
  aliasOf?: (account: string) => string | undefined;
  accent?: Rgb01;
}

function explorerNet(networkId: number): Network | undefined {
  if (networkId === RadixNetworkId.Mainnet) return 'mainnet';
  if (networkId === RadixNetworkId.Stokenet) return 'stokenet';
  return undefined;
}

function fmtUtc(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleString(locale, { timeZone: 'UTC' })} UTC`;
}

function shortAddr(addr: string): string {
  return addr.length > 26 ? `${addr.slice(0, 12)}…${addr.slice(-8)}` : addr;
}

/**
 * Generates an A4 multi-page institutional audit PDF report and returns raw
 * PDF bytes ready for download.
 */
export async function buildAuditReportPdf(
  input: AuditPdfInput,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const addLink = await createPdfLinkFn(pdfDoc);

  const { audit, records, signers, kpis, filters, labels: L, locale } = input;
  const accent: Rgb01 = input.accent ?? readBrandAccent() ?? ACCENT;
  const accentInk = readableOnWhite(accent);
  const net = explorerNet(audit.networkId);
  const networkName =
    NETWORKS[audit.networkId]?.networkName ?? `#${audit.networkId}`;

  const txLink = (hash?: string | null): string | undefined =>
    hash && input.origin
      ? explorerTxUrl(locale, hash, { origin: input.origin, network: net })
      : undefined;

  const cur = new PdfCursor(
    pdfDoc,
    { regular, bold },
    rgb,
    accentInk,
    addLink,
    MARGIN + 18,
  );

  await drawBrandedHeaderBand(pdfDoc, cur, {
    title: L.title,
    tagline: L.tagline,
    sealImageUrl: input.sealImageUrl,
    accent,
  });

  // Prominent Stokenet banner so test reports are never mistaken for Mainnet.
  if (audit.networkId === RadixNetworkId.Stokenet) {
    const boxH = 26;
    cur.ensure(boxH + 8);
    cur.page.drawRectangle({
      x: MARGIN,
      y: cur.y - boxH,
      width: CONTENT_W,
      height: boxH,
      color: rgb(WARNING_BG[0], WARNING_BG[1], WARNING_BG[2]),
      borderColor: rgb(WARNING_INK[0], WARNING_INK[1], WARNING_INK[2]),
      borderWidth: 0.75,
    });
    cur.page.drawText(pdfSafeText(L.testnetWarning, 140), {
      x: MARGIN + 10,
      y: cur.y - 17,
      size: 9,
      font: bold,
      color: rgb(WARNING_INK[0], WARNING_INK[1], WARNING_INK[2]),
    });
    cur.y -= boxH + 10;
  }

  // ── 1. Audit Scope & Ledger Cutoff ──
  cur.sectionTitle(L.scopeSection);

  if (audit.issuer.orgName || audit.issuer.name) {
    const logo = audit.issuer.iconUrl
      ? await embedRemoteImage(pdfDoc, audit.issuer.iconUrl)
      : null;
    if (logo) {
      const box = 24;
      cur.ensure(box + 6);
      const top = cur.y;
      const dim = logo.scaleToFit(box, box);
      cur.page.drawImage(logo, {
        x: MARGIN,
        y: top - box + (box - dim.height) / 2,
        width: dim.width,
        height: dim.height,
      });
      cur.page.drawText(
        pdfSafeText(audit.issuer.orgName || audit.issuer.name || '—', 90),
        {
          x: MARGIN + box + 10,
          y: top - box / 2 - 4,
          size: 11.5,
          font: bold,
          color: rgb(INK[0], INK[1], INK[2]),
        },
      );
      cur.y = top - box - 6;
    } else {
      cur.field(
        L.institution,
        audit.issuer.orgName || audit.issuer.name || '—',
      );
    }
  }

  cur.field(L.collection, audit.collection, { mono: true });
  cur.field(L.issuerAccount, audit.issuer.account ?? '—', { mono: true });
  cur.field(
    L.network,
    audit.networkId === RadixNetworkId.Stokenet
      ? `${networkName} (Testnet)`
      : networkName,
  );
  cur.field(
    L.ledgerCutoff,
    audit.ledgerStateVersion != null
      ? `#${audit.ledgerStateVersion.toLocaleString(locale)} (${fmtUtc(audit.ledgerTimestamp, locale)})`
      : fmtUtc(audit.ledgerTimestamp, locale),
  );
  const periodLabel =
    filters.fromDate || filters.toDate
      ? `${filters.fromDate || '…'} -> ${filters.toDate || '…'} (UTC)`
      : L.periodAll;
  cur.field(L.period, periodLabel);
  cur.field(L.generatedAt, fmtUtc(new Date().toISOString(), locale));

  // ── 2. Cryptographic Integrity ──
  cur.sectionTitle(L.integritySection);
  const checks: Array<{ label: string; ok: boolean }> = [
    {
      label: L.integrityStandard,
      ok: audit.integrity.hasMarker && audit.integrity.officialBrand,
    },
    {
      label: L.integrityCustody,
      ok: audit.integrity.ownerLocked && audit.integrity.issuerVerified,
    },
    {
      label: L.integrityImmutable,
      ok:
        audit.integrity.burnDenied &&
        audit.integrity.dataImmutable &&
        audit.integrity.totalBurned === 0,
    },
  ];
  for (const chk of checks) {
    const badge = chk.ok ? L.integrityPass : L.integrityWarn;
    cur.text(`${chk.label}: ${badge}`, {
      size: 9.5,
      bold: true,
      color: chk.ok ? accentInk : WARNING_INK,
      lineGap: 2,
    });
  }
  cur.gap(4);

  // ── 3. Executive Summary KPIs ──
  cur.sectionTitle(L.summarySection);
  cur.ensure(46);
  const kpiBoxH = 40;
  cur.page.drawRectangle({
    x: MARGIN,
    y: cur.y - kpiBoxH,
    width: CONTENT_W,
    height: kpiBoxH,
    color: rgb(SURFACE_TINT[0], SURFACE_TINT[1], SURFACE_TINT[2]),
    borderColor: rgb(LINE[0], LINE[1], LINE[2]),
    borderWidth: 0.75,
  });
  const cols = [
    { label: L.kpiTotal, val: String(kpis.totalRecords) },
    {
      label: L.kpiCompleted,
      val: `${kpis.completeCount} (${kpis.completionRate}%)`,
    },
    { label: L.kpiPending, val: String(kpis.pendingCount) },
    { label: L.kpiSigners, val: String(kpis.uniqueSigners) },
    { label: L.kpiAnomalies, val: String(kpis.anomalyCount) },
  ];
  const colW = CONTENT_W / cols.length;
  cols.forEach((c, idx) => {
    const cx = MARGIN + idx * colW + 8;
    cur.page.drawText(pdfSafeText(c.label.toUpperCase(), 24), {
      x: cx,
      y: cur.y - 14,
      size: 6.5,
      font: bold,
      color: rgb(MUTED[0], MUTED[1], MUTED[2]),
    });
    cur.page.drawText(pdfSafeText(c.val, 24), {
      x: cx,
      y: cur.y - 30,
      size: 11,
      font: bold,
      color: rgb(
        idx === 4 && kpis.anomalyCount > 0 ? DANGER_INK[0] : INK[0],
        idx === 4 && kpis.anomalyCount > 0 ? DANGER_INK[1] : INK[1],
        idx === 4 && kpis.anomalyCount > 0 ? DANGER_INK[2] : INK[2],
      ),
    });
  });
  cur.y -= kpiBoxH + 10;

  // ── 4. Audited Records ──
  cur.sectionTitle(`${L.recordsSection} (${records.length})`);
  if (records.length === 0) {
    cur.text(L.noRecords, { size: 9.5, color: MUTED });
  } else {
    const statusText = (s: AuditRecord['status']) =>
      s === 'complete'
        ? L.statusComplete
        : s === 'partial'
          ? L.statusPartial
          : s === 'pending'
            ? L.statusPending
            : s === 'anomaly'
              ? L.statusAnomaly
              : L.statusRecorded;

    records.forEach((rec, i) => {
      cur.ensure(62);
      const kindLabel = input.kindLabels[rec.kind] ?? rec.kind;
      const progress =
        rec.kind === 'multi_request'
          ? ` (${rec.signedCount}/${rec.totalSigners})`
          : '';
      cur.text(
        `${i + 1}. ${kindLabel} · ${statusText(rec.status)}${progress} · ${fmtUtc(rec.committedAt, locale)}`,
        {
          size: 9.5,
          bold: true,
          color: rec.status === 'anomaly' ? DANGER_INK : INK,
          lineGap: 1,
        },
      );
      cur.text(`${L.hashLabel}: ${rec.docHash}`, {
        size: 8,
        color: MUTED,
      });
      if (rec.txId) {
        const url = txLink(rec.txId);
        cur.text(`${L.txLabel}: ${rec.txId}`, {
          size: 8,
          color: url ? accentInk : MUTED,
          link: url,
        });
      }
      if (rec.signers.length > 0) {
        for (const s of rec.signers) {
          const alias = input.includeAliases
            ? input.aliasOf?.(s.account)
            : undefined;
          const who = alias ? `${alias} (${shortAddr(s.account)})` : s.account;
          const state = s.signed
            ? `${L.signedLabel} · ${fmtUtc(s.signedAt, locale)}`
            : L.pendingLabel;
          const sigUrl = txLink(s.txId);
          cur.text(`   - ${who} — ${state}`, {
            size: 8,
            color: s.signed ? INK : MUTED,
            link: sigUrl,
          });
        }
      }
      cur.gap(4);
      if (i < records.length - 1) {
        cur.rule();
        cur.gap(5);
      }
    });
  }

  // ── 5. Participating Radix Addresses Directory ──
  cur.sectionTitle(`${L.signersDirectorySection} (${signers.length})`);
  if (input.includeAliases) {
    cur.text(L.aliasesNote, { size: 7.5, color: MUTED, lineGap: 4 });
  }
  signers.forEach((s, i) => {
    cur.ensure(34);
    const alias = input.includeAliases ? input.aliasOf?.(s.account) : undefined;
    const sealText = s.hasVerifiedSeal ? L.sealVerified : L.sealMissing;
    if (alias) {
      cur.text(`${i + 1}. ${alias}`, { size: 9.5, bold: true });
    }
    cur.text(
      `${alias ? '   ' : `${i + 1}. `}${s.account} · ${sealText} · ${L.signedLabel}: ${s.signedCount} / ${L.pendingLabel}: ${s.pendingCount}`,
      { size: 8.5, color: alias ? MUTED : INK, lineGap: 2 },
    );
  });

  // ── 6. Online Verification QR + Honest Scope Disclaimer ──
  if (input.auditUrl) {
    cur.sectionTitle(L.verifySection);
    const qrSize = 84;
    cur.ensure(qrSize + 8);
    let qrDrawn = false;
    try {
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(input.auditUrl, {
        width: qrSize * 3,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
      const img = await pdfDoc.embedPng(
        base64PngToBytes(dataUrl) as Uint8Array<ArrayBuffer>,
      );
      cur.page.drawImage(img, {
        x: MARGIN,
        y: cur.y - qrSize,
        width: qrSize,
        height: qrSize,
      });
      qrDrawn = true;
    } catch {
      // Fallback to URL alone.
    }
    const textX = qrDrawn ? MARGIN + qrSize + 14 : MARGIN;
    const textW = PAGE_W - MARGIN - textX;
    const savedY = cur.y;
    cur.text(L.verifyInstruction, { x: textX, maxWidth: textW, size: 8.5 });
    cur.gap(3);
    cur.text(input.auditUrl, {
      x: textX,
      maxWidth: textW,
      size: 8,
      color: accentInk,
      link: input.auditUrl,
    });
    cur.y = Math.min(cur.y, savedY - qrSize);
    cur.gap(8);
  }

  cur.rule();
  cur.gap(5);
  cur.text(L.disclaimerTitle, { size: 8, bold: true, color: MUTED });
  cur.gap(2);
  cur.text(L.disclaimerBody, { size: 7.5, color: MUTED });

  // Page numbering footer on every page.
  const totalPages = cur.pages.length;
  cur.pages.forEach((p, idx) => {
    const label = pdfSafeText(
      L.pageOf
        .replace('{page}', String(idx + 1))
        .replace('{total}', String(totalPages)),
      60,
    );
    p.drawText(label, {
      x: MARGIN,
      y: 26,
      size: 7.5,
      font: regular,
      color: rgb(MUTED[0], MUTED[1], MUTED[2]),
    });
  });

  return pdfDoc.save();
}
