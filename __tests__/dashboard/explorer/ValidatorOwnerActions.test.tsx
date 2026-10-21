import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { extractValidatorOwnerActions, EPOCH_MS } from '@/features/dashboard/explorador/utils/validatorOwnerActions';
import { ValidatorOwnerActionCard } from '@/features/dashboard/explorador/components/ValidatorOwnerActionCard';
import { translations } from '@/i18n';

// The address chips resolve entity names over the network; here they only have to show the address.
vi.mock('@/features/dashboard/explorador/components/EntityBadge', () => ({
    AddressDisplay: ({ address }: { address: string }) => <span data-testid="address">{address}</span>,
}));
vi.mock('@/features/dashboard/hooks/useEntityData', () => ({ useEntityData: () => ({ name: 'Lucky Validator' }) }));

const V = 'validator_rdx1sw2qt9k0placmjgwku2kvk66c2v8v0f9ny2fkvzhsh7wwzey6g7zam';
const OWNER = 'account_rdx16xmm6gzsqpdcr4hrk38mrxz7wy4a2fnlfy74xafyx6n3vjuk4wsgn3';
const UNLOCK_VAULT = 'internal_vault_rdx1trrf5v6ea4rt828medlk4lfcr86f60zgemml79tphg0vg28k89yr88';

const call = (method: string, args = '') => `CALL_METHOD\n    Address("${V}")\n    "${method}"\n${args};\n`;
const state = (before: object, after: object) => [{
    substate_id: { entity_address: V, substate_type: 'ValidatorFieldState' },
    previous_value: { substate_data: { value: before } },
    new_value: { substate_data: { value: after } },
}];

describe('extractValidatorOwnerActions', () => {
    it('reads an unlock start: the LSUs, and the epoch the new part becomes available', () => {
        const before = { pending_owner_stake_unit_withdrawals: [{ epoch_unlocked: 351278, stake_unit_amount: '1415' }] };
        const after = { pending_owner_stake_unit_withdrawals: [...before.pending_owner_stake_unit_withdrawals, { epoch_unlocked: 359054, stake_unit_amount: '1538' }] };
        const [action] = extractValidatorOwnerActions({ manifest: call('start_unlock_owner_stake_units', '    Decimal("1538")\n'), substates: state(before, after), events: [], epoch: 350990 });
        expect(action).toMatchObject({
            kind: 'start_unlock', validator: V, amount: 1538, unlockEpoch: 359054, unlockEpochsAway: 8064, unlockingParts: 2, unlockingTotal: 2953,
        });
        // 8064 epochs of five minutes: 28 days.
        expect((action.unlockEpochsAway! * EPOCH_MS) / 86_400_000).toBe(28);
    });

    it('takes the amount of a finished unlock from what the unlock vault gave out', () => {
        const after = { pending_owner_stake_unit_unlock_vault: { entity_address: UNLOCK_VAULT } };
        const events = [
            { name: 'WithdrawEvent', emitter: { entity: { entity_address: 'internal_vault_rdx1other' } }, data: { fields: [{ field_name: 'amount', value: '9' }] } },
            { name: 'WithdrawEvent', emitter: { entity: { entity_address: UNLOCK_VAULT } }, data: { fields: [{ field_name: 'amount', value: '1415' }] } },
        ];
        const [action] = extractValidatorOwnerActions({ manifest: call('finish_unlock_owner_stake_units'), substates: state({}, after), events, epoch: 351278 });
        expect(action).toMatchObject({ kind: 'finish_unlock', amount: 1415 });
    });

    it('takes the amount of a lock from what the validator gained (the LSUs come as a bucket)', () => {
        const [action] = extractValidatorOwnerActions({
            manifest: call('lock_owner_stake_units', '    Bucket("bucket1")\n'),
            substates: [], events: [], epoch: 1,
            balanceChanges: { fungible_balance_changes: [{ entity_address: OWNER, balance_change: '-250' }, { entity_address: V, balance_change: '250' }] },
        });
        expect(action).toMatchObject({ kind: 'lock', amount: 250 });
    });

    it('falls back to the locked-stake vault deposit when no balance change names the validator', () => {
        const LOCKED_VAULT = 'internal_vault_rdx1tqcallnm7tashusge3m26cq96kjxe79qn866fjladndjlxheyzg439';
        const events = [
            { name: 'WithdrawEvent', emitter: { entity: { entity_address: 'internal_vault_rdx1theaccount' } }, data: { fields: [{ field_name: 'amount', value: '250' }] } },
            { name: 'DepositEvent', emitter: { entity: { entity_address: LOCKED_VAULT } }, data: { fields: [{ field_name: 'amount', value: '250' }] } },
        ];
        const [action] = extractValidatorOwnerActions({
            manifest: call('lock_owner_stake_units', '    Bucket("bucket1")\n'),
            substates: state({}, { locked_owner_stake_unit_vault: { entity_address: LOCKED_VAULT } }), events, epoch: 1,
        });
        expect(action).toMatchObject({ kind: 'lock', amount: 250 });
    });

    it('reads registration, key, fee and delegated-stake changes from the validator state', () => {
        const manifest = [
            call('unregister'),
            call('update_key', '    Bytes("03d9fc")\n'),
            call('update_fee', '    Decimal("0.5")\n'),
            call('update_accept_delegated_stake', '    false\n'),
        ].join('');
        const before = { is_registered: true, public_key: { key_hex: '037c45' }, validator_fee_factor: '0.015', accepts_delegated_stake: true };
        const after = {
            is_registered: false, public_key: { key_hex: '03d9fc' }, validator_fee_factor: '0.015',
            validator_fee_change_request: { new_fee_factor: '0.5', epoch_effective: 348297 }, accepts_delegated_stake: false,
        };
        const actions = extractValidatorOwnerActions({ manifest, substates: state(before, after), events: [], epoch: 344265 });
        expect(actions.map(a => a.kind)).toEqual(['unregister', 'update_key', 'update_fee', 'accept_delegated']);
        expect(actions[0].registered).toEqual({ before: true, after: false });
        expect(actions[1].key).toEqual({ before: '037c45', after: '03d9fc' });
        expect(actions[2].fee).toEqual({ before: 0.015, requested: 0.5, appliedNow: false, effectiveEpoch: 348297 });
        expect(actions[3].accepts).toEqual({ before: true, after: false });
    });

    it('calls a fee cut applied at once when the validator state already holds it', () => {
        const [action] = extractValidatorOwnerActions({
            manifest: call('update_fee', '    Decimal("0.01")\n'),
            substates: state({ validator_fee_factor: '0.02' }, { validator_fee_factor: '0.01' }),
            events: [], epoch: 1,
        });
        expect(action.fee).toMatchObject({ before: 0.02, requested: 0.01, appliedNow: true, effectiveEpoch: null });
    });

    it('ignores what is not an owner action: stakes, claims, other targets, fee plumbing', () => {
        const manifest = [
            `CALL_METHOD\n    Address("${OWNER}")\n    "lock_fee"\n    Decimal("100")\n;\n`,
            call('stake', '    Bucket("b")\n'),
            call('claim_xrd', '    Bucket("b")\n'),
            `CALL_METHOD\n    Address("account_rdx1xyz")\n    "register"\n;\n`, // not a validator
        ].join('');
        expect(extractValidatorOwnerActions({ manifest, substates: [], events: [], epoch: 1 })).toEqual([]);
        expect(extractValidatorOwnerActions({ manifest: undefined, substates: undefined, events: undefined, epoch: undefined })).toEqual([]);
    });
});

