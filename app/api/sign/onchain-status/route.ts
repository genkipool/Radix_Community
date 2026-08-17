import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { checkRateLimit, clientIp } from '@/services/mcp/rate-limit';
import type { Network } from '@/services/gateway/client';
import {
  radixSealAddress,
  SIGN_COLLECTION_MARKER_KEY,
  SIGN_COLLECTION_MARKER_VALUE,
} from '@/features/sign/constants/seal';
import {
  entityDetails,
  findSignerSignature,
  ledgerCommit,
  metadataString,
  nfData,
  nfRecords,
  nfOwnerAccount,
  sealFromOwnerRule,
} from '@/features/sign/lib/onchain-custody';

/**
 * POST /api/sign/onchain-status
 *
 * Reads the on-ledger state of a Radix Seal signing request.
 *
 * The request key is the first INVITATION NFT's global id
 * (`<initiator collection>:#<firstId>#`). The invitation batch (locked data)
 * names the required signers. A signer counts as SIGNED only when a
 * signature NFT for this document exists in a collection that provably
 * belongs to them — the chain-of-custody check lives in
 * `@/features/sign/lib/onchain-custody`.
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

  // Accept the canonical global id (`resource:#25#`) and lenient hand-typed
  // variants like `resource#25`, `resource:25` or `resource:#25`.
  const match = requestId
    ?.trim()
    .match(/^(resource_[a-z0-9_]+):?#?(\d+)#?$/);
  if (!match) {
    return NextResponse.json({ found: false });
  }
  const collection = match[1];

  try {
    // 1. The anchor invitation → doc hash + batch geometry (locked data).
    const anchorData = await nfRecords(network, collection, [`#${match[2]}#`]);
    const anchorRecord = anchorData.get(`#${match[2]}#`);
    const anchor = anchorRecord?.fields;
    if (!anchor || anchor.kind !== 'invite' || !anchor.document_hash) {
      return NextResponse.json({ found: false });
    }
    // When the request came into being: the consensus time of the transaction
    // that minted its first invitation. A certificate built from this status
    // reports that as the document's creation date — the alternative was the
    // moment somebody pressed download, days later. Its intent hash travels
    // too: it is THE transaction that put this request on the ledger, so the
    // share box and the signed PDF can point a reader straight at it.
    const created = await ledgerCommit(network, anchorRecord.stateVersion);
    const createdAt = created.confirmedAt;
    const reqDocHash = anchor.document_hash;
    // A mismatching file must not hide the request: the caller still gets the
    // full status plus the mismatch flag, so the UI can say WHY it fails.
    const hashMismatch = !!docHash && docHash !== reqDocHash;
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
    // The COMPLETE batch must exist: a burned invitation (legacy collections
    // allowed owner burns) must not shrink the required set and fake progress.
    if (signers.length !== count) {
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

    // 4. Per-signer signature check (chain of custody), with the moment the
    // network agreed each signature existed. That consensus time is the only
    // defensible date for an on-ledger signature, so it is what the certificate
    // built from this status records — never the clock of whoever builds it.
    // The official brand is required here too. Without it this route would
    // count a signature in a collection gated by a look-alike seal that the
    // verify route rejects, and the two would disagree about who has signed —
    // and, now that this reports WHEN, about the date a certificate records.
    const officialSeal = radixSealAddress(networkId);
    const signatures = await Promise.all(
      signers.map(async (s) => {
        const found = await findSignerSignature(
          network,
          s.account,
          reqDocHash,
          officialSeal,
        );
        const commit = found
          ? await ledgerCommit(network, found.stateVersion)
          : null;
        return {
          account: s.account,
          signed: !!found,
          signedAt: commit?.confirmedAt ?? null,
          // The transaction that minted this signature: the certificate prints
          // it, and anyone can open it in an explorer and see the mint.
          txId: commit?.intentHash ?? null,
          // The signature NFT itself (`resource_…:#7#`) — the evidence the
          // chain-of-custody check just accepted. The certificate prints it so
          // a reader can look up the token, not only the mint transaction.
          nftGlobalId: found?.nftGlobalId ?? null,
        };
      }),
    );

    return NextResponse.json({
      found: true,
      mode: 'seal',
      requestId: `${collection}:#${firstId}#`,
      collection,
      docHash: reqDocHash,
      hashMismatch,
      createdAt,
      createdTxId: created.intentHash,
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
