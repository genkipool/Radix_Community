// @vitest-environment jsdom
/**
 * The pool picker's tabs show as soon as it opens, while their lists are still
 * loading ("…"), and a list that comes back empty keeps its tab with 0.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AddressPickerButton } from '@/features/console/components/shared/AddressPickerButton';

const POOL = 'pool_rdx1c5hm2rt67scp22pq6tpkfg6cd22g0wwz88065wsy9gdfnd86sv3t4t';

vi.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({ language: 'es' }) }));
vi.mock('@/features/wallet/hooks/useRadixWallet', () => ({
  useRadixWallet: () => ({ accounts: [], activeNetwork: 'mainnet', activeNetworkId: 1 }),
}));
vi.mock('@/features/wallet/hooks/useAddressBook', async (original) => ({
  ...(await original<object>()),
  useAddressBook: () => ({ entries: [] }),
}));

/** Each list answers only when the test says so. */
const replies: Record<string, (body: unknown) => void> = {};
vi.stubGlobal(
  'fetch',
  vi.fn(
    (url: string) =>
      new Promise((resolve) => {
        const name = url.includes('known-pools') ? 'known' : 'recent';
        replies[name] = (body) => resolve({ ok: true, status: 200, json: async () => body });
      }),
  ),
);

const tabTexts = () => screen.queryAllByRole('tab').map((t) => t.textContent?.trim());

describe('pool picker tabs', () => {
  it('are there from the start and fill in as the lists arrive', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AddressPickerButton categories={['pool']} onSelect={() => {}} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Elegir pool' }));

    expect(tabTexts()).toEqual(['Todas (…)', 'Agenda (0)', 'Usados por ti (0)', 'Ociswap (…)', 'DefiPlaza (…)', 'Reddicks (…)', 'Actividad reciente (…)']);

    await act(async () => replies.known({ pools: [[POOL, 'XRD/HUG', 'ociswap']] }));
    await waitFor(() =>
      expect(tabTexts()).toEqual(['Todas (1)', 'Agenda (0)', 'Usados por ti (0)', 'Ociswap (1)', 'DefiPlaza (0)', 'Reddicks (0)', 'Actividad reciente (…)']),
    );

    await act(async () => replies.recent({ pools: [] }));
    // Nothing recent: the tab stays, with 0.
    await waitFor(() =>
      expect(tabTexts()).toEqual(['Todas (1)', 'Agenda (0)', 'Usados por ti (0)', 'Ociswap (1)', 'DefiPlaza (0)', 'Reddicks (0)', 'Actividad reciente (0)']),
    );
  });
});
