import { describe, expect, it } from 'vitest';
import { olympiaTxFlow } from '@/features/dashboard/explorador/olympia/txFlow';
import type { OlympiaAction, OlympiaTxDetail } from '@/types/olympia';

const XRD = 'xrd_rr1qy5wfsfh';
const ME = 'rdx1qspme';
const YOU = 'rdx1qspyou';
const VAL = 'rv1qval';

const action = (a: Partial<OlympiaAction>): OlympiaAction => ({
  index: 0, type: null, from: null, to: null, validator: null, validatorName: null, amount: null, amountNum: 0, rri: XRD, symbol: 'XRD', ...a,
});

const tx = (t: Partial<OlympiaTxDetail>): OlympiaTxDetail => ({
  transactionId: 'ab'.repeat(32), stateVersion: 1, timestamp: '2022-01-01T00:00:00Z', feeXrd: 0.1, message: null, messageEncrypted: false,
  actions: [], balanceChanges: [], epoch: 1, round: 1, feePayer: ME, accountsCount: 1, allBalanceChanges: [], rawHex: null, ...t,
});

describe('Olympia transaction flow', () => {
  it('splits a transfer into sender and receiver and keeps the fee apart', () => {
    const f = olympiaTxFlow(tx({
      accountsCount: 2,
      actions: [action({ type: 'BURN_XRD', from: ME, amount: '0.1', amountNum: 0.1 }), action({ index: 1, type: 'TRANSFER_TOKENS', from: ME, to: YOU, amount: '5', amountNum: 5 })],
      allBalanceChanges: [
        { address: ME, rri: XRD, symbol: 'XRD', delta: '-5.1', deltaNum: -5.1 },
        { address: YOU, rri: XRD, symbol: 'XRD', delta: '5', deltaNum: 5 },
      ],
    }));
    expect(f.origin).toHaveLength(1);
    expect(f.origin[0].amount).toBeCloseTo(-5);
    expect(f.destination.map((r) => r.address)).toEqual([YOU]);
    expect(f.feeOnlyPayer).toBeNull();
    expect(f.types).toEqual(['TRANSFER_TOKENS']);
    expect(f.headline).toEqual({ kind: 'amount', amount: 5, symbol: 'XRD' });
    // Accounts first, then the token, as Babylon lists resources among the affected entities.
    expect(f.entities.map((e) => e.address)).toEqual([ME, YOU, XRD]);
    expect(f.created).toEqual([]);
  });

  it('lists a token the transaction created', () => {
    const NEW = 'gum_rr1qnew';
    const f = olympiaTxFlow(tx({
      actions: [action({ type: 'CREATE_TOKEN_DEFINITION', from: ME, rri: NEW, symbol: 'GUM' })],
    }));
    expect(f.created).toEqual([{ address: NEW, label: 'GUM' }]);
    expect(f.entities.map((e) => e.address)).toContain(NEW);
  });

  it('draws a stake as the account sending to the validator', () => {
    const f = olympiaTxFlow(tx({
      actions: [action({ type: 'STAKE_TOKENS', from: ME, validator: VAL, validatorName: 'POOL', amount: '100', amountNum: 100 })],
      allBalanceChanges: [{ address: ME, rri: XRD, symbol: 'XRD', delta: '-100.1', deltaNum: -100.1 }],
    }));
    expect(f.origin[0].amount).toBeCloseTo(-100);
    expect(f.destination).toEqual([expect.objectContaining({ address: VAL, label: 'POOL', amount: 100, kind: 'stake' })]);
    expect(f.headline.kind).toBe('stake');
  });

  it('draws an unstake from the validator back to the account, which only paid the fee in liquid XRD', () => {
    const f = olympiaTxFlow(tx({
      actions: [action({ type: 'UNSTAKE_TOKENS', from: ME, validator: VAL, amount: '40', amountNum: 40 })],
      allBalanceChanges: [{ address: ME, rri: XRD, symbol: 'XRD', delta: '-0.1', deltaNum: -0.1 }],
    }));
    expect(f.origin).toEqual([expect.objectContaining({ address: VAL, amount: -40, kind: 'unstake' })]);
    expect(f.destination).toEqual([expect.objectContaining({ address: ME, amount: 40, kind: 'unstake' })]);
    expect(f.feeOnlyPayer).toBeNull();
    expect(f.headline).toEqual({ kind: 'unstake', amount: 40, symbol: 'XRD' });
  });

  it('shows a payer that moved nothing else with its fee only', () => {
    const f = olympiaTxFlow(tx({
      actions: [action({ type: 'BURN_XRD', from: ME, amount: '0.1', amountNum: 0.1 })],
      allBalanceChanges: [{ address: ME, rri: XRD, symbol: 'XRD', delta: '-0.1', deltaNum: -0.1 }],
    }));
    expect(f.origin).toHaveLength(0);
    expect(f.feeOnlyPayer).toBe(ME);
    expect(f.headline).toEqual({ kind: 'fee', amount: 0.1, symbol: 'XRD' });
  });
});
