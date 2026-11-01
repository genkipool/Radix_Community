import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import en from '@/features/console/locales/en.json';
import { RuleSummary } from '@/features/console/components/shared/InfoParts';
import type { ConsoleDictionary } from '@/features/console/types/i18n.types';

vi.mock('@/features/console/ConsoleNav', () => ({ ConsoleToolLink: () => null }));

const t = en.console as unknown as ConsoleDictionary;
const BADGE = 'resource_rdx1t4dekrf58h0r28s3c93z92w3jt5ngx87jzd63mgc597zmf3534rxfv';
const CALLER = 'resource_rdx1nfxxxxxxxxxxglcllrxxxxxxxxx002350006550xxxxxxxxxglcllr';
const address = (a: string) => <span data-testid="address">{a}</span>;

describe('RuleSummary', () => {
  it('shows the badge address under its name when asked to', () => {
    render(<RuleSummary t={t} rule={{ type: 'resource', resource: BADGE }} badgeName={() => 'Locker badge'} held address={address} />);
    expect(screen.getByText('Badge Locker badge')).toBeTruthy();
    expect(screen.getByTestId('address').textContent).toBe(BADGE);
  });

  it('shows only the name without it', () => {
    render(<RuleSummary t={t} rule={{ type: 'resource', resource: BADGE }} badgeName={() => 'Locker badge'} />);
    expect(screen.queryByTestId('address')).toBeNull();
  });

  it('never shows the engine caller badge as an address: it names the component instead', () => {
    render(<RuleSummary t={t} rule={{ type: 'nonFungible', resource: CALLER, localId: '[ab]' }} badgeName={() => ''} address={address} />);
    expect(screen.queryByTestId('address')).toBeNull();
    expect(screen.getByText(t.pool.rule.component)).toBeTruthy();
  });
});