const tt = translations.en.dashboard.transactions;
const renderCard = (action: Parameters<typeof ValidatorOwnerActionCard>[0]['action']) => render(
    <ValidatorOwnerActionCard action={action} owner={OWNER} confirmedAt="2026-10-20T02:00:00.000Z" tt={tt} onCopy={vi.fn()} copiedAddress={null} network="mainnet" locale="en" timezone="UTC" />,
);

describe('ValidatorOwnerActionCard', () => {
    it('shows an unlock start as locked → unlocking with the date it becomes available', () => {
        renderCard({ kind: 'start_unlock', validator: V, amount: 1538, unlockEpoch: 359054, unlockEpochsAway: 8064, unlockingParts: 28, unlockingTotal: 39700 });
        expect(screen.getByText('−1,538 LSU')).toBeInTheDocument();
        expect(screen.getByText('+1,538 LSU')).toBeInTheDocument();
        expect(screen.getAllByText(/Nov 17, 2026/).length).toBeGreaterThan(0); // 28 days after Oct 20
        expect(screen.getByText(/epoch 359054, in about 28 days/)).toBeInTheDocument();
        expect(screen.getByText('39,700 LSU in 28 parts')).toBeInTheDocument();
        expect(screen.getByText(/The owner of Lucky Validator asked to unlock 1,538 LSU/)).toBeInTheDocument();
    });

    it('shows a finished unlock as unlocking → owner account', () => {
        renderCard({ kind: 'finish_unlock', validator: V, amount: 1415 });
        expect(screen.getByText('−1,415 LSU')).toBeInTheDocument();
        expect(screen.getByText('+1,415 LSU')).toBeInTheDocument();
        expect(screen.getAllByTestId('address').map(a => a.textContent)).toContain(OWNER);
    });

    it('shows a fee change as before → after and when it takes effect', () => {
        renderCard({ kind: 'update_fee', validator: V, fee: { before: 0.015, requested: 0.5, appliedNow: false, effectiveEpoch: 348297 } });
        expect(screen.getByText('1.5 %')).toBeInTheDocument();
        expect(screen.getAllByText(/50 %/).length).toBeGreaterThan(0);
        expect(screen.getByText('Epoch 348297')).toBeInTheDocument();
    });

    it('shows registration, key and delegated-stake changes', () => {
        const { unmount } = renderCard({ kind: 'unregister', validator: V, registered: { before: true, after: false } });
        expect(screen.getByText('Registered')).toBeInTheDocument();
        expect(screen.getByText('Not registered')).toBeInTheDocument();
        unmount();
        const before = '037c453108a8119b9a7c216b2b4e53e1ab4c955326b4f1eeab3bff3761a4562044';
        const after = '03d9fc30198ce70f2ac4a6947f34c0b63b8a5e506b5059c1bfaccb086a04a5631e';
        const short = (hex: string) => `${hex.slice(0, 10)}…${hex.slice(-8)}`;
        const key = renderCard({ kind: 'update_key', validator: V, key: { before, after } });
        expect(screen.getByText(short(before))).toBeInTheDocument();
        expect(screen.getByText(short(after))).toBeInTheDocument();
        key.unmount();
        renderCard({ kind: 'accept_delegated', validator: V, accepts: { before: true, after: false } });
        expect(screen.getByText(/no longer accepts new delegated stake/)).toBeInTheDocument();
    });
});
