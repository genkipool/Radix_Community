// @vitest-environment node
/**
 * MCP `prepare_atomic_swap` multi-account verification + end-to-end execution
 * on the Radix Engine dev wallet (`resim`), plus multi-account offer encoding
 * and committed-tx account extraction checks.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getMcpRegistry } from '@/services/mcp/tools';
import {
  decodeSwapOffer,
  encodeSwapOffer,
  extractTakerAccountsFromCommittedTx,
  getOfferMakerAccounts,
  reconstructOfferFromCommittedTx,
} from '@/features/console/lib/atomic-swap';
import { RESIM, ResimLedger, type ResimAccount } from '../helpers/resim';

const registry = getMcpRegistry();
const CTX = { origin: 'https://radix.community' };

describe('MCP prepare_atomic_swap multi-account', () => {
  it('encodes/decodes multi-account maker offers and extracts multiple maker/taker accounts from committed tx', () => {
    const maker1 = 'account_tdx_2_129aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const maker2 = 'account_tdx_2_129bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const taker1 = 'account_tdx_2_129cccccccccccccccccccccccccccccccccccccccccccccccccccc';
    const taker2 = 'account_tdx_2_129dddddddddddddddddddddddddddddddddddddddddddddddddddd';
    const resA = 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc';
    const resB = 'resource_tdx_2_1t4aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    const code = encodeSwapOffer({
      v: 1,
      network: 'stokenet',
      makerAccount: maker1,
      makerAccounts: [maker1, maker2],
      offer: { kind: 'fungible', resourceAddress: resA, amount: '100' },
      want: { kind: 'fungible', resourceAddress: resB, amount: '50' },
      subintentHash: 'subtxid_tdx_2_1test000000000000000000000000000000000000000000000',
      signedPartialTransaction: 'aabbccdd',
      expirationTimestamp: 1_900_000_000,
    });

    const decoded = decodeSwapOffer(code);
    expect(decoded).not.toBeNull();
    expect(decoded?.makerAccount).toBe(maker1);
    expect(getOfferMakerAccounts(decoded!)).toEqual([maker1, maker2]);

    const committedTx = {
      intent_hash: 'txid_tdx_2_1test',
      confirmed_at: '2026-11-23T06:00:00Z',
      manifest_instructions: `
        TAKE_FROM_WORKTOP Address("${resA}") Decimal("100") Bucket("m_0");
        TAKE_FROM_WORKTOP Address("${resB}") Decimal("50") Bucket("t_0");
      `,
      balance_changes: {
        fungible_balance_changes: [
          { entity_address: maker1, resource_address: resA, balance_change: '-60' },
          { entity_address: maker2, resource_address: resA, balance_change: '-40' },
          { entity_address: maker1, resource_address: resB, balance_change: '50' },
          { entity_address: taker1, resource_address: resB, balance_change: '-30' },
          { entity_address: taker2, resource_address: resB, balance_change: '-20' },
          { entity_address: taker1, resource_address: resA, balance_change: '100' },
        ],
      },
    };

    const reconstructed = reconstructOfferFromCommittedTx(
      'subtxid_tdx_2_1test000000000000000000000000000000000000000000000',
      'stokenet',
      committedTx,
    );
    expect(reconstructed).not.toBeNull();
    expect(getOfferMakerAccounts(reconstructed!)).toEqual([maker1, maker2]);

    const takers = extractTakerAccountsFromCommittedTx([maker1, maker2], committedTx);
    expect(takers).toEqual([taker1, taker2]);
  });

  describe.skipIf(!RESIM)('dev wallet (resim) end-to-end execution', () => {
    let ledger: ResimLedger;
    let makerA: ResimAccount;
    let makerB: ResimAccount;
    let takerA: ResimAccount;
    let takerB: ResimAccount;

    beforeAll(() => {
      ledger = new ResimLedger();
      makerA = ledger.newAccount();
      makerB = ledger.newAccount();
      takerA = ledger.newAccount();
      takerB = ledger.newAccount();
    });

    afterAll(() => ledger?.dispose());

    it('prepares a multi-account Subintent V2 manifest via MCP with split withdrawals across maker accounts', async () => {
      ledger.use(makerA);
      const tokA = ledger.newToken('100', 'SplitA');
      ledger.use(makerB);
      const tokB = ledger.newToken('80', 'SplitB');
      ledger.use(takerA);
      const tokWant = ledger.newToken('200', 'WantTok');

      const res = await registry.call(
        'prepare_atomic_swap',
        {
          mode: 'subintent',
          makerAccount: [makerA.address, makerB.address],
          offer: [
            { kind: 'fungible', resourceAddress: tokA, amount: '40' },
            { kind: 'fungible', resourceAddress: tokB, amount: '30' },
          ],
          want: { kind: 'fungible', resourceAddress: tokWant, amount: '50' },
          byAccount: {
            [makerA.address]: { fungibles: [{ resourceAddress: tokA, amount: '100' }], nonFungibles: [] },
            [makerB.address]: { fungibles: [{ resourceAddress: tokB, amount: '80' }], nonFungibles: [] },
          },
        },
        CTX,
      );

      expect(res.isError).toBeUndefined();
      const out = res.structuredContent as {
        makerAccount: string;
        makerAccounts: string[];
        manifest: string;
      };
      expect(out.makerAccount).toBe(makerA.address);
      expect(out.makerAccounts).toEqual([makerA.address, makerB.address]);
      expect(out.manifest).toContain(`Address("${makerA.address}")\n    "withdraw"\n    Address("${tokA}")\n    Decimal("40")`);
      expect(out.manifest).toContain(`Address("${makerB.address}")\n    "withdraw"\n    Address("${tokB}")\n    Decimal("30")`);
      expect(out.manifest).toContain(`YIELD_TO_PARENT`);
      expect(out.manifest).toContain(`Address("${makerA.address}")\n    "deposit_batch"`);
    });

    it('executes an MCP multi-account Direct V1 atomic swap on resim with split balances on both sides', async () => {
      ledger.use(makerA);
      const coinM = ledger.newToken('100', 'CoinM');
      // Split 40 of CoinM into makerB so Maker holds 60 in makerA + 40 in makerB
      ledger.exec('transfer', `${coinM}:40`, makerB.address);

      ledger.use(takerA);
      const coinT = ledger.newToken('200', 'CoinT');
      // Split 90 of CoinT into takerB so Taker holds 110 in takerA + 90 in takerB
      ledger.exec('transfer', `${coinT}:90`, takerB.address);

      const res = await registry.call(
        'prepare_atomic_swap',
        {
          mode: 'direct',
          makerAccount: [makerA.address, makerB.address],
          takerAccount: [takerA.address, takerB.address],
          offer: { kind: 'fungible', resourceAddress: coinM, amount: '85' },
          want: { kind: 'fungible', resourceAddress: coinT, amount: '150' },
          byAccount: {
            [makerA.address]: { fungibles: [{ resourceAddress: coinM, amount: '60' }], nonFungibles: [] },
            [makerB.address]: { fungibles: [{ resourceAddress: coinM, amount: '40' }], nonFungibles: [] },
            [takerA.address]: { fungibles: [{ resourceAddress: coinT, amount: '110' }], nonFungibles: [] },
            [takerB.address]: { fungibles: [{ resourceAddress: coinT, amount: '90' }], nonFungibles: [] },
          },
        },
        CTX,
      );

      expect(res.isError).toBeUndefined();
      const out = res.structuredContent as {
        makerAccounts: string[];
        takerAccounts: string[];
        manifest: string;
      };
      expect(out.makerAccounts).toEqual([makerA.address, makerB.address]);
      expect(out.takerAccounts).toEqual([takerA.address, takerB.address]);

      const swapFile = join(ledger.home, 'mcp-multi-account-swap.rtm');
      writeFileSync(
        swapFile,
        `CALL_METHOD\n    Address("${makerA.address}")\n    "lock_fee"\n    Decimal("500")\n;\n${out.manifest}`,
      );
      const runOut = ledger.exec(
        'run',
        '--signing-keys',
        `${makerA.privateKey},${makerB.privateKey},${takerA.privateKey},${takerB.privateKey}`,
        swapFile,
      );
      expect(runOut).toContain('Transaction Status: COMMITTED SUCCESS');

      // Maker gave 60 from makerA + 25 from makerB (= 85) and received 150 CoinT into makerA
      expect(ledger.balance(makerA.address, coinM)).toBe('0');
      expect(ledger.balance(makerB.address, coinM)).toBe('15');
      expect(ledger.balance(makerA.address, coinT)).toBe('150');

      // Taker gave 110 from takerA + 40 from takerB (= 150) and received 85 CoinM into takerA
      expect(ledger.balance(takerA.address, coinT)).toBe('0');
      expect(ledger.balance(takerB.address, coinT)).toBe('50');
      expect(ledger.balance(takerA.address, coinM)).toBe('85');
    });
  });
});
