/**
 * Client-side Radix Transaction V2 settler powered by `/wasm/radix_v2_settler.wasm`
 * (compiled from official `radix-transactions` Rust crate).
 *
 * Combines two signed Subintents (`maker` + `taker`), notarizes with an ephemeral
 * browser Ed25519 key (`notary_is_signatory: false`), submits directly to the
 * Radix Gateway `/transaction/submit`, and polls `/transaction/status` until
 * `CommittedSuccess`. Zero backend, zero Redis.
 */

import { gatewayPost } from '@/services/gateway/bases';
import type { Network } from '@/services/gateway/client';
import { buildV2RootOrchestratorManifest, type SwapAssetInput } from './atomic-swap';

interface SettlerWasmExports {
  memory: WebAssembly.Memory;
  wasm_alloc: (len: number) => number;
  wasm_dealloc: (ptr: number, len: number) => void;
  settle_v2_swap: (ptr: number, len: number) => bigint;
}

let cachedExports: Promise<SettlerWasmExports> | null = null;

function loadSettlerWasm(): Promise<SettlerWasmExports> {
  if (!cachedExports) {
    cachedExports = (async () => {
      const response = await fetch('/wasm/radix_v2_settler.wasm');
      if (!response.ok) throw new Error('v2_wasm_load_failed');
      const bytes = await response.arrayBuffer();
      const { instance } = await WebAssembly.instantiate(bytes, {});
      return instance.exports as unknown as SettlerWasmExports;
    })();
  }
  return cachedExports;
}

function randomSeedHex(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface SettleAtomicSwapV2Params {
  network: Network;
  makerSubintentHash: string;
  makerSignedPartialTxHex: string;
  takerSubintentHash: string;
  takerSignedPartialTxHex: string;
  offer: SwapAssetInput;
  want: SwapAssetInput;
}

export interface SettleAtomicSwapV2Result {
  transactionIntentHash: string;
  status: string;
}

export async function settleAtomicSwapV2(
  params: SettleAtomicSwapV2Params,
): Promise<SettleAtomicSwapV2Result> {
  const {
    network,
    makerSubintentHash,
    makerSignedPartialTxHex,
    takerSubintentHash,
    takerSignedPartialTxHex,
    offer,
    want,
  } = params;

  const rootManifest = buildV2RootOrchestratorManifest(
    makerSubintentHash,
    takerSubintentHash,
    offer,
    want,
    network,
  );
  if (!rootManifest) throw new Error('v2_invalid_assets');

  // 1. Fetch current ledger epoch from Gateway
  const statusRes = await gatewayPost<{ ledger_state?: { epoch?: number } }>(
    network,
    '/status/gateway-status',
    {},
  );
  const currentEpoch = statusRes.ledger_state?.epoch;
  if (typeof currentEpoch !== 'number') {
    throw new Error('v2_epoch_fetch_failed');
  }

  // 2. Compile & notarize NotarizedTransactionV2 inside browser WASM
  const wasm = await loadSettlerWasm();
  const payload = JSON.stringify({
    network_id: network === 'mainnet' ? 1 : 2,
    current_epoch: currentEpoch,
    maker_signed_partial_tx_hex: makerSignedPartialTxHex,
    taker_signed_partial_tx_hex: takerSignedPartialTxHex,
    root_manifest: rootManifest,
    random_seed_hex: randomSeedHex(),
  });

  const encoded = new TextEncoder().encode(payload);
  const inPtr = wasm.wasm_alloc(encoded.length);
  new Uint8Array(wasm.memory.buffer, inPtr, encoded.length).set(encoded);
  const packed = wasm.settle_v2_swap(inPtr, encoded.length);
  wasm.wasm_dealloc(inPtr, encoded.length);

  const outPtr = Number(packed >> BigInt(32));
  const outLen = Number(packed & BigInt(0xffffffff));
  const outJson = new TextDecoder().decode(new Uint8Array(wasm.memory.buffer, outPtr, outLen));
  wasm.wasm_dealloc(outPtr, outLen);

  const parsed = JSON.parse(outJson) as {
    ok: boolean;
    notarized_transaction_hex?: string;
    intent_hash?: string;
    error?: string;
  };
  if (!parsed.ok || !parsed.notarized_transaction_hex || !parsed.intent_hash) {
    throw new Error('v2_compile_failed');
  }

  // 3. Submit directly to Gateway /transaction/submit
  await gatewayPost(network, '/transaction/submit', {
    notarized_transaction_hex: parsed.notarized_transaction_hex,
  });

  // 4. Poll Gateway /transaction/status until committed (max ~30s)
  const intentHash = parsed.intent_hash;
  for (let attempt = 0; attempt < 18; attempt++) {
    await new Promise((r) => setTimeout(r, attempt === 0 ? 1200 : 1800));
    const txStatus = await gatewayPost<{
      status?: string;
      intent_status?: string;
      error_message?: string;
    }>(
      network,
      '/transaction/status',
      { intent_hash: intentHash },
    );
    const status = txStatus.status ?? '';
    if (status === 'CommittedSuccess') {
      return { transactionIntentHash: intentHash, status };
    }
    if (
      status === 'CommittedFailure'
      || status === 'Rejected'
      || txStatus.intent_status === 'LikelyButNotCertainRejection'
      || txStatus.error_message
    ) {
      throw new Error(txStatus.error_message || txStatus.intent_status || status);
    }
  }

  throw new Error('Pending');
}
