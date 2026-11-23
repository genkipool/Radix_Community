/**
 * Pure P2P Atomic OTC Swap engine (Subintent V2 + Direct V1).
 * Shared by `AtomicSwapTool` (UI) and `prepare_atomic_swap` (MCP).
 *
 * Zero Redis commands, zero third-party contracts: relies solely on native
 * Radix Engine worktop assertions and Subintents (Pre-authorizations).
 * Supports single or multiple resources and single or multiple accounts on both sides.
 */

import Big from 'big.js';

export type SwapAsset =
  | { kind: 'fungible'; resourceAddress: string; amount: string }
  | { kind: 'nft'; resourceAddress: string; ids: string[] };

export type SwapAssetInput = SwapAsset | SwapAsset[];

export type PerAccountHoldingsMap = Record<
  string,
  {
    fungibles: Array<{ resourceAddress: string; amount: string }>;
    nonFungibles: Array<{ resourceAddress: string; ids: string[] }>;
  }
>;

export interface AtomicSwapOffer {
  v: 1;
  network: 'mainnet' | 'stokenet';
  makerAccount: string;
  /** All Maker accounts participating in a multi-account pre-authorization (primary first). */
  makerAccounts?: string[];
  offer: SwapAssetInput;
  want: SwapAssetInput;
  subintentHash: string;
  signedPartialTransaction: string;
  expirationTimestamp: number;
  /** Optional note attached by the Maker and shown when inspecting the offer. */
  message?: string;
}

/** Returns all unique Maker accounts for an offer, with the primary `makerAccount` first. */
export function getOfferMakerAccounts(
  offer: Pick<AtomicSwapOffer, 'makerAccount' | 'makerAccounts'>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const addr of [offer.makerAccount, ...(offer.makerAccounts ?? [])]) {
    const trimmed = addr?.trim();
    if (!trimmed || !trimmed.startsWith('account_')) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
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

/** Minimum custom Subintent V2 expiration: 1 minute (60 seconds). */
export const MIN_EXPIRATION_MINUTES = 1;
/**
 * Maximum custom Subintent V2 expiration: 43,200 minutes (30 days = 8,640 5-min epochs,
 * matching Radix Cuttlefish `TransactionValidationConfig::max_epoch_range`).
 */
export const MAX_EXPIRATION_MINUTES = 43_200;

/** Sanitizes and clamps a custom minutes input string to `1..43200` integer minutes. */
export function clampCustomExpirationMinutes(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10);
  if (!Number.isFinite(num) || num <= 0) return '';
  return String(Math.min(MAX_EXPIRATION_MINUTES, num));
}

export const STOKENET_FAUCET_ADDRESS =
  'component_tdx_2_1cptxxxxxxxxxfaucetxxxxxxxxx000527798379xxxxxxxxxyulkzl';

export function normalizeSwapAssets(input: SwapAssetInput): SwapAsset[] {
  return Array.isArray(input) ? input : [input];
}

function normalizeAccounts(input: string | string[]): string[] {
  const list = Array.isArray(input) ? input : [input];
  return list.map((a) => a.trim()).filter((a) => a.startsWith('account_'));
}

function withdrawInstruction(account: string, asset: SwapAsset): string {
  if (asset.kind === 'fungible') {
    return `CALL_METHOD\n    Address("${account}")\n    "withdraw"\n    Address("${asset.resourceAddress}")\n    Decimal("${asset.amount}")\n;`;
  }
  const idsList = asset.ids.map((id) => `NonFungibleLocalId("${id}")`).join(', ');
  return `CALL_METHOD\n    Address("${account}")\n    "withdraw_non_fungibles"\n    Address("${asset.resourceAddress}")\n    Array<NonFungibleLocalId>(${idsList})\n;`;
}

/**
 * Generates one or more `withdraw` / `withdraw_non_fungibles` instructions across
 * multiple selected accounts based on each account's actual holdings (`byAccount`).
 * All withdrawn tokens/NFTs land on the worktop and are then gathered into the target bucket.
 */
