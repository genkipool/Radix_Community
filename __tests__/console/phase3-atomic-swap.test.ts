import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildDirectAtomicSwapManifest,
  buildMakerSubintentManifest,
  buildTakerV2SettlementManifest,
  buildV2RootOrchestratorManifest,
  decodeSwapOffer,
  encodeSwapOffer,
  type AtomicSwapOffer,
  type SwapAsset,
} from '@/features/console/lib/atomic-swap';

const MAKER = 'account_tdx_2_1makerxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const TAKER = 'account_tdx_2_1takerxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const XRD = 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc';
const NFT = 'resource_tdx_2_1nftxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

describe('atomic-swap pure engine', () => {
  const offerNft: SwapAsset = { kind: 'nft', resourceAddress: NFT, ids: ['#1#', '#2#'] };
  const wantXrd: SwapAsset = { kind: 'fungible', resourceAddress: XRD, amount: '500' };

  it('builds a valid Maker Subintent manifest with worktop assertion and YIELD_TO_PARENT', () => {
    const manifest = buildMakerSubintentManifest(MAKER, offerNft, wantXrd);
    expect(manifest).toContain('withdraw_non_fungibles');
    expect(manifest).toContain('ASSERT_WORKTOP_CONTAINS');
    expect(manifest).toContain('Decimal("500")');
    expect(manifest.trim().endsWith('YIELD_TO_PARENT;')).toBe(true);
  });

  it('builds a valid Direct V1 atomic swap manifest between two distinct accounts', () => {
    const manifest = buildDirectAtomicSwapManifest(MAKER, TAKER, offerNft, wantXrd);
    expect(manifest).toContain(MAKER);
    expect(manifest).toContain(TAKER);
    expect(manifest).toContain('Bucket("maker_offer")');
    expect(manifest).toContain('Bucket("taker_payment")');
    expect(buildDirectAtomicSwapManifest(MAKER, MAKER, offerNft, wantXrd)).toBe('');
  });

  it('encodes and decodes signed OTC offers safely and builds Taker V2 settlement manifest', () => {
    const signed: AtomicSwapOffer = {
      v: 1,
      network: 'stokenet',
      makerAccount: MAKER,
      offer: offerNft,
      want: wantXrd,
      subintentHash: 'subintent_tdx_2_1test123456',
      signedPartialTransaction: 'deadbeef010203',
      expirationTimestamp: 1800000000,
    };

    const code = encodeSwapOffer(signed);
    const decoded = decodeSwapOffer(`https://radix.community/console/atomic-swap?offer=${code}`);
    expect(decoded).toEqual(signed);
    expect(decodeSwapOffer('not-valid-base64!!!')).toBeNull();

    const takerManifest = buildTakerV2SettlementManifest(TAKER, decoded!);
    expect(takerManifest).toContain('USE_CHILD');
    expect(takerManifest).toContain('YIELD_TO_CHILD');
    expect(takerManifest).toContain(signed.subintentHash);
  });

  it('compiles and notarizes a real Stokenet NotarizedTransactionV2 via radix_v2_settler.wasm', async () => {
    const wasmBytes = readFileSync(join(process.cwd(), 'public/wasm/radix_v2_settler.wasm'));
    const { instance } = await WebAssembly.instantiate(wasmBytes, {});
    const { memory, wasm_alloc, wasm_dealloc, settle_v2_swap } = instance.exports as unknown as {
      memory: WebAssembly.Memory;
      wasm_alloc: (len: number) => number;
      wasm_dealloc: (ptr: number, len: number) => void;
      settle_v2_swap: (ptr: number, len: number) => bigint;
    };

    const makerHash = 'subtxid_tdx_2_1pt355radv6hesq4nhd60hnsaryxna4yal9mg55dymha0phkky0csu0wtjf';
    const takerHash = 'subtxid_tdx_2_1dqclndh5payfw40s36w7qcce92xjj84j032qx90em7xznl6l3g3sxxkvcu';
    const rootManifest = buildV2RootOrchestratorManifest(
      makerHash,
      takerHash,
      { kind: 'fungible', resourceAddress: 'resource_tdx_2_1t4d8agtc82js59k05nwyptkvmlz4n5z5gfxywfmynmvxlg6xkcm0rr', amount: '13' },
      { kind: 'fungible', resourceAddress: 'resource_tdx_2_1tktzl27quzp2lexlahajg2m9ex6qvp54a003n6mr5h79kwvkarfzt3', amount: '6' },
      'stokenet',
    );

    const payload = JSON.stringify({
      network_id: 2,
      current_epoch: 24931,
      maker_signed_partial_tx_hex: '4d220e03210221012105210607020a65610000000000000a73610000000000002200002201010547a6036b000000000a3c11a5736d15fdf620200022010121020c0a746578742f706c61696e2200010c09686f6c61206a61756e202000202206410380005188504dc8706f118434bd19efeeabc97352436cdb8c6243a25938c334fd0c087769746864726177210280005d5a7ea1783aa50a16cfa4dc40aeccdfc559d054424c4727649ed86fa34685000014801f4769b400000000000000000000000000000000000280005d5a7ea1783aa50a16cfa4dc40aeccdfc559d054424c4727649ed86fa34685000014801f4769b400000000000000000000000000000000600121018100000000040280005d962fabc0e082afe4dfedfb242b65c9b4060695ebdf19eb63a5fc5b399685000058ec3548445300000000000000000000000000000000410380005188504dc8706f118434bd19efeeabc97352436cdb8c6243a25938c334fd0c0d6465706f7369745f626174636821018300600121002021002022010102200720f1ad25f68c1f763b2c959369eeb99ddee6abfe19b36e5b1eaa43b734eb9090992101200740fab0a6c6d23b2914ec3720b65584047ef051b770cd9b6b86033f9cc5e13a7332a29cf41c25a6ebc9b1b9468b8069a06cb844f49726beb9649c78bf8c85e1ac06202000',
      taker_signed_partial_tx_hex: '4d220e03210221012105210607020a5b610000000000000a686100000000000022000022010105359a036b000000000ab34c3d325a8e9b72202000220000202000202206410380005188504dc8706f118434bd19efeeabc97352436cdb8c6243a25938c334fd0c087769746864726177210280005d962fabc0e082afe4dfedfb242b65c9b4060695ebdf19eb63a5fc5b3996850000c84e676dc11b0000000000000000000000000000000060012100040280005d5a7ea1783aa50a16cfa4dc40aeccdfc559d054424c4727649ed86fa3468500002cf61a24a22900000000000000000000000000000000040280005da66318c6318c61f5a61b4c6318c6318cf794aa8d295f14e6318c6318c685000064a7b3b6e00d00000000000000000000000000000000410380005188504dc8706f118434bd19efeeabc97352436cdb8c6243a25938c334fd0c0d6465706f7369745f626174636821018300600121002021002022010102200720f1ad25f68c1f763b2c959369eeb99ddee6abfe19b36e5b1eaa43b734eb9090992101200740031671857e62688b3f39f40a6ffb2a21eb26435223670a67ca5aacba19154928cfa6f33fc304b773ec44eb8454e595974f2e2ca5c2b938efdf5d6eb2f51cb200202000',
      root_manifest: rootManifest,
      random_seed_hex: '11'.repeat(32),
    });

    const enc = new TextEncoder().encode(payload);
    const inPtr = wasm_alloc(enc.length);
    new Uint8Array(memory.buffer, inPtr, enc.length).set(enc);
    const packed = settle_v2_swap(inPtr, enc.length);
    wasm_dealloc(inPtr, enc.length);

    const outPtr = Number(packed >> BigInt(32));
    const outLen = Number(packed & BigInt(0xffffffff));
    const out = JSON.parse(new TextDecoder().decode(new Uint8Array(memory.buffer, outPtr, outLen))) as {
      ok: boolean;
      intent_hash?: string;
      notarized_transaction_hex?: string;
      error?: string;
    };
    wasm_dealloc(outPtr, outLen);

    expect(out.error).toBeUndefined();
    expect(out.ok).toBe(true);
    expect(out.intent_hash).toMatch(/^txid_tdx_2_1/);
    expect(out.notarized_transaction_hex?.length).toBeGreaterThan(500);
  });
});
