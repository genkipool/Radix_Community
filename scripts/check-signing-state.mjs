/**
 * Reports an account's on-ledger signing state on Stokenet:
 *   - the Radix Seal NFT it holds (its insignia)  → seal global id
 *   - its Seal-owned signing collection (model 1)  → resource + supply + owner
 *
 * Usage: node scripts/check-signing-state.mjs <account_address>
 */
const GATEWAY = 'https://gateway-stokenet.radix.community';
const SEAL_RESOURCE = 'resource_tdx_2_1n2dnu585z0c6hsl9tvlqaufnrxstepwpdjv5tumvrslqq77t7dgrwm';
const SIGN_COLLECTION_MARKER_KEY = 'radix_sign_collection';
const SIGN_COLLECTION_MARKER_VALUE = 'v1';

async function gw(path, body) {
  const res = await fetch(`${GATEWAY}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gateway ${res.status}: ${await res.text()}`);
  return res.json();
}
function metaStr(item, key) {
  const t = item?.metadata?.items?.find((m) => m.key === key)?.value?.typed;
  return typeof t?.value === 'string' ? t.value : '';
}
async function entityDetails(addresses, optIns) {
  const out = [];
  for (let i = 0; i < addresses.length; i += 20) {
    const d = await gw('/state/entity/details', {
      addresses: addresses.slice(i, i + 20), aggregation_level: 'Vault',
      ...(optIns ? { opt_ins: optIns } : {}),
    });
    out.push(...(d.items ?? []));
  }
  return out;
}

async function main() {
  const account = process.argv[2];
  if (!account) { console.error('need account address'); process.exit(1); }

  const [acc] = await entityDetails([account], { non_fungible_include_nfids: true });
  const held = (acc?.non_fungible_resources?.items ?? []).map((r) => ({
    resource: r.resource_address ?? '',
    ids: (r.vaults?.items ?? []).flatMap((v) => v.items ?? []),
  })).filter((r) => r.resource);

  const sealHeld = held.find((r) => r.resource === SEAL_RESOURCE);
  console.log('SEAL NFT:');
  if (sealHeld && sealHeld.ids.length) {
    console.log('  globalId:', `${SEAL_RESOURCE}:${sealHeld.ids[0]}`);
  } else {
    console.log('  none held (findUserSeal → null)');
  }

  const details = await entityDetails(held.map((r) => r.resource));
  const signCols = details.filter(
    (c) => metaStr(c, SIGN_COLLECTION_MARKER_KEY) === SIGN_COLLECTION_MARKER_VALUE,
  );
  console.log('\nSIGN COLLECTIONS (model 1, marker ' + SIGN_COLLECTION_MARKER_KEY + '=' + SIGN_COLLECTION_MARKER_VALUE + '):');
  if (!signCols.length) console.log('  none (findSignCollection → null → anchor would CREATE one)');
  for (const c of signCols) {
    console.log('  resource:', c.address);
    console.log('    total_supply:', c.details?.total_supply ?? '(n/a)');
    console.log('    owner:', JSON.stringify(c.details?.role_assignments?.owner ?? null));
  }
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
