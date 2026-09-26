import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import { AccountPicker } from '@/features/governance/components/AccountPicker';

const ACCOUNTS = [
    { address: 'account_rdx1_test_one', label: 'Main', appearanceId: 0 },
    { address: 'account_rdx1_test_two', label: 'Savings', appearanceId: 3 },
    { address: 'account_rdx1_test_three', label: 'Staking', appearanceId: 7 },
];
const LABELS = { all: 'All accounts', count: '{n} accounts', none: 'Pick one' };

function Harness({ onChange }: { onChange?: (s: string[]) => void }) {
    const [selected, setSelected] = useState([ACCOUNTS[0].address]);
    const set = (next: string[]) => { setSelected(next); onChange?.(next); };
    return (
        <AccountPicker
            accounts={ACCOUNTS}
            selected={selected}
            onToggle={a => set(selected.includes(a) ? selected.filter(x => x !== a) : [...selected, a])}
            onSetAll={set}
            label="Accounts"
            labels={LABELS}
        />
    );
}

describe('AccountPicker', () => {
    it('shows the single selected account, then several, then all', () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        const trigger = screen.getByRole('combobox', { name: 'Accounts' });
        expect(trigger.textContent).toContain('Main');

        fireEvent.click(trigger);
        const list = screen.getByRole('listbox');
        expect(list.getAttribute('aria-multiselectable')).toBe('true');
        fireEvent.click(screen.getByRole('option', { name: /Savings/ }));
        expect(onChange).toHaveBeenLastCalledWith(['account_rdx1_test_one', 'account_rdx1_test_two']);
        expect(trigger.textContent).toContain('2 accounts');

        fireEvent.click(screen.getByRole('option', { name: 'All accounts' }));
        expect(onChange).toHaveBeenLastCalledWith(ACCOUNTS.map(a => a.address));
        expect(trigger.textContent).toContain('All accounts');
        // Every option stays checked in the list, which stays open for more picks.
        expect(screen.getAllByRole('option').every(o => o.getAttribute('aria-selected') === 'true')).toBe(true);
    });

    it('works from the keyboard', () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        const trigger = screen.getByRole('combobox');
        fireEvent.keyDown(trigger, { key: 'ArrowDown' });
        fireEvent.keyDown(trigger, { key: 'ArrowDown' });
        fireEvent.keyDown(trigger, { key: 'ArrowDown' });
        fireEvent.keyDown(trigger, { key: 'Enter' });
        expect(onChange).toHaveBeenLastCalledWith(['account_rdx1_test_one', 'account_rdx1_test_two']);
        fireEvent.keyDown(trigger, { key: 'Escape' });
        expect(screen.queryByRole('listbox')).toBeNull();
    });
});
