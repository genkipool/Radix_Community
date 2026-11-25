import { RadixNetworkId } from '@/features/wallet/constants/network';
import { dashboardRoutes, networkOfAddress } from '@/features/dashboard/lib/routes';
import type { Network } from '@/features/dashboard/types';
import type { SignDictionary } from '../../types/dictionary';
import type {
  AuditRecord,
  AuditRecordStatus,
  CollectionAuditResponse,
} from '../../lib/collection-audit';
import { explorerTxUrl } from '../../lib/explorer';

export type AuditLabels = NonNullable<SignDictionary['collection']>['audit'];
export type AuditExportFormat = 'pdf' | 'csv-records' | 'csv-signers' | 'json';

export interface AuditHeaderProps {
  audit: CollectionAuditResponse;
  labels: AuditLabels;
  locale: string;
  fetching: boolean;
  exporting: AuditExportFormat | null;
  includeAliases: boolean;
  onToggleIncludeAliases: (next: boolean) => void;
  onRefresh: () => void;
  onCopyShareLink: () => Promise<void>;
  onExport: (format: AuditExportFormat) => Promise<void>;
}

export function explorerNetworkForId(networkId: number): Network | undefined {
  if (networkId === RadixNetworkId.Mainnet) return 'mainnet';
  if (networkId === RadixNetworkId.Stokenet) return 'stokenet';
  return undefined;
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
  const match = requestKey.match(/^(resource_[a-z0-9_]+):?#?(\d+)#?$/);
  if (!match) return `/${locale}/console/sign-document?tab=verify`;
  return `/${locale}/console/sign-document/r/${match[1]}/${match[2]}?tab=verify`;
}

export function buildAuditShareUrl(params: {
  origin: string;
  pathname: string;
  collection: string;
  fromDate?: string;
  toDate?: string;
}): string {
  const query = new URLSearchParams();
  query.set('tab', 'audit');
  query.set('collection', params.collection);
  if (params.fromDate) query.set('from', params.fromDate);
  if (params.toDate) query.set('to', params.toDate);
  return `${params.origin}${params.pathname}?${query.toString()}`;
}
