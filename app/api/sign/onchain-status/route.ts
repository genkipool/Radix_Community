import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { checkRateLimit, clientIp } from '@/services/mcp/rate-limit';
import { gatewayPost } from '@/services/gateway/bases';
import type { Network } from '@/services/gateway/client';

/**
 * POST /api/sign/onchain-status
 *
 * Reads the on-ledger state of a "by reference" signing request: the request
 * NFT's data (hash, policy, required signers) and, for each required signer,
 * whether their signature NFT exists. Works from a request key, or by resolving
 * it from a connected signer's own wallet + the document hash.
 *
 * The ledger cannot be searched by hash, so discovery is per-account: we read
 * the request NFT (known id) and enumerate each required account (known id).
 */

const bodySchema = z
  .object({
    networkId: z.number().int(),
    docHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
    requestId: z.string().max(600).optional(),
    account: z.string().max(256).optional(),
  })
  .strict();

interface NfDataResponse {
  non_fungible_ids?: Array<{
    non_fungible_id?: string;
    data?: { programmatic_json?: { fields?: Array<{ field_name?: string; value?: unknown }> } };
  }>;
}

interface EntityDetailsResponse {
  items?: Array<{
    non_fungible_resources?: {
      items?: Array<{
        resource_address?: string;
        vaults?: { items?: Array<{ items?: string[] }> };
      }>;
    };
  }>;
}

function fieldsToMap(
  data: NfDataResponse,
): Record<string, string> {
  const fields = data.non_fungible_ids?.[0]?.data?.programmatic_json?.fields;
  const out: Record<string, string> = {};
  if (Array.isArray(fields)) {
    for (const f of fields) {
      if (f.field_name && typeof f.value === 'string') out[f.field_name] = f.value;
    }
  }
  return out;
}

async function readNft(
  network: Network,
  globalId: string,
): Promise<Record<string, string> | null> {
  const [resource, localId] = globalId.split(':');
  if (!resource || !localId) return null;
  try {
    const data = await gatewayPost<NfDataResponse>(network, '/state/non-fungible/data', {
      resource_address: resource,
      non_fungible_ids: [localId],
    });
    const map = fieldsToMap(data);
    return Object.keys(map).length ? map : null;
  } catch {
    return null;
  }
}

/** Finds a signature NFT in `account` for `docHash`; returns its request_id. */
async function accountSignature(
  network: Network,
  account: string,
  docHash: string,
): Promise<{ signed: boolean; requestId?: string }> {
  try {
    const details = await gatewayPost<EntityDetailsResponse>(
      network,
      '/state/entity/details',
      {
        addresses: [account],
        aggregation_level: 'Vault',
        opt_ins: { non_fungible_include_nfids: true },
      },
    );
    const resources = details.items?.[0]?.non_fungible_resources?.items ?? [];
    let checked = 0;
    for (const res of resources) {
      if (!res.resource_address || checked > 40) break;
      const ids = (res.vaults?.items ?? []).flatMap((v) => v.items ?? []);
      if (ids.length === 0) continue;
      checked += ids.length;
      const data = await gatewayPost<NfDataResponse>(
        network,
        '/state/non-fungible/data',
        { resource_address: res.resource_address, non_fungible_ids: ids.slice(0, 20) },
      );
      const list = data.non_fungible_ids ?? [];
      for (const nf of list) {
        const map: Record<string, string> = {};
        for (const f of nf.data?.programmatic_json?.fields ?? []) {
          if (f.field_name && typeof f.value === 'string') map[f.field_name] = f.value;
        }
        if (map.document_hash !== docHash) continue;
        // A signature NFT points at its request.
        if (map.request_id !== undefined) {
          return { signed: true, requestId: map.request_id };
        }
        // The request NFT itself: the initiator counts as signed only if they
        // signed in the same transaction (initiator_signed).
        if (map.signer_count !== undefined) {
          return {
            signed: map.initiator_signed === 'true',
            requestId: `${res.resource_address}:${nf.non_fungible_id ?? ''}`,
          };
        }
      }
    }
  } catch {
    /* fall through */
  }
  return { signed: false };
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientIp(req.headers));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const { networkId, docHash, account } = parsed.data;
  let { requestId } = parsed.data;
  if (
    networkId !== RadixNetworkId.Mainnet &&
    networkId !== RadixNetworkId.Stokenet
  ) {
    return NextResponse.json({ error: 'invalid_network' }, { status: 400 });
  }
  const network: Network =
    networkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';

  try {
    // Resolve the request from the connected signer's wallet (needs the hash).
    if (!requestId && account && docHash) {
      const found = await accountSignature(network, account, docHash);
      if (found.signed && found.requestId) requestId = found.requestId;
    }
    if (!requestId) {
      return NextResponse.json({ found: false });
    }

    const request = await readNft(network, requestId);
    if (!request?.document_hash) {
      return NextResponse.json({ found: false });
    }
    // The request NFT is the source of truth for the hash.
    const reqDocHash = request.document_hash;
    if (docHash && docHash !== reqDocHash) {
      return NextResponse.json({ found: false, hashMismatch: true });
    }

    const requiredSigners = (request.required_signers ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const signatures = await Promise.all(
      requiredSigners.map(async (a) => ({
        account: a,
        signed: (await accountSignature(network, a, reqDocHash)).signed,
      })),
    );

    return NextResponse.json({
      found: true,
      requestId,
      docHash: reqDocHash,
      networkId,
      disclosure: request.disclosure ?? 'none',
      requiredSigners,
      signatures,
      complete: signatures.length > 0 && signatures.every((s) => s.signed),
    });
  } catch {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
