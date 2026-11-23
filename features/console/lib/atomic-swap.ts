/**
 * Pure P2P Atomic OTC Swap engine (Subintent V2 + Direct V1).
 * Shared by `AtomicSwapTool` (UI) and `prepare_atomic_swap` (MCP).
 *
 * Zero Redis commands, zero third-party contracts: relies solely on native
 * Radix Engine worktop assertions and Subintents (Pre-authorizations).
 * Supports single or multiple resources on both sides of the swap.
 */

export type SwapAsset =
  | { kind: 'fungible'; resourceAddress: string; amount: string }
  | { kind: 'nft'; resourceAddress: string; ids: string[] };

export type SwapAssetInput = SwapAsset | SwapAsset[];

export interface AtomicSwapOffer {
  v: 1;
  network: 'mainnet' | 'stokenet';
  makerAccount: string;
  offer: SwapAssetInput;
  want: SwapAssetInput;
  subintentHash: string;
  signedPartialTransaction: string;
  expirationTimestamp: number;
  /** Optional note attached by the Maker and shown when inspecting the offer. */
  message?: string;
}

export const EXPIRATION_PRESETS = [
  { key: '15m', seconds: 15 * 60 },
  { key: '1h', seconds: 60 * 60 },
  { key: '2h', seconds: 2 * 60 * 60 },
  { key: '3h', seconds: 3 * 60 * 60 },
  { key: '6h', seconds: 6 * 60 * 60 },
  { key: '8h', seconds: 8 * 60 * 60 },
  { key: '12h', seconds: 12 * 60 * 60 },
  { key: '24h', seconds: 24 * 60 * 60 },
] as const;

export const XRD_RESOURCE_BY_NETWORK: Record<'mainnet' | 'stokenet', string> = {
  mainnet: 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
  stokenet: 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc',
};

export const STOKENET_FAUCET_ADDRESS =
  'component_tdx_2_1cptxxxxxxxxxfaucetxxxxxxxxx000527798379xxxxxxxxxyulkzl';

export function normalizeSwapAssets(input: SwapAssetInput): SwapAsset[] {
  return Array.isArray(input) ? input : [input];
}

function withdrawInstruction(account: string, asset: SwapAsset): string {
  if (asset.kind === 'fungible') {
    return `CALL_METHOD\n    Address("${account}")\n    "withdraw"\n    Address("${asset.resourceAddress}")\n    Decimal("${asset.amount}")\n;`;
  }
  const idsList = asset.ids.map((id) => `NonFungibleLocalId("${id}")`).join(', ');
  return `CALL_METHOD\n    Address("${account}")\n    "withdraw_non_fungibles"\n    Address("${asset.resourceAddress}")\n    Array<NonFungibleLocalId>(${idsList})\n;`;
}

function assertWorktopInstruction(asset: SwapAsset): string {
  if (asset.kind === 'fungible') {
    return `ASSERT_WORKTOP_CONTAINS\n    Address("${asset.resourceAddress}")\n    Decimal("${asset.amount}")\n;`;
  }
  const idsList = asset.ids.map((id) => `NonFungibleLocalId("${id}")`).join(', ');
  return `ASSERT_WORKTOP_CONTAINS_NON_FUNGIBLES\n    Address("${asset.resourceAddress}")\n    Array<NonFungibleLocalId>(${idsList})\n;`;
}

function takeBucketInstruction(asset: SwapAsset, bucketName: string): string {
  if (asset.kind === 'fungible') {
    return `TAKE_FROM_WORKTOP\n    Address("${asset.resourceAddress}")\n    Decimal("${asset.amount}")\n    Bucket("${bucketName}")\n;`;
  }
  const idsList = asset.ids.map((id) => `NonFungibleLocalId("${id}")`).join(', ');
  return `TAKE_NON_FUNGIBLES_FROM_WORKTOP\n    Address("${asset.resourceAddress}")\n    Array<NonFungibleLocalId>(${idsList})\n    Bucket("${bucketName}")\n;`;
}

export function isValidSwapAsset(asset: SwapAsset): boolean {
  if (!asset.resourceAddress.startsWith('resource_')) return false;
  if (asset.kind === 'fungible') {
    const n = parseFloat(asset.amount);
    return Number.isFinite(n) && n > 0;
  }
  return asset.ids.length > 0 && asset.ids.every((id) => id.trim().length > 0);
}