function withdrawAcrossAccountsInstructions(
  accounts: string[],
  asset: SwapAsset,
  byAccount?: PerAccountHoldingsMap,
): string[] {
  if (accounts.length <= 1 || !byAccount) {
    return [withdrawInstruction(accounts[0], asset)];
  }

  if (asset.kind === 'fungible') {
    let remaining: Big;
    try {
      remaining = new Big(asset.amount);
    } catch {
      return [withdrawInstruction(accounts[0], asset)];
    }
    const instructions: string[] = [];
    for (const acct of accounts) {
      if (remaining.lte(0)) break;
      const heldStr = byAccount[acct]?.fungibles.find((f) => f.resourceAddress === asset.resourceAddress)?.amount;
      if (!heldStr) continue;
      let held: Big;
      try {
        held = new Big(heldStr);
      } catch {
        continue;
      }
      if (held.lte(0)) continue;
      const take = held.gte(remaining) ? remaining : held;
      instructions.push(
        withdrawInstruction(acct, {
          kind: 'fungible',
          resourceAddress: asset.resourceAddress,
          amount: take.toFixed(),
        }),
      );
      remaining = remaining.minus(take);
    }
    if (remaining.gt(0)) {
      instructions.push(
        withdrawInstruction(accounts[0], {
          kind: 'fungible',
          resourceAddress: asset.resourceAddress,
          amount: remaining.toFixed(),
        }),
      );
    }
    return instructions.length > 0 ? instructions : [withdrawInstruction(accounts[0], asset)];
  }

  const remainingIds = new Set(asset.ids);
  const instructions: string[] = [];
  for (const acct of accounts) {
    if (remainingIds.size === 0) break;
    const heldIds = new Set(
      byAccount[acct]?.nonFungibles.find((nf) => nf.resourceAddress === asset.resourceAddress)?.ids ?? [],
    );
    const takeIds = asset.ids.filter((id) => remainingIds.has(id) && heldIds.has(id));
    if (takeIds.length > 0) {
      instructions.push(
        withdrawInstruction(acct, {
          kind: 'nft',
          resourceAddress: asset.resourceAddress,
          ids: takeIds,
        }),
      );
      takeIds.forEach((id) => remainingIds.delete(id));
    }
  }
  if (remainingIds.size > 0) {
    instructions.push(
      withdrawInstruction(accounts[0], {
        kind: 'nft',
        resourceAddress: asset.resourceAddress,
        ids: [...remainingIds],
      }),
    );
  }
  return instructions.length > 0 ? instructions : [withdrawInstruction(accounts[0], asset)];
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
 * 1. Withdraws all Maker offered assets (across one or more selected Maker accounts),
 *    takes them into buckets, and explicitly yields those buckets to the parent.
 * 2. When resumed by the parent, asserts every wanted asset is on worktop.
 * 3. Deposits the wanted assets into Maker's primary account and yields cleanly.
 */
export function buildMakerSubintentManifest(
  makerAccount: string | string[],
  offer: SwapAssetInput,
  want: SwapAssetInput,
  byAccount?: PerAccountHoldingsMap,
): string {
  const makerAccounts = normalizeAccounts(makerAccount);
  if (makerAccounts.length === 0 || !areValidSwapAssets(offer) || !areValidSwapAssets(want)) {
    return '';
  }
  const primaryMaker = makerAccounts[0];
  const offers = normalizeSwapAssets(offer);
  const wants = normalizeSwapAssets(want);
  const lines: string[] = [];
  const offerBuckets: string[] = [];

  offers.forEach((asset, idx) => {
    const bucket = `offer_${idx}`;
    lines.push(...withdrawAcrossAccountsInstructions(makerAccounts, asset, byAccount));
    lines.push(takeBucketInstruction(asset, bucket));
    offerBuckets.push(`Bucket("${bucket}")`);
  });

  lines.push(`YIELD_TO_PARENT\n    ${offerBuckets.join('\n    ')}\n;`);
  for (const a of wants) {
    lines.push(assertWorktopInstruction(a));
  }
  lines.push(
    `CALL_METHOD\n    Address("${primaryMaker}")\n    "deposit_batch"\n    Expression("ENTIRE_WORKTOP")\n;`,
  );
  lines.push('YIELD_TO_PARENT;');
  return lines.join('\n');
}

/**
 * Builds the Taker's Subintent manifest for 1-click V2 settlement:
 * 1. Withdraws all `want` assets (across one or more selected Taker accounts),
 *    puts them into buckets, and explicitly yields them to the root orchestrator.
 * 2. When resumed, asserts Maker's `offer` assets arrived, deposits them into
 *    Taker's primary account, and yields cleanly.
 */
export function buildTakerSubintentManifest(
  takerAccount: string | string[],
  want: SwapAssetInput,
  offer: SwapAssetInput,
  byAccount?: PerAccountHoldingsMap,
): string {
  const takerAccounts = normalizeAccounts(takerAccount);
  if (takerAccounts.length === 0 || !areValidSwapAssets(want) || !areValidSwapAssets(offer)) {
    return '';
  }
  const primaryTaker = takerAccounts[0];
  const wants = normalizeSwapAssets(want);
  const offers = normalizeSwapAssets(offer);
  const lines: string[] = [];
  const wantBuckets: string[] = [];

  wants.forEach((asset, idx) => {
    const bucket = `want_${idx}`;
    lines.push(...withdrawAcrossAccountsInstructions(takerAccounts, asset, byAccount));
    lines.push(takeBucketInstruction(asset, bucket));
    wantBuckets.push(`Bucket("${bucket}")`);
  });

  lines.push(`YIELD_TO_PARENT\n    ${wantBuckets.join('\n    ')}\n;`);

  for (const a of offers) {
    lines.push(assertWorktopInstruction(a));
  }
  lines.push(
    `CALL_METHOD\n    Address("${primaryTaker}")\n    "deposit_batch"\n    Expression("ENTIRE_WORKTOP")\n;`,
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
  makerAccount: string | string[],
  offer: SwapAssetInput,
  byAccount?: PerAccountHoldingsMap,
): string {
  const makerAccounts = normalizeAccounts(makerAccount);
  if (makerAccounts.length === 0 || !areValidSwapAssets(offer)) {
    return '';
  }
  const primaryMaker = makerAccounts[0];
  const offers = normalizeSwapAssets(offer);
  return [
    ...offers.flatMap((a) => withdrawAcrossAccountsInstructions(makerAccounts, a, byAccount)),
    `CALL_METHOD\n    Address("${primaryMaker}")\n    "deposit_batch"\n    Expression("ENTIRE_WORKTOP")\n;`,
  ].join('\n');
}

/**
 * Builds a standard V1 manifest that moves the offered assets out of the Maker's
 * account(s) to another account they own, making a previously shared Subintent
 * unexecutable (InsufficientBalance) until its expiration window passes.
 */
export function buildCancelSwapMoveManifest(
  makerAccount: string | string[],
  destinationAccount: string,
  offer: SwapAssetInput,
  byAccount?: PerAccountHoldingsMap,
): string {
  const makerAccounts = normalizeAccounts(makerAccount);
  if (
    makerAccounts.length === 0
    || !destinationAccount.startsWith('account_')
    || (makerAccounts.length === 1 && makerAccounts[0] === destinationAccount)
    || !areValidSwapAssets(offer)
  ) {
    return '';
  }
  const offers = normalizeSwapAssets(offer);
  return [
    ...offers.flatMap((a) => withdrawAcrossAccountsInstructions(makerAccounts, a, byAccount)),
    `CALL_METHOD\n    Address("${destinationAccount}")\n    "try_deposit_batch_or_abort"\n    Expression("ENTIRE_WORKTOP")\n    Enum<0u8>()\n;`,
  ].join('\n');
}

/**
 * Builds the Taker's Transaction V2 settlement manifest that embeds the Maker's
 * signed subintent (`USE_CHILD` + `YIELD_TO_CHILD`).
 */
export function buildTakerV2SettlementManifest(
  takerAccount: string | string[],
  offer: AtomicSwapOffer,
  byAccount?: PerAccountHoldingsMap,
): string {
  const takerAccounts = normalizeAccounts(takerAccount);
  if (takerAccounts.length === 0 || !offer.subintentHash) return '';
  const primaryTaker = takerAccounts[0];
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
      `CALL_METHOD\n    Address("${primaryTaker}")\n    "try_deposit_or_abort"\n    Bucket("${bucket}")\n    Enum<0u8>()\n;`,
    );
  });

  const paymentBuckets: string[] = [];
  wants.forEach((asset, idx) => {
    const bucket = wants.length === 1 ? 'taker_payment' : `taker_payment_${idx}`;
    lines.push(...withdrawAcrossAccountsInstructions(takerAccounts, asset, byAccount));
    lines.push(takeBucketInstruction(asset, bucket));
    paymentBuckets.push(`Bucket("${bucket}")`);
  });

  lines.push(
    `YIELD_TO_CHILD\n    NamedIntent("maker_offer")\n    ${paymentBuckets.join('\n    ')}\n;`,
  );
  lines.push(
    `CALL_METHOD\n    Address("${primaryTaker}")\n    "deposit_batch"\n    Expression("ENTIRE_WORKTOP")\n;`,
  );
  return lines.join('\n');
}

