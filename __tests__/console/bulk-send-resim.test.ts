// @vitest-environment node
/**
 * Bulk transfers against a real Radix Engine ledger (resim): batches commit
 * against accounts that do not exist on-ledger yet (the expensive case), a
 * recipient that refuses deposits gets refunded instead of aborting the
 * batch, and NFTs travel too.
 */
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { secp256k1 } from '@noble/curves/secp256k1';
import { PublicKey, RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit';
import {
  DEFAULT_BATCH_SIZE,
  bulkSendManifest,
  bulkSendManifests,
  type BulkRow,
} from '@/features/console/lib/bulk-send';
import { RESIM, ResimLedger, SIMULATOR_NETWORK_ID, expectCommitted, type ResimAccount } from '../helpers/resim';

/** A fresh virtual account: an address nobody has used, as most airdrop recipients are. */
async function virtualAccount(): Promise<string> {
  const priv = randomBytes(32);
  const pub = secp256k1.getPublicKey(priv, true);
  return RadixEngineToolkit.Derive.virtualAccountAddressFromPublicKey(
    new PublicKey.Secp256k1(pub),
    SIMULATOR_NETWORK_ID,
  );
}

const costUnits = (output: string) => Number(output.match(/([\d]+) execution cost units/)?.[1] ?? Infinity);

describe.skipIf(!RESIM)('bulk send on resim', () => {
  let ledger: ResimLedger;
  let sender: ResimAccount;
  let token = '';

  beforeAll(() => {
    ledger = new ResimLedger();
    sender = ledger.newAccount();
    ledger.use(sender);
    token = ledger.newToken('1000000', 'Drop');
  });

  afterAll(() => ledger?.dispose());

  it(`pays a full batch of ${DEFAULT_BATCH_SIZE} new virtual accounts in one transaction`, async () => {
    const rows: BulkRow[] = [];
    for (let i = 0; i < DEFAULT_BATCH_SIZE; i++) {
      rows.push({ line: i + 1, row: i + 1, account: await virtualAccount(), resource: token, amount: '1.5' });
    }
    const manifest = bulkSendManifest(sender.address, rows);
    const run = ledger.run(manifest, sender.address);
    expectCommitted(run, manifest.slice(0, 2000));
    expect(ledger.balance(rows[7].account, token)).toBe('1.5');
    expect(ledger.balance(rows[DEFAULT_BATCH_SIZE - 1].account, token)).toBe('1.5');
    // Leave clear headroom under the 100M execution cost limit.
    expect(costUnits(run.output)).toBeLessThan(60_000_000);
  });

  it('refunds a recipient that refuses deposits instead of aborting the batch', () => {
    const refuser = ledger.newAccount();
    ledger.use(refuser);
    expectCommitted(
      ledger.run(
        `CALL_METHOD Address("${refuser.address}") "set_default_deposit_rule" Enum<DefaultDepositRule::Reject>();`,
        refuser.address,
      ),
    );
    const other = ledger.newAccount();
    ledger.use(sender);
    const before = Number(ledger.balance(sender.address, token));
    const manifest = bulkSendManifest(sender.address, [
      { line: 1, row: 1, account: refuser.address, resource: token, amount: '10' },
      { line: 2, row: 2, account: other.address, resource: token, amount: '3' },
    ]);
    expectCommitted(ledger.run(manifest, sender.address), manifest);
    expect(ledger.balance(refuser.address, token)).toBe('0');
    expect(ledger.balance(other.address, token)).toBe('3');
    // Only the accepted 3 left the sender; the refused 10 came back.
    expect(Number(ledger.balance(sender.address, token))).toBe(before - 3);
  });

  it('sends NFTs alongside fungibles', () => {
    ledger.use(sender);
    const out = ledger.exec('new-simple-badge', '--name', 'Collectible');
    const nft = out.match(/NonFungibleGlobalId: (resource_sim1\w+):/)![1];
    const friend = ledger.newAccount();
    ledger.use(sender);
    const manifest = bulkSendManifest(sender.address, [
      { line: 1, row: 1, account: friend.address, resource: nft, amount: '', nftId: '#1#' },
      { line: 2, row: 2, account: friend.address, resource: token, amount: '2' },
    ]);
    expectCommitted(ledger.run(manifest, sender.address), manifest);
    expect(ledger.show(friend.address)).toContain(nft);
    expect(ledger.balance(friend.address, token)).toBe('2');
  });

  it('stays under the 256-event cap with new accounts up to 54 per transaction', async () => {
    const rows: BulkRow[] = [];
    for (let i = 0; i < 54; i++) rows.push({ line: i + 1, row: i + 1, account: await virtualAccount(), resource: token, amount: '1' });
    ledger.use(sender);
    expectCommitted(ledger.run(bulkSendManifest(sender.address, rows), sender.address));
  });

  it('splits long lists into several transactions', () => {
    const rows = Array.from({ length: 120 }, (_, i) => ({
      line: i + 1,
      row: i + 1,
      account: sender.address,
      resource: token,
      amount: '1',
    }));
    expect(bulkSendManifests(sender.address, rows)).toHaveLength(Math.ceil(120 / DEFAULT_BATCH_SIZE));
  });
});
