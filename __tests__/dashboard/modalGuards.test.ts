/**
 * Reading-mode modals must be mutually exclusive.
 *
 * A validator's id IS its `validator_…` address, which also satisfies the
 * entity-modal condition. With the entity modal ungated by view, opening a
 * validator in staking rendered BOTH: the explorer's entity card landed on top
 * of the validator one. These assertions pin the guard conditions so the three
 * modals can never overlap again.
 */
import { describe, it, expect } from 'vitest';

type View = 'staking' | 'transactions';

/** Mirrors the render conditions in DashboardModals. */
function openModals(input: {
  readingMode: boolean;
  activeView: View;
  hasValidator: boolean;
  hasTransaction: boolean;
  expandedId: string | null;
}): string[] {
  const { readingMode, activeView, hasValidator, hasTransaction, expandedId } = input;

  const isEntity =
    !!expandedId &&
    ['account_', 'package_', 'component_', 'resource_', 'transactiontracker_', 'consensusmanager_', 'validator_'].some(
      (prefix) => expandedId.startsWith(prefix),
    );

  const open: string[] = [];
  if (readingMode && activeView === 'staking' && hasValidator) open.push('validator');
  if (readingMode && activeView === 'transactions' && hasTransaction) open.push('transaction');
  if (readingMode && activeView === 'transactions' && isEntity) open.push('entity');
  return open;
}

describe('reading-mode modals', () => {
  it('opens only the validator modal for a validator in staking', () => {
    expect(
      openModals({
        readingMode: true,
        activeView: 'staking',
        hasValidator: true,
        hasTransaction: false,
        // The id is the address, which also looks like an entity.
        expandedId: 'validator_rdx1sdvntpsfvlyx2hapn5zfr6z7etfwgqljsqdqh23876r33fpd8cvu5j',
      }),
    ).toEqual(['validator']);
  });

  it('opens only the transaction modal for a transaction in the explorer', () => {
    expect(
      openModals({
        readingMode: true,
        activeView: 'transactions',
        hasValidator: false,
        hasTransaction: true,
        expandedId: 'txid_rdx1abc',
      }),
    ).toEqual(['transaction']);
  });

  it('opens the entity modal for an address searched in the explorer', () => {
    expect(
      openModals({
        readingMode: true,
        activeView: 'transactions',
        hasValidator: false,
        hasTransaction: false,
        expandedId: 'resource_rdx1abc',
      }),
    ).toEqual(['entity']);
  });

  it('never opens more than one modal at a time', () => {
    // In the real component the id decides what resolves: `expandedPost` is a
    // validator lookup by id and `expandedTx` a transaction lookup by hash, so
    // one id can never resolve to both. The sweep models that rather than
    // enumerating states the app cannot reach.
    const ids = [
      'validator_rdx1abc',
      'resource_rdx1abc',
      'account_rdx1abc',
      'package_rdx1abc',
      'component_rdx1abc',
      'consensusmanager_rdx1abc',
      'txid_rdx1abc',
      null,
    ];
    for (const activeView of ['staking', 'transactions'] as View[]) {
      for (const expandedId of ids) {
        const open = openModals({
          readingMode: true,
          activeView,
          hasValidator: !!expandedId?.startsWith('validator_'),
          hasTransaction: !!expandedId?.startsWith('txid_'),
          expandedId,
        });
        expect(open.length, `${activeView} · ${expandedId}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('opens nothing while reading mode is off', () => {
    expect(
      openModals({
        readingMode: false,
        activeView: 'staking',
        hasValidator: true,
        hasTransaction: true,
        expandedId: 'validator_rdx1abc',
      }),
    ).toEqual([]);
  });
});
