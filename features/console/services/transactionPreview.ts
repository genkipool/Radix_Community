/**
 * Browser-side transaction simulation via the Gateway `/transaction/preview`
 * endpoint. No signatures are needed: the preview assumes all proofs and uses
 * a free fee credit, so any manifest can be dry-run before sending it to the
 * wallet.
 */

import type { Network } from '@/services/gateway/client';

const GATEWAY_BASES: Record<Network, string> = {
  mainnet: 'https://mainnet.radixdlt.com',
  stokenet: 'https://gateway-stokenet.radix.community',
};

export interface PreviewBalanceChange {
  entityAddress: string;
  resourceAddress: string;
  amount: string;
}

export interface TransactionPreviewResult {
  status: 'Succeeded' | 'Failed' | 'Rejected' | string;
  errorMessage: string | null;
  /** Total fee in XRD (execution + finalization + royalties + storage + tip) */
  feeXrd: number;
  balanceChanges: PreviewBalanceChange[];
  logs: string[];
}

interface GatewayPreviewResponse {
  receipt?: {
    status?: string;
    error_message?: string | null;
    fee_summary?: Record<string, string>;
  };
  resource_changes?: Array<{
    resource_changes?: Array<{
      resource_address?: string;
      component_entity?: { entity_address?: string };
      amount?: string;
    }>;
  }>;
  logs?: Array<{ level?: string; message?: string }>;
}

const FEE_FIELDS = [
  'xrd_total_execution_cost',
  'xrd_total_finalization_cost',
  'xrd_total_royalty_cost',
  'xrd_total_storage_cost',
  'xrd_total_tipping_cost',
];

async function gatewayPost<T>(network: Network, path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${GATEWAY_BASES[network]}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || `Gateway ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function previewTransaction(
  manifest: string,
  network: Network,
  blobsHex?: string[],
): Promise<TransactionPreviewResult> {
  const construction = await gatewayPost<{ ledger_state?: { epoch?: number } }>(
    network,
    '/transaction/construction',
    {},
  );
  const epoch = construction.ledger_state?.epoch ?? 0;

  const preview = await gatewayPost<GatewayPreviewResponse>(network, '/transaction/preview', {
    manifest,
    blobs_hex: blobsHex ?? [],
    start_epoch_inclusive: epoch,
    end_epoch_exclusive: epoch + 2,
    nonce: Math.floor(Math.random() * 0xffffffff),
    signer_public_keys: [],
    tip_percentage: 0,
    flags: {
      use_free_credit: true,
      assume_all_signature_proofs: true,
      skip_epoch_check: false,
    },
  });

  const feeSummary = preview.receipt?.fee_summary ?? {};
  const feeXrd = FEE_FIELDS.reduce((acc, field) => acc + Number(feeSummary[field] ?? 0), 0);

  const balanceChanges: PreviewBalanceChange[] = (preview.resource_changes ?? []).flatMap(
    (group) =>
      (group.resource_changes ?? []).flatMap((change) =>
        change.resource_address && change.component_entity?.entity_address
          ? [{
              entityAddress: change.component_entity.entity_address,
              resourceAddress: change.resource_address,
              amount: change.amount ?? '0',
            }]
          : [],
      ),
  );

  return {
    status: preview.receipt?.status ?? 'Unknown',
    errorMessage: preview.receipt?.error_message ?? null,
    feeXrd,
    balanceChanges,
    logs: (preview.logs ?? []).flatMap((log) => (log.message ? [log.message] : [])),
  };
}
