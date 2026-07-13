'use client';

/**
 * Derives the Radix "virtual signature" NonFungibleGlobalId of an account —
 * i.e. the badge an access rule requires so that "this account signed" is the
 * proof (`require(signature(from_public_key))` in Scrypto terms).
 *
 * We avoid re-hashing the public key: a virtual account's NodeId already
 * embeds the 29-byte public-key hash the engine uses, so decoding the account
 * address and taking those bytes yields exactly the badge's local id. The
 * badge resource (Ed25519 vs Secp256k1) comes from the network's known
 * addresses. Runs in the browser (RET WASM).
 */
const HEX = '0123456789abcdef';

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += HEX[bytes[i] >> 4] + HEX[bytes[i] & 0x0f];
  }
  return out;
}

export async function accountSignatureGlobalId(
  accountAddress: string,
  curve: string,
  networkId: number,
): Promise<string> {
  const { RadixEngineToolkit } = await import('@radixdlt/radix-engine-toolkit');
  const known = await RadixEngineToolkit.Utils.knownAddresses(networkId);
  const badgeResource =
    curve === 'curve25519'
      ? known.resourceAddresses.ed25519SignatureVirtualBadge
      : known.resourceAddresses.secp256k1SignatureVirtualBadge;

  const decoded = await RadixEngineToolkit.Address.decode(accountAddress);
  // A virtual account NodeId = entity-type byte + 29-byte public-key hash; the
  // signature badge's local id is those 29 bytes.
  const hashBytes = decoded.data.slice(-29);
  return `${badgeResource}:[${toHex(hashBytes)}]`;
}
