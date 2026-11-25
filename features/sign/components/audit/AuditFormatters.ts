import { dashboardRoutes, networkOfAddress } from '@/features/dashboard/lib/routes';
import type { Network } from '@/features/dashboard/types';
import type { SignDictionary } from '../../types/dictionary';
import type {
  AuditRecord,
  AuditRecordStatus,
  CollectionAuditResponse,
} from '../../lib/collection-audit';
import type { DomainVerificationResult } from '../../lib/domain-verify';
import { explorerTxUrl } from '../../lib/explorer';
import { optionalNetworkNameForId } from '../../lib/network';
import { buildAuditUrl, parseRequestKey } from '../../lib/share';
import type { UserSignCollection } from '../../services/sealDiscovery';

export type AuditLabels = NonNullable<SignDictionary['collection']>['audit'];
export type DomainVerifyLabels = NonNullable<
  SignDictionary['collection']
>['identity']['domainVerify'];
export type AuditExportFormat = 'pdf' | 'csv-records' | 'csv-signers' | 'json';

export interface AuditHeaderProps {
  audit: CollectionAuditResponse;
  labels: AuditLabels;
  domainVerifyLabels: DomainVerifyLabels;
  domainVerification: DomainVerificationResult | null;
  domainChecking: boolean;
  onOpenDomainDrawer: () => void;
  locale: string;
  exporting: AuditExportFormat | null;
  includeAliases: boolean;
  ownedCollections?: UserSignCollection[];
  onSelectCollection?: (resourceAddress: string) => void;
  onToggleIncludeAliases: (next: boolean) => void;
  onCopyShareLink: () => Promise<void>;
  onExport: (format: AuditExportFormat) => Promise<void>;
}

export function explorerNetworkForId(networkId: number): Network | undefined {
  return optionalNetworkNameForId(networkId);
}

export function formatUtcTimestamp(
  iso: string | null | undefined,
  locale: string,
): { utc: string; local: string } {
  if (!iso) return { utc: '—', local: '—' };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { utc: iso, local: iso };
  const utc = `${date.toLocaleString(locale, {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })} UTC`;
  const local = date.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return { utc, local };
}

export function auditStatusLabel(
  labels: AuditLabels,
  status: AuditRecordStatus,
): string {
  return labels.records.status[status];
}

export function auditKindLabel(
  labels: AuditLabels,
  kind: AuditRecord['kind'],
): string {
  return labels.records.kinds[kind];
}

export function entityExplorerHref(
  locale: string,
  address: string,
  networkId?: number,
): string {
  const net =
    (networkId != null ? explorerNetworkForId(networkId) : undefined) ??
    networkOfAddress(address) ??
    undefined;
  return dashboardRoutes.entity(locale, address, { network: net });
}

export function txExplorerHref(
  locale: string,
  txId: string,
  networkId?: number,
): string {
  return explorerTxUrl(locale, txId, {
    network:
      (networkId != null ? explorerNetworkForId(networkId) : undefined) ??
      networkOfAddress(txId) ??
      undefined,
  });
}

export function verifierHref(
  locale: string,
  requestKey: string,
): string {
  const parsed = parseRequestKey(requestKey);
  if (!parsed) return `/${locale}/console/sign-document?tab=verify`;
  return `/${locale}/console/sign-document/r/${parsed.collection}/${parsed.id}?tab=verify`;
}

export function buildAuditShareUrl(params: {
  origin: string;
  pathname: string;
  collection: string;
  fromDate?: string;
  toDate?: string;
}): string {
  const localeMatch = params.pathname.match(/^\/([a-z]{2})\//);
  const locale = localeMatch ? localeMatch[1] : 'en';
  return buildAuditUrl({
    origin: params.origin,
    locale,
    collection: params.collection,
    fromDate: params.fromDate,
    toDate: params.toDate,
  });
}