/**
 * Builds a single-transaction V1 atomic swap manifest between accounts
 * (all participating accounts sign via Radix Wallet; executable directly on Mainnet & Stokenet).
 */
export function buildDirectAtomicSwapManifest(
  makerAccount: string | string[],
  takerAccount: string | string[],
  offer: SwapAssetInput,
  want: SwapAssetInput,
  byAccount?: PerAccountHoldingsMap,
): string {
  const makerAccounts = normalizeAccounts(makerAccount);
  const takerAccounts = normalizeAccounts(takerAccount);
  if (
    makerAccounts.length === 0
    || takerAccounts.length === 0
    || (makerAccounts.length === 1 && takerAccounts.length === 1 && makerAccounts[0] === takerAccounts[0])
    || !areValidSwapAssets(offer)
    || !areValidSwapAssets(want)
  ) {
    return '';
  }

  const primaryMaker = makerAccounts[0];
  const primaryTaker = takerAccounts[0];
  const offers = normalizeSwapAssets(offer);
  const wants = normalizeSwapAssets(want);
  const lines: string[] = [];

  const offerBuckets: string[] = [];
  offers.forEach((asset, idx) => {
    const bucket = offers.length === 1 ? 'maker_offer' : `maker_offer_${idx}`;
    lines.push(...withdrawAcrossAccountsInstructions(makerAccounts, asset, byAccount));
    lines.push(takeBucketInstruction(asset, bucket));
    offerBuckets.push(bucket);
  });

  const wantBuckets: string[] = [];
  wants.forEach((asset, idx) => {
    const bucket = wants.length === 1 ? 'taker_payment' : `taker_payment_${idx}`;
    lines.push(...withdrawAcrossAccountsInstructions(takerAccounts, asset, byAccount));
    lines.push(takeBucketInstruction(asset, bucket));
    wantBuckets.push(bucket);
  });

  for (const bucket of offerBuckets) {
    lines.push(
      `CALL_METHOD\n    Address("${primaryTaker}")\n    "try_deposit_or_abort"\n    Bucket("${bucket}")\n    Enum<0u8>()\n;`,
    );
  }
  for (const bucket of wantBuckets) {
    lines.push(
      `CALL_METHOD\n    Address("${primaryMaker}")\n    "try_deposit_or_abort"\n    Bucket("${bucket}")\n    Enum<0u8>()\n;`,
    );
  }

  return lines.join('\n');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

type CompactAsset = ['f', string, string] | ['n', string, string[]];
const packAsset = (a: SwapAsset): CompactAsset =>
  a.kind === 'fungible' ? ['f', a.resourceAddress, a.amount] : ['n', a.resourceAddress, a.ids];
const unpackAsset = (c: CompactAsset): SwapAsset =>
  c[0] === 'f'
    ? { kind: 'fungible', resourceAddress: c[1], amount: c[2] }
    : { kind: 'nft', resourceAddress: c[1], ids: c[2] };

/**
 * Encodes a signed offer into a compact URL-safe base64url string (v2 binary
 * framing: compact JSON header + raw signedPartialTransaction bytes — ~45-55%
 * shorter than JSON+hex so QR codes scan cleanly).
 */
export function encodeSwapOffer(offer: AtomicSwapOffer): string {
  const offers = normalizeSwapAssets(offer.offer).map(packAsset);
  const wants = normalizeSwapAssets(offer.want).map(packAsset);
  const makerList = getOfferMakerAccounts(offer);
  const encodedMaker = makerList.length > 1 ? makerList : offer.makerAccount;
  const metaTuple = [
    offer.network === 'stokenet' ? 's' : 'm',
    encodedMaker,
    offers.length === 1 ? offers[0] : offers,
    wants.length === 1 ? wants[0] : wants,
    offer.subintentHash,
    offer.expirationTimestamp,
    ...(offer.message ? [offer.message] : []),
  ];
  const metaBytes = new TextEncoder().encode(JSON.stringify(metaTuple));
  const txBytes = hexToBytes(offer.signedPartialTransaction);
  const packed = new Uint8Array(3 + metaBytes.length + txBytes.length);
  packed[0] = 0x02;
  packed[1] = (metaBytes.length >> 8) & 0xff;
  packed[2] = metaBytes.length & 0xff;
  packed.set(metaBytes, 3);
  packed.set(txBytes, 3 + metaBytes.length);

  let binary = '';
  for (let i = 0; i < packed.length; i++) binary += String.fromCharCode(packed[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decodes and validates a base64url OTC offer string (supports both compact v2 and legacy v1). */
export function decodeSwapOffer(code: string): AtomicSwapOffer | null {
  try {
    const clean = code.trim().replace(/^.*offer=/, '').split('&')[0];
    if (!clean) return null;
    const b64 = clean.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const binary = atob(b64 + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    // Compact v2 binary format (header byte 0x02)
    if (bytes.length > 3 && bytes[0] === 0x02) {
      const metaLen = (bytes[1] << 8) | bytes[2];
      if (3 + metaLen >= bytes.length) return null;
      const metaTuple = JSON.parse(new TextDecoder().decode(bytes.subarray(3, 3 + metaLen))) as unknown[];
      if (!Array.isArray(metaTuple) || metaTuple.length < 6) return null;
      const [net, rawMaker, rawOffer, rawWant, subintentHash, expirationTimestamp, rawMessage] = metaTuple;
      const makerAccountsList =
        typeof rawMaker === 'string' && rawMaker.startsWith('account_')
          ? [rawMaker]
          : Array.isArray(rawMaker)
              && rawMaker.length > 0
              && rawMaker.every((a): a is string => typeof a === 'string' && a.startsWith('account_'))
            ? rawMaker
            : null;
      const unpackField = (val: unknown): SwapAssetInput | null => {
        if (!Array.isArray(val) || val.length === 0) return null;
        if (val[0] === 'f' || val[0] === 'n') return unpackAsset(val as CompactAsset);
        return (val as CompactAsset[]).map(unpackAsset);
      };
      const offer = unpackField(rawOffer);
      const want = unpackField(rawWant);
      if (
        (net !== 'm' && net !== 's')
        || !makerAccountsList
        || typeof subintentHash !== 'string'
        || typeof expirationTimestamp !== 'number'
        || !offer
        || !want
        || !areValidSwapAssets(offer)
        || !areValidSwapAssets(want)
      ) {
        return null;
      }
      return {
        v: 1,
        network: net === 's' ? 'stokenet' : 'mainnet',
        makerAccount: makerAccountsList[0],
        ...(makerAccountsList.length > 1 ? { makerAccounts: makerAccountsList } : {}),
        offer,
        want,
        subintentHash,
        signedPartialTransaction: bytesToHex(bytes.subarray(3 + metaLen)),
        expirationTimestamp,
        ...(typeof rawMessage === 'string' && rawMessage ? { message: rawMessage } : {}),
      };
    }

    // Legacy v1 JSON format
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

/**
 * Parses a raw `subtxid_...` input and detects its network (`mainnet` vs `stokenet`).
 */
export function parseSubintentIdInput(input: string): {
  subintentHash: string;
  network: 'mainnet' | 'stokenet';
} | null {
  const trimmed = input.trim();
  const match = trimmed.match(/^(subtxid_(rdx1|tdx_2_1)[a-z0-9]+)$/i);
  if (!match) return null;
  const subintentHash = match[1].toLowerCase();
  const network = subintentHash.startsWith('subtxid_tdx_2_') ? 'stokenet' : 'mainnet';
  return { subintentHash, network };
}

export interface CommittedSwapTransaction {
  intent_hash?: string;
  confirmed_at?: string;
  manifest_instructions?: string;
  affected_global_entities?: string[];
  balance_changes?: {
    fungible_balance_changes?: Array<{
      entity_address: string;
      resource_address: string;
      balance_change: string;
    }>;
    non_fungible_balance_changes?: Array<{
      entity_address: string;
      resource_address: string;
      added?: string[];
      removed?: string[];
    }>;
  };
}

/**
 * Extracts all unique Taker account addresses (`account_...` not in `makerAccounts`)
 * from a committed V2 atomic swap transaction's balance changes or affected entities.
 */
export function extractTakerAccountsFromCommittedTx(
  makerAccounts: string | string[],
  tx: CommittedSwapTransaction | null | undefined,
): string[] {
  if (!tx) return [];
  const makerSet = new Set(
    (Array.isArray(makerAccounts) ? makerAccounts : [makerAccounts])
      .filter(Boolean)
      .map((a) => a.toLowerCase()),
  );
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (addr: string) => {
    if (!addr.startsWith('account_')) return;
    const key = addr.toLowerCase();
    if (makerSet.has(key) || seen.has(key)) return;
    seen.add(key);
    out.push(addr);
  };
  for (const c of tx.balance_changes?.fungible_balance_changes ?? []) push(c.entity_address);
  for (const c of tx.balance_changes?.non_fungible_balance_changes ?? []) push(c.entity_address);
  for (const addr of tx.affected_global_entities ?? []) push(addr);
  return out;
}

/**
 * Extracts the primary Taker account address (`account_... !== makerAccount`) from a
 * committed V2 atomic swap transaction's balance changes or affected entities.
 */
export function extractTakerAccountFromCommittedTx(
  makerAccount: string | string[],
  tx: CommittedSwapTransaction | null | undefined,
): string | null {
  return extractTakerAccountsFromCommittedTx(makerAccount, tx)[0] ?? null;
}

/**
 * Reconstructs an `AtomicSwapOffer` summary from an on-ledger committed V2 transaction
 * (via `/transaction/committed-details`) when the user only has a raw `subtxid_...` hash.
 */
export function reconstructOfferFromCommittedTx(
  subintentHash: string,
  network: 'mainnet' | 'stokenet',
  tx: CommittedSwapTransaction,
): AtomicSwapOffer | null {
  const offerAssets: SwapAsset[] = [];
  const wantAssets: SwapAsset[] = [];
  const manifest = tx.manifest_instructions ?? '';

  if (manifest) {
    const fungibleRe =
      /TAKE_FROM_WORKTOP\s+Address\("(resource_[^"]+)"\)\s+Decimal\("([^"]+)"\)\s+Bucket\("([^"]+)"\)/g;
    for (const m of manifest.matchAll(fungibleRe)) {
      const [, resourceAddress, amount, bucket] = m;
      const asset: SwapAsset = { kind: 'fungible', resourceAddress, amount };
      if (bucket.startsWith('m_') || bucket.startsWith('maker_asset') || bucket.startsWith('offer_')) {
        offerAssets.push(asset);
      } else if (bucket.startsWith('t_') || bucket.startsWith('taker_payment') || bucket.startsWith('want_')) {
        wantAssets.push(asset);
      }
    }

    const nftRe =
      /TAKE_NON_FUNGIBLES_FROM_WORKTOP\s+Address\("(resource_[^"]+)"\)\s+Array<NonFungibleLocalId>\(([\s\S]*?)\)\s+Bucket\("([^"]+)"\)/g;
    for (const m of manifest.matchAll(nftRe)) {
      const [, resourceAddress, rawIds, bucket] = m;
      const ids = Array.from(rawIds.matchAll(/NonFungibleLocalId\("([^"]+)"\)/g), (x) => x[1]);
      if (ids.length === 0) continue;
      const asset: SwapAsset = { kind: 'nft', resourceAddress, ids };
      if (bucket.startsWith('m_') || bucket.startsWith('maker_asset') || bucket.startsWith('offer_')) {
        offerAssets.push(asset);
      } else if (bucket.startsWith('t_') || bucket.startsWith('taker_payment') || bucket.startsWith('want_')) {
        wantAssets.push(asset);
      }
    }
  }

  const fungibleChanges = tx.balance_changes?.fungible_balance_changes ?? [];
  const nftChanges = tx.balance_changes?.non_fungible_balance_changes ?? [];

  let makerAccount = '';
  if (offerAssets.length > 0) {
    const firstOffer = offerAssets[0];
    if (firstOffer.kind === 'fungible') {
      makerAccount =
        fungibleChanges.find(
          (c) =>
            c.entity_address.startsWith('account_')
            && c.resource_address === firstOffer.resourceAddress
            && c.balance_change.startsWith('-'),
        )?.entity_address ?? '';
    } else {
      makerAccount =
        nftChanges.find(
          (c) =>
            c.entity_address.startsWith('account_')
            && c.resource_address === firstOffer.resourceAddress
            && (c.removed?.length ?? 0) > 0,
        )?.entity_address ?? '';
    }
  }

  if (!makerAccount) {
    makerAccount =
      fungibleChanges.find((c) => c.entity_address.startsWith('account_') && c.balance_change.startsWith('-'))
        ?.entity_address
      ?? nftChanges.find((c) => c.entity_address.startsWith('account_') && (c.removed?.length ?? 0) > 0)
        ?.entity_address
      ?? '';
  }

  if (makerAccount && (offerAssets.length === 0 || wantAssets.length === 0)) {
    offerAssets.length = 0;
    wantAssets.length = 0;
    for (const c of fungibleChanges) {
      if (c.entity_address !== makerAccount) continue;
      if (c.balance_change.startsWith('-')) {
        offerAssets.push({
          kind: 'fungible',
          resourceAddress: c.resource_address,
          amount: c.balance_change.slice(1),
        });
      } else if (parseFloat(c.balance_change) > 0) {
        wantAssets.push({
          kind: 'fungible',
          resourceAddress: c.resource_address,
          amount: c.balance_change,
        });
      }
    }
    for (const c of nftChanges) {
      if (c.entity_address !== makerAccount) continue;
      if (c.removed && c.removed.length > 0) {
        offerAssets.push({ kind: 'nft', resourceAddress: c.resource_address, ids: c.removed });
      }
      if (c.added && c.added.length > 0) {
        wantAssets.push({ kind: 'nft', resourceAddress: c.resource_address, ids: c.added });
      }
    }
  }

  if (!makerAccount) {
    const acctMatch = manifest.match(/Address\("(account_[^"]+)"\)/);
    if (acctMatch) makerAccount = acctMatch[1];
  }

  if (!makerAccount.startsWith('account_') || offerAssets.length === 0 || wantAssets.length === 0) {
    return null;
  }

  const makerAccountsSet = new Set<string>();
  const addMaker = (addr: string | undefined) => {
    if (addr && addr.startsWith('account_')) makerAccountsSet.add(addr);
  };
  addMaker(makerAccount);
  if (offerAssets.length > 0) {
    const offerResourceSet = new Set(offerAssets.map((a) => a.resourceAddress));
    for (const c of fungibleChanges) {
      if (offerResourceSet.has(c.resource_address) && c.balance_change.startsWith('-')) {
        addMaker(c.entity_address);
      }
    }
    for (const c of nftChanges) {
      if (offerResourceSet.has(c.resource_address) && (c.removed?.length ?? 0) > 0) {
        addMaker(c.entity_address);
      }
    }
  }
  const makerAccountsList = [...makerAccountsSet];

  const confirmedEpochSec = tx.confirmed_at ? Math.floor(new Date(tx.confirmed_at).getTime() / 1000) : 0;

  return {
    v: 1,
    network,
    makerAccount,
    ...(makerAccountsList.length > 1 ? { makerAccounts: makerAccountsList } : {}),
    offer: offerAssets.length === 1 ? offerAssets[0] : offerAssets,
    want: wantAssets.length === 1 ? wantAssets[0] : wantAssets,
    subintentHash,
    signedPartialTransaction: '',
    expirationTimestamp: Number.isFinite(confirmedEpochSec) && confirmedEpochSec > 0
      ? confirmedEpochSec
      : Math.floor(Date.now() / 1000),
  };
}

/* ─── Local history of signed Subintent V2 offers (0 backend / 0 Redis) ─── */

export interface SavedSwapOffer {
  code: string;
  offer: AtomicSwapOffer;
  createdAt: number;
}

const SAVED_OFFERS_KEY = 'radix-community:otc-offers:v1';
const MAX_SAVED_OFFERS = 30;
const EMPTY_OFFERS: SavedSwapOffer[] = [];
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedParsed: SavedSwapOffer[] = EMPTY_OFFERS;

function notifySavedOffers(): void {
  listeners.forEach((fn) => fn());
}

export function subscribeSavedSwapOffers(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window === 'undefined') return () => { listeners.delete(listener); };
  const onStorage = (e: StorageEvent) => {
    if (e.key === SAVED_OFFERS_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function getSavedSwapOffersSnapshot(): SavedSwapOffer[] {
  if (typeof window === 'undefined') return EMPTY_OFFERS;
  try {
    const raw = window.localStorage.getItem(SAVED_OFFERS_KEY);
    if (raw === cachedRaw) return cachedParsed;
    cachedRaw = raw;
    if (!raw) {
      cachedParsed = EMPTY_OFFERS;
      return cachedParsed;
    }
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) {
      cachedParsed = EMPTY_OFFERS;
      return cachedParsed;
    }
    cachedParsed = list.filter(
      (entry): entry is SavedSwapOffer =>
        !!entry
        && typeof entry === 'object'
        && typeof (entry as SavedSwapOffer).code === 'string'
        && typeof (entry as SavedSwapOffer).createdAt === 'number'
        && !!decodeSwapOffer((entry as SavedSwapOffer).code),
    );
    return cachedParsed;
  } catch {
    return EMPTY_OFFERS;
  }
}

export function getSavedSwapOffersServerSnapshot(): SavedSwapOffer[] {
  return EMPTY_OFFERS;
}

export function saveSignedSwapOffer(offer: AtomicSwapOffer): void {
  if (typeof window === 'undefined') return;
  const code = encodeSwapOffer(offer);
  const current = getSavedSwapOffersSnapshot().filter(
    (entry) => entry.offer.subintentHash !== offer.subintentHash,
  );
  const next: SavedSwapOffer[] = [{ code, offer, createdAt: Date.now() }, ...current].slice(0, MAX_SAVED_OFFERS);
  try {
    const raw = JSON.stringify(next);
    window.localStorage.setItem(SAVED_OFFERS_KEY, raw);
    cachedRaw = raw;
    cachedParsed = next;
    notifySavedOffers();
  } catch {
    // Ignore storage quota errors
  }
}

export function removeSavedSwapOffer(subintentHash: string): void {
  if (typeof window === 'undefined') return;
  const next = getSavedSwapOffersSnapshot().filter((entry) => entry.offer.subintentHash !== subintentHash);
  try {
    const raw = JSON.stringify(next);
    window.localStorage.setItem(SAVED_OFFERS_KEY, raw);
    cachedRaw = raw;
    cachedParsed = next;
    notifySavedOffers();
  } catch {
    // Ignore storage errors
  }
}
