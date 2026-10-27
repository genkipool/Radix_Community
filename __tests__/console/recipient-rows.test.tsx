import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';

// The real Spanish console dictionary: the rows read their texts from it.
vi.mock('@/context/LanguageContext', async () => {
  const es = (await import('@/features/console/locales/es.json')).default;
  return { useLanguage: () => ({ language: 'es', t: { console: es.console } }) };
});
// Symbol (or name) per resource, as the Gateway would give it.
vi.mock('@/features/console/hooks/useResourceLabels', () => ({
  useResourceLabels: () => ({ resource_t: 'TT', resource_d: 'Default Token' }),
}));
// The real fields bring the wallet and the address picker; plain inputs keep the
// test on what the rows do. "pick" stands for ticking accounts in the "+" popup.
vi.mock('@/features/console/components/shared/fields', () => ({
  AddressField: ({ value, onChange, placeholder, onPickerConfirm }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    onPickerConfirm?: (a: string[]) => void;
  }) => (
    <span>
      <input aria-label={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      {onPickerConfirm && (
        <button type="button" onClick={() => onPickerConfirm(['account_b', 'account_c', 'account_d'])}>
          pick
        </button>
      )}
    </span>
  ),
  TextField: ({ value, onChange, onBlur, placeholder, trailing }: { value: string; onChange: (v: string) => void; onBlur?: () => void; placeholder?: string; trailing?: React.ReactNode }) => (
    <span>
      <input aria-label={placeholder} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
      {trailing}
    </span>
  ),
}));

import { RecipientRows } from '@/features/console/components/distribution/RecipientRows';

const accounts = () => screen.getAllByLabelText('account_rdx1…').map((i) => (i as HTMLInputElement).value);
const resources = () => screen.getAllByLabelText('Recurso por defecto').map((i) => (i as HTMLInputElement).value);
const amounts = () => screen.getAllByLabelText('Cantidad o #id#').map((i) => (i as HTMLInputElement).value);

function Harness({ initial, onCsv, defaultResource }: { initial: string; onCsv?: (csv: string) => void; defaultResource?: string }) {
  const [csv, setCsv] = useState(initial);
  return (
    <>
      <button type="button" onClick={() => setCsv('account_x,resource_x,9\naccount_y,resource_y,8')}>
        upload
      </button>
      <RecipientRows csv={csv} defaultResource={defaultResource} onCsvChange={(next) => { setCsv(next); onCsv?.(next); }} />
    </>
  );
}

describe('recipient rows', () => {
  it('fills the rows from the CSV, three-column and two-column lines alike', () => {
    render(<Harness initial={'account,resource,amount\naccount_a,resource_t,5\naccount_b,7\n// comment'} />);
    expect(accounts()).toEqual(['account_a', 'account_b']);
    expect(resources()).toEqual(['resource_t', '']);
    expect(amounts()).toEqual(['5', '7']);
  });

  it('replaces the rows when a new CSV arrives (a file upload)', () => {
    render(<Harness initial={'account_a,1'} />);
    fireEvent.click(screen.getByText('upload'));
    expect(accounts()).toEqual(['account_x', 'account_y']);
    expect(resources()).toEqual(['resource_x', 'resource_y']);
    expect(amounts()).toEqual(['9', '8']);
  });

  it('adds a row per account ticked in the picker, with the same resource and amount', () => {
    const onCsv = vi.fn();
    render(<Harness initial={'account_a,resource_t,5\naccount_b,resource_t,2'} onCsv={onCsv} />);
    fireEvent.click(screen.getAllByText('pick')[0]);
    // account_b is already listed: it is not repeated. The first pick fills the row it came from.
    expect(accounts()).toEqual(['account_c', 'account_d', 'account_b']);
    expect(resources()).toEqual(['resource_t', 'resource_t', 'resource_t']);
    expect(amounts()).toEqual(['5', '5', '2']);
    expect(onCsv).toHaveBeenLastCalledWith('account_c,resource_t,5\naccount_d,resource_t,5\naccount_b,resource_t,2');
  });

  it('shows what each amount is in: the row token, else the default one, else asks for one', () => {
    const { unmount } = render(<Harness initial={'account_a,resource_t,5\naccount_b,7'} defaultResource="resource_d" />);
    expect(screen.getByText('TT')).toBeTruthy();
    expect(screen.getByText('Default Token')).toBeTruthy();
    unmount();
    render(<Harness initial={'account_b,7'} />);
    expect(screen.getByText('token?')).toBeTruthy();
  });

  it('turns a plain number into an NFT id when the token is an NFT', () => {
    const NFT = 'resource_tdx_2_1nfakenft';
    const FT = 'resource_tdx_2_1tfaketoken';
    render(<Harness initial={`account_a,${NFT},1\naccount_b,${FT},1`} />);
    const [nftAmount, tokenAmount] = screen.getAllByLabelText('Cantidad o #id#');
    fireEvent.blur(nftAmount);
    fireEvent.blur(tokenAmount);
    expect(amounts()).toEqual(['#1#', '1']);
  });
});
