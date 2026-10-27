import { describe, expect, it } from 'vitest';

import { poolContributions, poolManagerMoves } from '@/features/console/lib/pool-history';

const UNIT = 'resource_unit';
const XRD = 'resource_xrd';
const TOK = 'resource_tok';
const change = (entity: string, resource: string, balance_change: string) => ({ entity_address: entity, resource_address: resource, balance_change });

describe('pool contributions from history', () => {
  it('adds up what each account put in and what it took back by redeeming', () => {
    const result = poolContributions(
      [
        { balance_changes: { fungible_balance_changes: [change('alice', XRD, '-10'), change('alice', TOK, '-100'), change('alice', UNIT, '10')] } },
        { balance_changes: { fungible_balance_changes: [change('bob', XRD, '-2.5'), change('bob', TOK, '-25'), change('bob', UNIT, '2.5')] } },
        // Alice redeems half.
        { balance_changes: { fungible_balance_changes: [change('alice', UNIT, '-5'), change('alice', XRD, '5'), change('alice', TOK, '50')] } },
      ],
      UNIT,
      [XRD, TOK],
    );
    expect(result).toEqual({
      alice: { putIn: { [XRD]: '10', [TOK]: '100' }, takenOut: { [XRD]: '5', [TOK]: '50' } },
      bob: { putIn: { [XRD]: '2.5', [TOK]: '25' }, takenOut: {} },
    });
  });

  it('ignores reserve tokens moving without pool units (a plain transfer)', () => {
    const result = poolContributions(
      [{ balance_changes: { fungible_balance_changes: [change('carol', XRD, '-7'), change('dave', XRD, '7')] } }],
      UNIT,
      [XRD],
    );
    expect(result).toEqual({});
  });
});

describe('poolManagerMoves', () => {
  const POOL = 'pool_x';
  const UNIT = 'resource_unit';
  const A = 'resource_a';
  const change = (entity_address: string, resource_address: string, balance_change: string) => ({ entity_address, resource_address, balance_change });

  it('counts the reserve moves where no pool unit moved, newest first', () => {
    const moves = poolManagerMoves(
      [
        // protected_withdraw: the pool loses reserves, no unit anywhere.
        { confirmed_at: '2026-10-27T10:00:00Z', balance_changes: { fungible_balance_changes: [change(POOL, A, '-4'), change('account_m', A, '4')] } },
        // A contribution: units are minted, so it is not the manager's move.
        { confirmed_at: '2026-10-26T10:00:00Z', balance_changes: { fungible_balance_changes: [change(POOL, A, '10'), change('account_p', UNIT, '10')] } },
        // protected_deposit.
        { confirmed_at: '2026-10-25T10:00:00Z', balance_changes: { fungible_balance_changes: [change(POOL, A, '1.5')] } },
        // Nothing of the pool's reserves moved.
        { confirmed_at: '2026-10-24T10:00:00Z', balance_changes: { fungible_balance_changes: [change('account_q', A, '3')] } },
      ],
      POOL,
      UNIT,
      [A],
    );
    expect(moves).toEqual({ count: 2, withdrawn: { [A]: '4' }, deposited: { [A]: '1.5' }, lastAt: '2026-10-27T10:00:00Z' });
  });
});
