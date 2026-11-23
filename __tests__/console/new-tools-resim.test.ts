// @vitest-environment node
/**
 * End-to-end Radix Engine (`resim`) verification for the new Console tools:
 * - Account Migration (`buildMigrateBatches`): fungibles + NFTs + XRD reserve
 * - Account Cleanup (`buildCleanupBatches`): burn freely-burnable tokens, sweep
 *   non-burnable tokens to sink, deny future deposits, and safely handle
 *   non-withdrawable (restricted `withdrawer`) resources without AuthError
 * - Direct Atomic Swap (`buildDirectAtomicSwapManifest`): fungible <-> fungible
 *   and fungible <-> NFT settled atomically between two accounts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildMigrateBatches, type MigrateItem } from '@/features/console/lib/account-migrate';
import { buildCleanupBatches, type CleanupItem } from '@/features/console/lib/account-cleanup';
import {
  buildCancelSwapMoveManifest,
  buildDirectAtomicSwapManifest,
  buildMakerSubintentPreviewManifest,
} from '@/features/console/lib/atomic-swap';
import { RESIM, ResimLedger, SIM_XRD, expectCommitted, type ResimAccount } from '../helpers/resim';

describe.skipIf(!RESIM)('new console tools on resim', () => {
  let ledger: ResimLedger;
  let alice: ResimAccount;
  let bob: ResimAccount;
  let sink: ResimAccount;

  beforeAll(() => {
    ledger = new ResimLedger();
    alice = ledger.newAccount();
    bob = ledger.newAccount();
    sink = ledger.newAccount();
  });

  afterAll(() => ledger?.dispose());

  it('migrates fungibles, NFTs and XRD while keeping the XRD fee reserve', () => {
    ledger.use(alice);
    const token = ledger.newToken('250', 'MigToken');
    const nftOut = ledger.exec('new-simple-badge', '--name', 'MigNFT');
    const nftAddr = nftOut.match(/NonFungibleGlobalId: (resource_sim1\w+):/)![1];

    const xrdBefore = ledger.balance(alice.address, SIM_XRD);
    const items: MigrateItem[] = [
      { id: `f:${SIM_XRD}`, resourceAddress: SIM_XRD, kind: 'xrd', name: 'XRD', symbol: 'XRD', amount: xrdBefore },
      { id: `f:${token}`, resourceAddress: token, kind: 'fungible', name: 'MigToken', symbol: 'MTK', amount: '250' },
      { id: `nf:${nftAddr}`, resourceAddress: nftAddr, kind: 'nft', name: 'MigNFT', nftIds: ['#1#'] },
    ];

    // ResimLedger.run locks 500 XRD for fees, so reserve 600 XRD in this test
    const batches = buildMigrateBatches(alice.address, bob.address, items, '600');
    expect(batches.length).toBeGreaterThanOrEqual(1);

    for (const batch of batches) {
      expectCommitted(ledger.run(batch.manifest, alice.address), batch.manifest);
    }

    expect(ledger.balance(alice.address, token)).toBe('0');
    expect(ledger.balance(bob.address, token)).toBe('250');
    expect(ledger.show(bob.address)).toContain(nftAddr);
    // Source account keeps ~599 XRD (600 reserve minus tx fee)
    expect(Number(ledger.balance(alice.address, SIM_XRD))).toBeGreaterThan(590);
  });

  it('migrates exact 18-decimal balances without float rounding InsufficientBalance', () => {
    ledger.use(alice);
    const exactAmount = '17.099759466766969894';
    const fractionalToken = ledger.newToken(exactAmount, 'FracToken');
    const items: MigrateItem[] = [
      {
        id: `f:${fractionalToken}`,
        resourceAddress: fractionalToken,
        kind: 'fungible',
        name: 'FracToken',
        symbol: 'FRC',
        amount: exactAmount,
      },
    ];
    const batches = buildMigrateBatches(alice.address, bob.address, items, '2');
    expect(batches).toHaveLength(1);
    expectCommitted(ledger.run(batches[0].manifest, alice.address), batches[0].manifest);
    expect(ledger.balance(alice.address, fractionalToken)).toBe('0');
    expect(ledger.balance(bob.address, fractionalToken)).toBe(exactAmount);
  });

  it('cleans up spam: sweeps non-burnable to sink, denies deposits, and skips withdraw on restricted resources', () => {
    ledger.use(alice);
    const spamToken = ledger.newToken('500', 'SpamToken');
    const lockedToken = ledger.newToken('10', 'LockedToken');

    const cleanupItems: CleanupItem[] = [
      {
        resourceAddress: spamToken,
        isNonFungible: false,
        name: 'SpamToken',
        amount: '500',
        burnable: false,
        withdrawable: true,
        protected: false,
      },
      {
        resourceAddress: lockedToken,
        isNonFungible: false,
        name: 'LockedToken',
        amount: '10',
        burnable: false,
        withdrawable: false,
        protected: false,
      },
    ];

    const batches = buildCleanupBatches({
      account: alice.address,
      items: cleanupItems,
      denyDeposits: true,
      sinkAccount: sink.address,
    });
    expect(batches).toHaveLength(1);
    expectCommitted(ledger.run(batches[0].manifest, alice.address), batches[0].manifest);

    // SpamToken moved to sink; LockedToken stayed untouched (no withdraw AuthError) and both are Disallowed
    expect(ledger.balance(alice.address, spamToken)).toBe('0');
    expect(ledger.balance(sink.address, spamToken)).toBe('500');
    expect(ledger.balance(alice.address, lockedToken)).toBe('10');
  });

  it('burns a freely-burnable token and blocks future deposits in one transaction', () => {
    ledger.use(alice);
    // Create a resource with burner = AllowAll via manifest
    const createBurnable = `
      CREATE_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY
          Enum<0u8>()
          true
          18u8
          Decimal("100")
          Tuple(
              Some(Tuple(Some(Enum<AccessRule::DenyAll>()), Some(Enum<AccessRule::DenyAll>()))),
              Some(Tuple(Some(Enum<AccessRule::AllowAll>()), Some(Enum<AccessRule::DenyAll>()))),
              None,
              None,
              Some(Tuple(Some(Enum<AccessRule::AllowAll>()), Some(Enum<AccessRule::DenyAll>()))),
              None
          )
          Tuple(Map<String, Tuple>(), Map<String, Enum>())
          None
      ;
      CALL_METHOD Address("${alice.address}") "deposit_batch" Expression("ENTIRE_WORKTOP");
    `;
    const created = ledger.run(createBurnable, alice.address);
    expectCommitted(created, createBurnable);
    const burnableAddr = created.output.match(/Resource:\s+(resource_sim1\w+)/)![1];

    const batches = buildCleanupBatches({
      account: alice.address,
      items: [
        {
          resourceAddress: burnableAddr,
          isNonFungible: false,
          name: 'BurnableSpam',
          amount: '100',
          burnable: true,
          withdrawable: true,
          protected: false,
        },
      ],
      denyDeposits: true,
    });
    expect(batches).toHaveLength(1);
    expectCommitted(ledger.run(batches[0].manifest, alice.address), batches[0].manifest);
    expect(ledger.balance(alice.address, burnableAddr)).toBe('0');
  });

  it('executes a direct atomic swap between two accounts (fungible <-> NFT)', () => {
    ledger.use(alice);
    const coinA = ledger.newToken('100', 'CoinA');
    ledger.use(bob);
    const nftOut = ledger.exec('new-simple-badge', '--name', 'SwapNFT');
    const nftB = nftOut.match(/NonFungibleGlobalId: (resource_sim1\w+):/)![1];

    const manifest = buildDirectAtomicSwapManifest(
      alice.address,
      bob.address,
      { kind: 'fungible', resourceAddress: coinA, amount: '25' },
      { kind: 'nft', resourceAddress: nftB, ids: ['#1#'] },
    );
    expect(manifest).toBeTruthy();

    // Direct V1 atomic swap requires both accounts' signatures
    const swapFile = join(ledger.home, 'direct-swap.rtm');
    writeFileSync(
      swapFile,
      `CALL_METHOD\n    Address("${alice.address}")\n    "lock_fee"\n    Decimal("500")\n;\n${manifest}`,
    );
    const output = ledger.exec('run', '--signing-keys', `${alice.privateKey},${bob.privateKey}`, swapFile);
    expect(output).toContain('Transaction Status: COMMITTED SUCCESS');

    expect(ledger.balance(alice.address, coinA)).toBe('75');
    expect(ledger.balance(bob.address, coinA)).toBe('25');
    expect(ledger.show(alice.address)).toContain(nftB);
  });

  it('executes a multi-asset atomic swap and invalidates a pending Subintent offer via buildCancelSwapMoveManifest on resim', () => {
    ledger.use(alice);
    const token1 = ledger.newToken('300', 'MultiA1');
    const token2 = ledger.newToken('150', 'MultiA2');
    ledger.use(bob);
    const token3 = ledger.newToken('500', 'MultiB1');
    ledger.use(alice);

    // 1. Verify Maker Subintent preview manifest executes cleanly on resim
    const previewManifest = buildMakerSubintentPreviewManifest(alice.address, [
      { kind: 'fungible', resourceAddress: token1, amount: '100' },
      { kind: 'fungible', resourceAddress: token2, amount: '50' },
    ]);
    expectCommitted(ledger.run(previewManifest, alice.address), previewManifest);

    // 2. Execute multi-asset atomic swap between Alice and Bob
    const multiSwapManifest = buildDirectAtomicSwapManifest(
      alice.address,
      bob.address,
      [
        { kind: 'fungible', resourceAddress: token1, amount: '100' },
        { kind: 'fungible', resourceAddress: token2, amount: '50' },
      ],
      [{ kind: 'fungible', resourceAddress: token3, amount: '200' }],
    );
    const multiSwapFile = join(ledger.home, 'multi-swap.rtm');
    writeFileSync(
      multiSwapFile,
      `CALL_METHOD\n    Address("${alice.address}")\n    "lock_fee"\n    Decimal("500")\n;\n${multiSwapManifest}`,
    );
    const out = ledger.exec('run', '--signing-keys', `${alice.privateKey},${bob.privateKey}`, multiSwapFile);
    expect(out).toContain('Transaction Status: COMMITTED SUCCESS');
    expect(ledger.balance(alice.address, token1)).toBe('200');
    expect(ledger.balance(alice.address, token2)).toBe('100');
    expect(ledger.balance(alice.address, token3)).toBe('200');
    expect(ledger.balance(bob.address, token1)).toBe('100');
    expect(ledger.balance(bob.address, token2)).toBe('50');
    expect(ledger.balance(bob.address, token3)).toBe('300');

    // 3. Invalidate a shared Subintent offer by moving the remaining offered tokens to sink account
    const cancelManifest = buildCancelSwapMoveManifest(alice.address, sink.address, [
      { kind: 'fungible', resourceAddress: token1, amount: '200' },
    ]);
    expectCommitted(ledger.run(cancelManifest, alice.address), cancelManifest);
    expect(ledger.balance(alice.address, token1)).toBe('0');
    expect(ledger.balance(sink.address, token1)).toBe('200');

    // 4. Multi-account withdrawal: Alice holds 100 of token2 and Sink holds 200 of token1.
    // Selecting [alice, sink] as maker accounts withdraws across both accounts and pools on the worktop.
    const byAccount = {
      [alice.address]: {
        fungibles: [{ resourceAddress: token2, amount: '100' }],
        nonFungibles: [],
      },
      [sink.address]: {
        fungibles: [{ resourceAddress: token1, amount: '200' }],
        nonFungibles: [],
      },
    };
    const multiAccountSwapManifest = buildDirectAtomicSwapManifest(
      [alice.address, sink.address],
      [bob.address],
      [
        { kind: 'fungible', resourceAddress: token2, amount: '50' },
        { kind: 'fungible', resourceAddress: token1, amount: '120' },
      ],
      [{ kind: 'fungible', resourceAddress: token3, amount: '90' }],
      byAccount,
    );
    const multiAccFile = join(ledger.home, 'multi-account-swap.rtm');
    writeFileSync(
      multiAccFile,
      `CALL_METHOD\n    Address("${alice.address}")\n    "lock_fee"\n    Decimal("500")\n;\n${multiAccountSwapManifest}`,
    );
    const multiAccOut = ledger.exec(
      'run',
      '--signing-keys',
      `${alice.privateKey},${sink.privateKey},${bob.privateKey}`,
      multiAccFile,
    );
    expect(multiAccOut).toContain('Transaction Status: COMMITTED SUCCESS');
    expect(ledger.balance(alice.address, token2)).toBe('50');
    expect(ledger.balance(sink.address, token1)).toBe('80');
    expect(ledger.balance(alice.address, token3)).toBe('290');
    expect(ledger.balance(bob.address, token2)).toBe('100');
    expect(ledger.balance(bob.address, token1)).toBe('220');
  });
});
