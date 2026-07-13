import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { checkRateLimit, clientIp } from '@/services/mcp/rate-limit';
import { gatewayPost } from '@/services/gateway/bases';
import type { Network } from '@/services/gateway/client';
import {
  SIGN_COLLECTION_MARKER_KEY,
  SIGN_COLLECTION_MARKER_VALUE,
} from '@/features/sign/constants/seal';

/**
 * POST /api/sign/onchain-status
 *
 * Reads the on-ledger state of a Radix Seal signing request.
 *
 * The request key is the first INVITATION NFT's global id
 * (`<initiator collection>:#<firstId>#`). The invitation batch (locked data)
 * names the required signers. A signer counts as SIGNED only when a
 * signature NFT for this document exists in a collection that provably
 * belongs to them — proven from the ledger alone via the chain of custody:
 *
 *   signature NFT (in signer's account, locked data, doc hash matches)
 *     → minted from a collection whose LOCKED owner rule requires a seal NFT
 *       → and that soulbound seal NFT is located in the signer's account.
 *
 * Nobody can mint into someone else's collection, seals can never move, so
 * signatures cannot be forged on another account's behalf.
 */

const bodySchema = z
  .object({
    networkId: z.number().int(),
    docHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
    requestId: z.string().max(600).optional(),
    account: z.string().max(256).optional(),
  })
  .strict();

const MAX_SIGNERS = 25;
const MAX_CANDIDATE_RESOURCES = 30;
const MAX_IDS_PER_COLLECTION = 60;

interface NfDataResponse {
  non_fungible_ids?: Array<{
    non_fungible_id?: string;
    data?: { programmatic_json?: { fields?: Array<{ field_name?: string; value?: unknown }> } };
  }>;
}

interface NfLocationResponse {
  non_fungible_ids?: Array<{
    non_fungible_id?: string;
    is_burned?: boolean;
    owning_vault_global_ancestor_address?: string;
  }>;
}

interface EntityDetailsItem {
  address?: string;
  metadata?: {
    items?: Array<{
      key?: string;
      value?: { typed?: { type?: string; value?: unknown } };
    }>;
  };
  details?: {
    role_assignments?: { owner?: unknown };
  };
  non_fungible_resources?: {
    items?: Array<{
      resource_address?: string;
      vaults?: { items?: Array<{ items?: string[] }> };
    }>;
  };
}

interface EntityDetailsResponse {
  items?: EntityDetailsItem[];
}

function nfFieldMap(
  nf: NonNullable<NfDataResponse['non_fungible_ids']>[number] | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of nf?.data?.programmatic_json?.fields ?? []) {
    if (f.field_name && typeof f.value === 'string') out[f.field_name] = f.value;
  }
  return out;
}

function metadataString(item: EntityDetailsItem | undefined, key: string): string {
  const typed = item?.metadata?.items?.find((m) => m.key === key)?.value?.typed;
  return typeof typed?.value === 'string' ? typed.value : '';
}

async function entityDetails(
  network: Network,
  addresses: string[],
  optIns?: Record<string, unknown>,
): Promise<EntityDetailsItem[]> {
  if (addresses.length === 0) return [];
  const out: EntityDetailsItem[] = [];
  for (let i = 0; i < addresses.length; i += 20) {
    const data = await gatewayPost<EntityDetailsResponse>(
      network,
      '/state/entity/details',
      {
        addresses: addresses.slice(i, i + 20),
        aggregation_level: 'Vault',
        ...(optIns ? { opt_ins: optIns } : {}),
      },
    );
    out.push(...(data.items ?? []));
  }
  return out;
}

async function nfData(
  network: Network,
  resource: string,
  ids: string[],
): Promise<Map<string, Record<string, string>>> {
  const out = new Map<string, Record<string, string>>();
  for (let i = 0; i < ids.length; i += 50) {
    const data = await gatewayPost<NfDataResponse>(
      network,
      '/state/non-fungible/data',
      { resource_address: resource, non_fungible_ids: ids.slice(i, i + 50) },
    ).catch(() => ({}) as NfDataResponse);
    for (const nf of data.non_fungible_ids ?? []) {
      if (nf.non_fungible_id) out.set(nf.non_fungible_id, nfFieldMap(nf));
    }
  }
  return out;
}

/**
 * Extracts the seal NFT global id from a collection's LOCKED owner rule.
 * Returns null unless the rule requires exactly a non-fungible (no AllowAll
 * escape hatch a forger could hide behind).
 */
function sealFromOwnerRule(
  item: EntityDetailsItem | undefined,
): { resource: string; localId: string } | null {
  const owner = item?.details?.role_assignments?.owner;
  if (!owner) return null;
  const json = JSON.stringify(owner);
  if (/AllowAll/.test(json)) return null;
  let resource: string | null = null;
  let localId: string | null = null;
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    if (
      typeof obj.resource_address === 'string' &&
      obj.resource_address.startsWith('resource_')
    ) {
      resource = obj.resource_address;
    }
    if (typeof obj.simple_rep === 'string') localId = obj.simple_rep;
    for (const v of Object.values(obj)) walk(v);
  };
  walk(owner);
  return resource && localId ? { resource, localId } : null;
}

/** Account that holds (unburned) `localId` of `resource`, or null. */
async function nfOwnerAccount(
  network: Network,
  resource: string,
  localId: string,
): Promise<string | null> {
  const loc = await gatewayPost<NfLocationResponse>(
    network,
    '/state/non-fungible/location',
    { resource_address: resource, non_fungible_ids: [localId] },
  ).catch(() => ({}) as NfLocationResponse);
  const item = loc.non_fungible_ids?.[0];
  if (!item || item.is_burned) return null;
  const owner = item.owning_vault_global_ancestor_address ?? '';
  return owner.startsWith('account_') ? owner : null;
}

