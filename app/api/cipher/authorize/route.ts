import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { Rola } from '@radixdlt/rola';
import { RadixNetworkId, NETWORKS } from '@/features/wallet/constants/network';
import { checkRateLimit, clientIp } from '@/services/mcp/rate-limit';
import type { Network } from '@/services/gateway/client';
import { deriveUnlockChallenge } from '@/features/cipher/lib/keys';
import {
  collectionSealBelongsTo,
  entityDetails,
  metadataString,
  nfData,
} from '@/features/sign/lib/onchain-custody';
import { radixSealAddress } from '@/features/sign/constants/seal';
import {
  SIGN_COLLECTION_MARKER_KEY,
  SIGN_COLLECTION_MARKER_VALUE,
} from '@/features/sign/constants/seal';

/**
 * POST /api/cipher/authorize
 *
 * Authorization check for a ROLA + Ledger decrypt request, called by the
 * ENCRYPTOR's browser before it releases the key. Verifies, statelessly:
 *
 *  1. The requester's ROLA proof over the unlock challenge, which commits to
 *     the exact container (headerHash) and session (roomId) — no replay.
 *  2. Chain of custody of the invitation: `collection` is a genuine signing
 *     collection whose LOCKED owner seal (official brand, when deployed) sits
 *     in the ENCRYPTOR's account — so only the encryptor could have minted
 *     into it.
 *  3. The requester's account HOLDS a `cipher-invite` NFT of that collection
 *     whose locked data names this container (document_hash = headerHash) and
 *     this receiver (signer = account).
 */

const hex64 = z.string().regex(/^[0-9a-f]{64}$/);

const bodySchema = z
  .object({
    networkId: z.number().int(),
    headerHash: hex64,
    roomId: z.string().regex(/^[0-9a-f]{32}$/),
    account: z.string().max(256),
    senderAccount: z.string().max(256),
    collection: z.string().max(256).startsWith('resource_'),
    proof: z
      .object({
        publicKey: z.string().regex(/^[0-9a-fA-F]{2,200}$/),
        signature: z.string().regex(/^[0-9a-fA-F]{2,256}$/),
        curve: z.enum(['curve25519', 'secp256k1']),
      })
      .strict(),
  })
  .strict();

const MAX_INVITE_IDS = 60;

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
  const { networkId, headerHash, roomId, account, senderAccount, collection, proof } =
    parsed.data;
  if (
    networkId !== RadixNetworkId.Mainnet &&
    networkId !== RadixNetworkId.Stokenet
  ) {
    return NextResponse.json({ error: 'invalid_network' }, { status: 400 });
  }
  const network: Network =
    networkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';

  try {
    // 1. ROLA proof over the session-bound unlock challenge.
    const expectedOrigin = process.env.NEXT_PUBLIC_APP_URL;
    if (!expectedOrigin) throw new Error('missing_origin');
    const rola = Rola({
      networkId,
      applicationName: 'Radix Community',
      dAppDefinitionAddress: NETWORKS[networkId].dAppDefinitionAddress,
      expectedOrigin,
    });
    const challenge = deriveUnlockChallenge({ headerHash, roomId, networkId });
    const rolaOk = (
      await rola.verifySignedChallenge({
        challenge,
        proof,
        address: account,
        type: 'account',
      })
    ).isOk();
    if (!rolaOk) {
      return NextResponse.json({ authorized: false, reason: 'bad_proof' });
    }

    // 2. The invite collection provably belongs to the encryptor.
    const [collectionItem] = await entityDetails(network, [collection]);
    if (
      metadataString(collectionItem, SIGN_COLLECTION_MARKER_KEY) !==
      SIGN_COLLECTION_MARKER_VALUE
    ) {
      return NextResponse.json({ authorized: false, reason: 'bad_collection' });
    }
    const officialSeal = radixSealAddress(networkId);
    const custodyOk = await collectionSealBelongsTo(
      network,
      collectionItem,
      senderAccount,
      officialSeal,
    );
    if (!custodyOk) {
      return NextResponse.json({ authorized: false, reason: 'bad_collection' });
    }

    // 3. The requester HOLDS a matching cipher-invite from that collection.
    const [accountItem] = await entityDetails(network, [account], {
      non_fungible_include_nfids: true,
    });
    const heldIds = (accountItem?.non_fungible_resources?.items ?? [])
      .filter((r) => r.resource_address === collection)
      .flatMap((r) => (r.vaults?.items ?? []).flatMap((v) => v.items ?? []))
      .slice(0, MAX_INVITE_IDS);
    if (heldIds.length === 0) {
      return NextResponse.json({ authorized: false, reason: 'no_invite' });
    }
    const data = await nfData(network, collection, heldIds);
    const invited = [...data.values()].some(
      (fields) =>
        fields.kind === 'cipher-invite' &&
        fields.document_hash === headerHash &&
        fields.signer === account,
    );
    if (!invited) {
      return NextResponse.json({ authorized: false, reason: 'no_invite' });
    }

    return NextResponse.json({ authorized: true });
  } catch {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