function areValidSwapAssets(input: SwapAssetInput): boolean {
  const list = normalizeSwapAssets(input);
  return list.length > 0 && list.every(isValidSwapAsset);
}

/**
 * Builds the Maker's Subintent (Pre-authorization) manifest:
 * 1. Withdraws all Maker offered assets, takes them into buckets, and explicitly
 *    yields those buckets to the parent (`YIELD_TO_PARENT Bucket(...)`).
 * 2. When resumed by the parent, asserts every wanted asset is on worktop.
 * 3. Deposits the wanted assets into Maker's account and yields cleanly.
 */
export function buildMakerSubintentManifest(
  makerAccount: string,
  offer: SwapAssetInput,
  want: SwapAssetInput,
): string {
  if (!makerAccount.startsWith('account_') || !areValidSwapAssets(offer) || !areValidSwapAssets(want)) {
    return '';
  }
  const offers = normalizeSwapAssets(offer);
  const wants = normalizeSwapAssets(want);
  const lines: string[] = [];
  const offerBuckets: string[] = [];

  offers.forEach((asset, idx) => {
    const bucket = `offer_${idx}`;
    lines.push(withdrawInstruction(makerAccount, asset));
    lines.push(takeBucketInstruction(asset, bucket));
    offerBuckets.push(`Bucket("${bucket}")`);
  });

  lines.push(`YIELD_TO_PARENT\n    ${offerBuckets.join('\n    ')}\n;`);
  for (const a of wants) {
    lines.push(assertWorktopInstruction(a));
  }
  lines.push(
    `CALL_METHOD\n    Address("${makerAccount}")\n    "deposit_batch"\n    Expression("ENTIRE_WORKTOP")\n;`,
  );
  lines.push('YIELD_TO_PARENT;');
  return lines.join('\n');
}

/**
 * Builds the Taker's Subintent manifest for 1-click V2 settlement.
 *
 * NOTE: Radix protocol forbids `lock_fee` inside a Subintent (Wallet rejects it
 * as a reserved instruction). Instead, the Taker withdraws a small XRD fee budget
 * (`V2_SETTLEMENT_FEE_XRD`) alongside `want`, puts them in buckets, and explicitly
 * yields them to the root intent (`YIELD_TO_PARENT Bucket("fee_xrd") ...`), which
 * deposits `fee_xrd` into the ephemeral virtual notary account and locks the fee.
 */
/**
 * Builds the Taker's Subintent manifest for 1-click V2 settlement:
 * 1. Withdraws all `want` assets, puts them into buckets, and explicitly yields
 *    them to the root orchestrator (`YIELD_TO_PARENT Bucket(...)`).
 * 2. When resumed, asserts Maker's `offer` assets arrived, deposits them into
 *    Taker's account, and yields cleanly.
 */
export function buildTakerSubintentManifest(
  takerAccount: string,
  want: SwapAssetInput,
  offer: SwapAssetInput,
): string {
  if (!takerAccount.startsWith('account_') || !areValidSwapAssets(want) || !areValidSwapAssets(offer)) {
    return '';
  }
  const wants = normalizeSwapAssets(want);
  const offers = normalizeSwapAssets(offer);
  const lines: string[] = [];
  const wantBuckets: string[] = [];

  wants.forEach((asset, idx) => {
    const bucket = `want_${idx}`;
    lines.push(withdrawInstruction(takerAccount, asset));
    lines.push(takeBucketInstruction(asset, bucket));
    wantBuckets.push(`Bucket("${bucket}")`);
  });

  lines.push(`YIELD_TO_PARENT\n    ${wantBuckets.join('\n    ')}\n;`);

  for (const a of offers) {
    lines.push(assertWorktopInstruction(a));
  }
  lines.push(
    `CALL_METHOD\n    Address("${takerAccount}")\n    "deposit_batch"\n    Expression("ENTIRE_WORKTOP")\n;`,
  );
  lines.push('YIELD_TO_PARENT;');
  return lines.join('\n');
}

