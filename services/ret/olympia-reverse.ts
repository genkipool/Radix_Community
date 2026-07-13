/**
 * services/ret/olympia-reverse.ts
 *
 * Babylon → Olympia reverse address resolution.
 *
 * A Babylon virtual account address is a one-way hash of the owner public key,
 * so the Olympia address cannot be derived from it offline. However, secp256k1
 * signatures on Radix are recoverable: if the account ever signed a Babylon
 * transaction we can recover its public key from an on-ledger signature and
 * re-encode it as the original Olympia address.
 *
 * Strategy: fetch recent transactions where the account withdrew funds (those
 * must carry an owner signature), decompile each with RET, collect candidate
 * secp256k1 public keys (recovered from intent signatures, plus the notary key
 * when `notaryIsSignatory`), and keep the one whose virtual account address
 * matches the queried address.
 */

import { RadixEngineToolkit, PublicKey } from '@radixdlt/radix-engine-toolkit';
import { secp256k1 } from '@noble/curves/secp256k1';
import { getGateway, withRetry, type Network } from '@/services/gateway/client';
import { networkIdFromName, olympiaAddressFromPublicKeyHex } from './index';

const MAX_TRANSACTIONS_TO_INSPECT = 10;

export type OlympiaReverseFailure = 'no-transactions' | 'not-found' | 'invalid-address';

export class OlympiaReverseError extends Error {
  constructor(public readonly reason: OlympiaReverseFailure) {
    super(reason);
  }
}

export interface OlympiaReverseResult {
  olympiaAddress: string;
  publicKeyHex: string;
}

/** Recovers the compressed public key from a 65-byte (recid ‖ r ‖ s) signature. */
function recoverPublicKey(signature: Uint8Array, signedHash: Uint8Array): Uint8Array | null {
  if (signature.length !== 65) return null;
  try {
    return secp256k1.Signature.fromCompact(signature.slice(1))
      .addRecoveryBit(signature[0])
      .recoverPublicKey(signedHash)
      .toRawBytes(true);
  } catch {
    return null;
  }
}

/** Collects candidate secp256k1 public keys from one raw notarized transaction. */
async function candidateKeysFromRawTx(rawHex: string): Promise<Uint8Array[]> {
  const notarized = await RadixEngineToolkit.NotarizedTransaction.decompile(
    Buffer.from(rawHex, 'hex'),
  );
  const { intent, intentSignatures } = notarized.signedIntent;
  const candidates: Uint8Array[] = [];

  const notaryKey = intent.header.notaryPublicKey;
  if (notaryKey.curve === 'Secp256k1') candidates.push(notaryKey.bytes);

  const secpSignatures = intentSignatures.filter((sig) => sig.curve === 'Secp256k1');
  if (secpSignatures.length > 0) {
    const intentHash = await RadixEngineToolkit.Intent.intentHash(intent);
    for (const sig of secpSignatures) {
      const recovered = recoverPublicKey(sig.signature, intentHash.hash);
      if (recovered) candidates.push(recovered);
    }
  }
  return candidates;
}

/**
 * Resolves the Olympia address of a migrated (legacy) Babylon account by
 * recovering its public key from on-ledger signatures.
 * Throws {@link OlympiaReverseError} when the account has no signed
 * transactions or none of the recovered keys match.
 */
export async function findOlympiaAddressForBabylonAccount(
  babylonAddress: string,
  network: Network,
): Promise<OlympiaReverseResult> {
  const gateway = getGateway(network);
  const networkId = networkIdFromName(network);

  const res = await withRetry(() =>
    gateway.stream.innerClient.streamTransactions({
      streamTransactionsRequest: {
        manifest_accounts_withdrawn_from_filter: [babylonAddress],
        limit_per_page: MAX_TRANSACTIONS_TO_INSPECT,
        opt_ins: { raw_hex: true },
      },
    }),
  ).catch((err) => {
    // The gateway 400s on malformed bech32m addresses
    if (err instanceof Error && err.message.includes('InvalidRequestError')) {
      throw new OlympiaReverseError('invalid-address');
    }
    throw err;
  });

  const rawTxs = (res.items ?? [])
    .map((item) => item.raw_hex)
    .filter((hex): hex is string => Boolean(hex));
  if (rawTxs.length === 0) throw new OlympiaReverseError('no-transactions');

  const seen = new Set<string>();
  for (const rawHex of rawTxs) {
    const candidates = await candidateKeysFromRawTx(rawHex).catch(() => []);
    for (const candidate of candidates) {
      const hex = Buffer.from(candidate).toString('hex');
      if (seen.has(hex)) continue;
      seen.add(hex);

      const derived = await RadixEngineToolkit.Derive.virtualAccountAddressFromPublicKey(
        new PublicKey.Secp256k1(candidate),
        networkId,
      );
      if (derived === babylonAddress) {
        return {
          olympiaAddress: await olympiaAddressFromPublicKeyHex(hex, network),
          publicKeyHex: hex,
        };
      }
    }
  }
  throw new OlympiaReverseError('not-found');
}