/**
 * True when `signer` holds a valid signature for `docHash` in a collection
 * that provably belongs to them (see chain of custody above).
 */
async function signerHasSigned(
  network: Network,
  signer: string,
  docHash: string,
): Promise<boolean> {
  const [accountItem] = await entityDetails(network, [signer], {
    non_fungible_include_nfids: true,
  });
  const held = (accountItem?.non_fungible_resources?.items ?? [])
    .map((r) => ({
      resource: r.resource_address ?? '',
      ids: (r.vaults?.items ?? []).flatMap((v) => v.items ?? []),
    }))
    .filter((r) => r.resource && r.ids.length > 0)
    .slice(0, MAX_CANDIDATE_RESOURCES);

  const candidates = await entityDetails(
    network,
    held.map((r) => r.resource),
  );
  const marked = candidates.filter(
    (c) =>
      metadataString(c, SIGN_COLLECTION_MARKER_KEY) ===
      SIGN_COLLECTION_MARKER_VALUE,
  );

  for (const collection of marked) {
    const address = collection.address ?? '';
    const ids =
      held
        .find((r) => r.resource === address)
        ?.ids.slice(0, MAX_IDS_PER_COLLECTION) ?? [];
    if (ids.length === 0) continue;

    const data = await nfData(network, address, ids);
    const hasSignature = [...data.values()].some(
      (fields) =>
        fields.kind === 'signature' &&
        fields.document_hash === docHash &&
        fields.signer === signer,
    );
    if (!hasSignature) continue;

    // Chain of custody: the collection's owner seal must live in `signer`.
    const seal = sealFromOwnerRule(collection);
    if (!seal) continue;
    if ((await nfOwnerAccount(network, seal.resource, seal.localId)) === signer) {
      return true;
    }
  }
  return false;
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
  const { networkId, docHash, requestId } = parsed.data;
  if (
    networkId !== RadixNetworkId.Mainnet &&
    networkId !== RadixNetworkId.Stokenet
  ) {
    return NextResponse.json({ error: 'invalid_network' }, { status: 400 });
  }
  const network: Network =
    networkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';

  const match = requestId?.match(/^(resource_[a-z0-9_]+):#(\d+)#$/);
  if (!match) {
    return NextResponse.json({ found: false });
  }
  const collection = match[1];

  try {
    // 1. The anchor invitation → doc hash + batch geometry (locked data).
    const anchorData = await nfData(network, collection, [`#${match[2]}#`]);
    const anchor = anchorData.get(`#${match[2]}#`);
    if (!anchor || anchor.kind !== 'invite' || !anchor.document_hash) {
      return NextResponse.json({ found: false });
    }
    const reqDocHash = anchor.document_hash;
    if (docHash && docHash !== reqDocHash) {
      return NextResponse.json({ found: false, hashMismatch: true });
    }
    const firstId = Number.parseInt(anchor.first_id || match[2], 10);
    const count = Number.parseInt(anchor.signer_count || '0', 10);
    if (
      !Number.isInteger(firstId) ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > MAX_SIGNERS
    ) {
      return NextResponse.json({ found: false });
    }

    // 2. The whole invitation batch → the required signer list.
    const inviteIds = Array.from({ length: count }, (_, i) => `#${firstId + i}#`);
    const invites = await nfData(network, collection, inviteIds);
    const signers = inviteIds
      .map((id, i) => ({ id, index: i, fields: invites.get(id) }))
      .filter(
        (e) =>
          e.fields?.kind === 'invite' &&
          e.fields.document_hash === reqDocHash &&
          !!e.fields.signer,
      )
      .map((e) => ({ account: e.fields!.signer, index: e.index }));
    if (signers.length === 0) {
      return NextResponse.json({ found: false });
    }

    // 3. The initiator's collection: marker + issuer identity + owner seal.
    const [collectionItem] = await entityDetails(network, [collection]);
    if (
      metadataString(collectionItem, SIGN_COLLECTION_MARKER_KEY) !==
      SIGN_COLLECTION_MARKER_VALUE
    ) {
      return NextResponse.json({ found: false });
    }
    const seal = sealFromOwnerRule(collectionItem);
    const issuerAccount = seal
      ? await nfOwnerAccount(network, seal.resource, seal.localId)
      : null;

    // 4. Per-signer signature check (chain of custody).
    const signatures = await Promise.all(
      signers.map(async (s) => ({
        account: s.account,
        signed: await signerHasSigned(network, s.account, reqDocHash),
      })),
    );

    return NextResponse.json({
      found: true,
      mode: 'seal',
      requestId: `${collection}:#${firstId}#`,
      collection,
      docHash: reqDocHash,
      networkId,
      requiredSigners: signatures.map((s) => s.account),
      signatures,
      complete: signatures.length > 0 && signatures.every((s) => s.signed),
      issuer: {
        account: issuerAccount ?? undefined,
        collectionName: metadataString(collectionItem, 'name') || undefined,
        orgName: metadataString(collectionItem, 'org_name') || undefined,
        orgWebsite: metadataString(collectionItem, 'org_url') || undefined,
        orgLogoUrl: metadataString(collectionItem, 'icon_url') || undefined,
      },
    });
  } catch {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