/**
 * Builds the Transaction V2 root manifest that orchestrates both signed
 * Subintents (`maker` + `taker`) atomically.
 *
 * On Stokenet, locks fees from the official Stokenet Faucet (an existing
 * on-ledger vault) as the very first instruction so neither Maker nor Taker
 * spends gas and the transaction commits cleanly in 1 click.
 */
export function buildV2RootOrchestratorManifest(
  makerSubintentHash: string,
  takerSubintentHash: string,
  offer: SwapAssetInput,
  want: SwapAssetInput,
  network: 'mainnet' | 'stokenet' = 'stokenet',
): string {
  if (!makerSubintentHash || !takerSubintentHash || !areValidSwapAssets(offer) || !areValidSwapAssets(want)) {
    return '';
  }
  const offers = normalizeSwapAssets(offer);
  const wants = normalizeSwapAssets(want);

  const lines: string[] = [
    `USE_CHILD\n    NamedIntent("maker")\n    Intent("${makerSubintentHash}")\n;`,
    `USE_CHILD\n    NamedIntent("taker")\n    Intent("${takerSubintentHash}")\n;`,
  ];

  if (network === 'stokenet') {
    lines.push(
      `CALL_METHOD\n    Address("${STOKENET_FAUCET_ADDRESS}")\n    "lock_fee"\n    Decimal("10")\n;`,
    );
  }

  // Phase 1: call Maker to receive all `offer` assets onto root worktop
  lines.push(`YIELD_TO_CHILD\n    NamedIntent("maker")\n;`);
  const makerBuckets: string[] = [];
  offers.forEach((asset, idx) => {
    const bucket = `m_${idx}`;
    lines.push(takeBucketInstruction(asset, bucket));
    makerBuckets.push(`Bucket("${bucket}")`);
  });

  // Phase 2: call Taker to receive all `want` assets onto root worktop
  lines.push(`YIELD_TO_CHILD\n    NamedIntent("taker")\n;`);
  const takerBuckets: string[] = [];
  wants.forEach((asset, idx) => {
    const bucket = `t_${idx}`;
    lines.push(takeBucketInstruction(asset, bucket));
    takerBuckets.push(`Bucket("${bucket}")`);
  });

  // Phase 3: deliver `want` to Maker and `offer` to Taker atomically
  lines.push(`YIELD_TO_CHILD\n    NamedIntent("maker")\n    ${takerBuckets.join('\n    ')}\n;`);
  lines.push(`YIELD_TO_CHILD\n    NamedIntent("taker")\n    ${makerBuckets.join('\n    ')}\n;`);

  return lines.join('\n');
}

/**
 * Builds a V1-previewable manifest for the Maker's side of a Subintent V2 offer
 * so Gateway `/transaction/preview` can validate balance and withdraw permissions
 * without failing on `ASSERT_WORKTOP_CONTAINS` (which only receives the Taker's
 * payment when the Taker embeds and settles the Subintent).
 */
export function buildMakerSubintentPreviewManifest(
  makerAccount: string,
  offer: SwapAssetInput,
): string {
  if (!makerAccount.startsWith('account_') || !areValidSwapAssets(offer)) {
    return '';
  }
  const offers = normalizeSwapAssets(offer);
  return [
    ...offers.map((a) => withdrawInstruction(makerAccount, a)),
    `CALL_METHOD\n    Address("${makerAccount}")\n    "deposit_batch"\n    Expression("ENTIRE_WORKTOP")\n;`,
  ].join('\n');
}

/**
 * Builds the Taker's Transaction V2 settlement manifest that embeds the Maker's
 * signed subintent (`USE_CHILD` + `YIELD_TO_CHILD`).
 */
