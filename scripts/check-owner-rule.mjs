/**
 * Verifies, against REAL Stokenet ledger data, that the owner-rule extraction
 * used by the hardened certificate verification matches how the gateway
 * actually represents an attestation collection's owner (an account's signature
 * virtual badge).
 *
 * Usage:  node scripts/check-owner-rule.mjs <account_or_collection_address>
 *   - account_...     → discovers the account's attestation collection(s)
 *   - resource_...     → checks that resource directly
 *
 * It DUMPS the raw role_assignments.owner JSON so we can see the exact shape,
 * then runs the same extraction + account-badge comparison the server uses.
 */
const GATEWAY = 'https://gateway-stokenet.radix.community';
const NETWORK_ID = 2; // Stokenet
const COLLECTION_MARKER_KEY = 'radix_seal_collection';
const COLLECTION_MARKER_VALUE = 'v1';

async function gw(path, body) {
  const res = await fetch(`${GATEWAY}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gateway ${res.status}: ${await res.text()}`);
  return res.json();
}

function metadataString(item, key) {
  const typed = item?.metadata?.items?.find((m) => m.key === key)?.value?.typed;
  return typeof typed?.value === 'string' ? typed.value : '';
}

// ── Copy of the server extraction (features/sign/lib/onchain-custody.ts) ──
function sealFromOwnerRule(item) {
  const owner = item?.details?.role_assignments?.owner;
  if (!owner) return null;
  const json = JSON.stringify(owner);
  if (/AllowAll/.test(json)) return null;
  let resource = null;
  let localId = null;
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.resource_address === 'string' && node.resource_address.startsWith('resource_'))
      resource = node.resource_address;
    if (typeof node.simple_rep === 'string') localId = node.simple_rep;
    for (const v of Object.values(node)) walk(v);
  };
  walk(owner);
  return resource && localId ? { resource, localId } : null;
}

const HEX = '0123456789abcdef';
function bytesToHex(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += HEX[bytes[i] >> 4] + HEX[bytes[i] & 0x0f];
  return out;
}

async function accountSignatureBadge(account) {
  const { RadixEngineToolkit } = await import('@radixdlt/radix-engine-toolkit');
  const known = await RadixEngineToolkit.Utils.knownAddresses(NETWORK_ID);
  const decoded = await RadixEngineToolkit.Address.decode(account);
  return {
    localId: `[${bytesToHex(decoded.data.slice(-29))}]`,
    resources: [
      known.resourceAddresses.ed25519SignatureVirtualBadge,
      known.resourceAddresses.secp256k1SignatureVirtualBadge,
    ],
  };
}

async function entityDetails(addresses, optIns) {
  if (addresses.length === 0) return [];
  const out = [];
  for (let i = 0; i < addresses.length; i += 20) {
    const data = await gw('/state/entity/details', {
      addresses: addresses.slice(i, i + 20),
      aggregation_level: 'Vault',
      ...(optIns ? { opt_ins: optIns } : {}),
    });
    out.push(...(data.items ?? []));
  }
  return out;
}

async function collectionsForAccount(account) {
  const [acc] = await entityDetails([account], { non_fungible_include_nfids: true });
  const resources = (acc?.non_fungible_resources?.items ?? [])
    .map((r) => r.resource_address)
    .filter(Boolean);
  const details = await entityDetails(resources);
  return details.filter(
    (c) => metadataString(c, COLLECTION_MARKER_KEY) === COLLECTION_MARKER_VALUE,
  );
}

async function main() {
  const addr = process.argv[2];
  if (!addr) {
    console.error('Usage: node scripts/check-owner-rule.mjs <account_or_collection_address>');
    process.exit(1);
  }

  let collections;
  let account = null;
  if (addr.startsWith('account_')) {
    account = addr;
    collections = await collectionsForAccount(addr);
    if (collections.length === 0) {
      console.log(`No attestation collection (marker ${COLLECTION_MARKER_KEY}=${COLLECTION_MARKER_VALUE}) held by ${addr}.`);
      console.log('Sign+anchor a document on Stokenet with this account first, or pass a resource_ address.');
      return;
    }
  } else {
    collections = await entityDetails([addr]);
  }

  for (const c of collections) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('collection:', c.address);
    console.log('marker:', metadataString(c, COLLECTION_MARKER_KEY) || '(none)');
    console.log('\n--- RAW role_assignments.owner ---');
    console.log(JSON.stringify(c.details?.role_assignments?.owner ?? null, null, 2));

    const extracted = sealFromOwnerRule(c);
    console.log('\n--- extracted by sealFromOwnerRule ---');
    console.log(extracted);

    if (account && extracted) {
      const badge = await accountSignatureBadge(account);
      console.log('\n--- expected account badge ---');
      console.log(badge);
      const ok =
        extracted.localId === badge.localId && badge.resources.includes(extracted.resource);
      console.log('\ncollectionOwnedByAccount →', ok ? 'PASS ✅' : 'FAIL ❌');
      if (!ok) {
        console.log('  localId match:', extracted.localId === badge.localId,
          `(got ${extracted.localId} vs ${badge.localId})`);
        console.log('  resource in badges:', badge.resources.includes(extracted.resource),
          `(got ${extracted.resource})`);
      }
    }
  }
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