export function buildTakerV2SettlementManifest(
  takerAccount: string,
  offer: AtomicSwapOffer,
): string {
  if (!takerAccount.startsWith('account_') || !offer.subintentHash) return '';
  const offers = normalizeSwapAssets(offer.offer);
  const wants = normalizeSwapAssets(offer.want);
  const lines: string[] = [
    `USE_CHILD\n    NamedIntent("maker_offer")\n    Subintent("${offer.subintentHash}")\n;`,
    `YIELD_TO_CHILD\n    NamedIntent("maker_offer")\n;`,
  ];

  offers.forEach((asset, idx) => {
    const bucket = offers.length === 1 ? 'maker_asset' : `maker_asset_${idx}`;
    lines.push(assertWorktopInstruction(asset));
    lines.push(takeBucketInstruction(asset, bucket));
    lines.push(
      `CALL_METHOD\n    Address("${takerAccount}")\n    "try_deposit_or_abort"\n    Bucket("${bucket}")\n    Enum<0u8>()\n;`,
    );
  });

  const paymentBuckets: string[] = [];
  wants.forEach((asset, idx) => {
    const bucket = wants.length === 1 ? 'taker_payment' : `taker_payment_${idx}`;
    lines.push(withdrawInstruction(takerAccount, asset));
    lines.push(takeBucketInstruction(asset, bucket));
    paymentBuckets.push(`Bucket("${bucket}")`);
  });

  lines.push(
    `YIELD_TO_CHILD\n    NamedIntent("maker_offer")\n    ${paymentBuckets.join('\n    ')}\n;`,
  );
  lines.push(
    `CALL_METHOD\n    Address("${takerAccount}")\n    "deposit_batch"\n    Expression("ENTIRE_WORKTOP")\n;`,
  );
  return lines.join('\n');
}

/**
 * Builds a single-transaction V1 atomic swap manifest between two accounts
 * (both accounts sign via Radix Wallet; executable directly on Mainnet & Stokenet).
 */
export function buildDirectAtomicSwapManifest(
  makerAccount: string,
  takerAccount: string,
  offer: SwapAssetInput,
  want: SwapAssetInput,
): string {
  if (
    !makerAccount.startsWith('account_')
    || !takerAccount.startsWith('account_')
    || makerAccount === takerAccount
    || !areValidSwapAssets(offer)
    || !areValidSwapAssets(want)
  ) {
    return '';
  }

  const offers = normalizeSwapAssets(offer);
  const wants = normalizeSwapAssets(want);
  const lines: string[] = [];

  const offerBuckets: string[] = [];
  offers.forEach((asset, idx) => {
    const bucket = offers.length === 1 ? 'maker_offer' : `maker_offer_${idx}`;
    lines.push(withdrawInstruction(makerAccount, asset));
    lines.push(takeBucketInstruction(asset, bucket));
    offerBuckets.push(bucket);
  });

  const wantBuckets: string[] = [];
  wants.forEach((asset, idx) => {
    const bucket = wants.length === 1 ? 'taker_payment' : `taker_payment_${idx}`;
    lines.push(withdrawInstruction(takerAccount, asset));
    lines.push(takeBucketInstruction(asset, bucket));
    wantBuckets.push(bucket);
  });

  for (const bucket of offerBuckets) {
    lines.push(
      `CALL_METHOD\n    Address("${takerAccount}")\n    "try_deposit_or_abort"\n    Bucket("${bucket}")\n    Enum<0u8>()\n;`,
    );
  }
  for (const bucket of wantBuckets) {
    lines.push(
      `CALL_METHOD\n    Address("${makerAccount}")\n    "try_deposit_or_abort"\n    Bucket("${bucket}")\n    Enum<0u8>()\n;`,
    );
  }

  return lines.join('\n');
}

/** Encodes a signed offer into a compact URL-safe base64url string. */
export function encodeSwapOffer(offer: AtomicSwapOffer): string {
  const json = JSON.stringify(offer);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decodes and validates a base64url OTC offer string. Returns null if malformed. */
export function decodeSwapOffer(code: string): AtomicSwapOffer | null {
  try {
    const clean = code.trim().replace(/^.*offer=/, '').split('&')[0];
    if (!clean) return null;
    const b64 = clean.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const binary = atob(b64 + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<AtomicSwapOffer>;

    if (
      parsed.v !== 1
      || (parsed.network !== 'mainnet' && parsed.network !== 'stokenet')
      || typeof parsed.makerAccount !== 'string'
      || !parsed.makerAccount.startsWith('account_')
      || typeof parsed.subintentHash !== 'string'
      || typeof parsed.signedPartialTransaction !== 'string'
      || typeof parsed.expirationTimestamp !== 'number'
      || !parsed.offer
      || !parsed.want
      || !areValidSwapAssets(parsed.offer)
      || !areValidSwapAssets(parsed.want)
    ) {
      return null;
    }
    return parsed as AtomicSwapOffer;
  } catch {
    return null;
  }
}
