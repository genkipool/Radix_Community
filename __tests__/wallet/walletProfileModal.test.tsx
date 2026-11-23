import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import esCommon from '@/i18n/locales/common/es.json';
import dashboardExploradorEs from '@/features/dashboard/explorador/locales/es.json';
import { WalletProfileModal } from '@/features/wallet/components/WalletProfileModal';

let mockSelectedAddresses: string[] = [];
const mockSetSelectedAddresses = vi.fn((next: string[]) => {
  mockSelectedAddresses = next;
});

const MOCK_ACCOUNTS = [
  { address: 'account_rdx1firstaccount0000000000000000000000000000000000', label: 'Cuenta Principal' },
  { address: 'account_rdx1secondaccount000000000000000000000000000000000', label: 'Cuenta Ahorro' },
];

vi.mock('@/features/wallet/hooks/useRadixWallet', () => ({
  useRadixWallet: () => ({
    persona: { label: 'Tester' },
    accounts: MOCK_ACCOUNTS,
    activeNetworkId: 1,
    activeNetwork: 'mainnet',
    sessions: { mainnet: true },
    connect: vi.fn(),
    disconnect: vi.fn(),
    switchNetwork: vi.fn(),
    selectedAccountAddresses: mockSelectedAddresses,
    setSelectedAccountAddresses: mockSetSelectedAddresses,
  }),
}));

vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({ t: esCommon, language: 'es' }),
}));

vi.mock('@/components/shared/SidePanelModal', () => ({
  SidePanelModal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div data-testid="side-panel-modal">{children}</div> : null,
}));

vi.mock('@/components/shared/SidePanelControls', () => ({
  SidePanelControls: () => null,
}));

vi.mock('@/components/shared/hooks/useSidePanelControls', () => ({
  useSidePanelControls: () => ({
    isPinned: false,
    togglePin: vi.fn(),
    handlePiP: vi.fn(),
    handlePopupWindow: vi.fn(),
    externalWindow: null,
    closeExternalWindow: vi.fn(),
    resetPin: vi.fn(),
  }),
}));

vi.mock('@/components/shared/UnderConstructionModal', () => ({
  UnderConstructionModal: () => null,
}));

vi.mock('@/features/wallet/components/TransactionBuilder', () => ({
  TransactionBuilder: () => <div data-testid="tx-builder">TX</div>,
}));

vi.mock('@/features/wallet/components/InlineAddressBook', () => ({
  InlineAddressBook: () => null,
}));

vi.mock('@/features/dashboard/services/apiClient', () => ({
  apiFetchEntityDetails: vi.fn().mockResolvedValue(null),
  apiFetchTransactionDetails: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/features/dashboard/hooks/usePrefetchRewards', () => ({
  usePrefetchRewards: () => ({ prefetchAccountRewards: vi.fn() }),
}));

vi.mock('@/features/dashboard/hooks/useTokenPrices', () => ({
  useTokenPrices: () => ({ priceOf: () => null, currency: 'EUR', ready: false }),
}));

vi.mock('@/features/dashboard/explorador/components/AccountLockersTab', () => ({
  AccountLockersSummary: () => null,
}));

let mockStakingRows: Array<{
  validatorName: string;
  validatorIcon: string;
  validatorAddress: string;
  xrdInStake: number;
  xrdInUnstake: number;
  xrdInClaim: number;
  unstakes: Array<{ amount: number; epoch: number }>;
}> = [];

vi.mock('@/features/dashboard/explorador/hooks/useAccountStats', () => ({
  useAccountStats: () => ({
    isLoading: false,
    xrdAmount: '500',
    tokens: [],
    lsuTokens: [],
    activeNfts: [],
    burnedNfts: [],
    poolUnits: [],
    stakingRows: mockStakingRows,
    totalLsuAmount: 0,
    totalLsuXrdEquivalent: 0,
    claimableNfts: {},
  }),
}));

vi.mock('@/features/dashboard/staking/hooks/useValidatorsQuery', () => ({
  useValidatorsQuery: () => ({
    data: {
      validators: [
        {
          address: 'validator_rdx1alpha000000000000000000000000000000000000',
          name: 'Alpha Validator',
          iconUrl: '',
          lsu2xrdFactor: 1,
          lsuResource: 'resource_lsu_alpha',
          claimTokenResourceAddress: 'resource_claim_alpha',
        },
      ],
    },
  }),
}));

vi.mock('@/features/dashboard/staking/hooks/useStakingTransaction', () => ({
  useStakingTransaction: () => ({
    submitTransaction: vi.fn(),
    submitBatchTransaction: vi.fn(),
    submitMixedBatchTransaction: vi.fn(),
    isTransacting: false,
    error: null,
    clearError: vi.fn(),
  }),
}));

function renderModal() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const renderResult = render(
    <QueryClientProvider client={queryClient}>
      <WalletProfileModal
        isOpen
        onClose={vi.fn()}
        t={esCommon as unknown as Parameters<typeof WalletProfileModal>[0]['t']}
        locale="es"
      />
    </QueryClientProvider>,
  );
  return {
    ...renderResult,
    rerenderModal: () =>
      renderResult.rerender(
        <QueryClientProvider client={queryClient}>
          <WalletProfileModal
            isOpen
            onClose={vi.fn()}
            t={esCommon as unknown as Parameters<typeof WalletProfileModal>[0]['t']}
            locale="es"
          />
        </QueryClientProvider>,
      ),
  };
}

const storageStore = new Map<string, string>();
const memoryStorage: Storage = {
  get length() {
    return storageStore.size;
  },
  clear: () => {
    storageStore.clear();
  },
  getItem: (key: string) => storageStore.get(key) ?? null,
  key: (index: number) => Array.from(storageStore.keys())[index] ?? null,
  removeItem: (key: string) => {
    storageStore.delete(key);
  },
  setItem: (key: string, value: string) => {
    storageStore.set(key, String(value));
  },
};

describe('WalletProfileModal regressions', () => {
  beforeEach(() => {
    mockSelectedAddresses = [];
    mockStakingRows = [];
    mockSetSelectedAddresses.mockClear();
    storageStore.clear();
    Object.defineProperty(window, 'localStorage', {
      value: memoryStorage,
      configurable: true,
    });
  });

  it('opens the address filter popup without being clipped by overflow-hidden', () => {
    renderModal();

    const selectorButton = screen.getByRole('button', { name: esCommon.nav.all_accounts });
    fireEvent.click(selectorButton);

    const searchInput = screen.getByPlaceholderText(esCommon.ui.search);
    expect(searchInput).toBeInTheDocument();

    // Ensure no ancestor of the SelectPopup inside the modal clips it with overflow-hidden
    const popupRoot = searchInput.closest('[class*="shadow-2xl"]');
    expect(popupRoot).not.toBeNull();
    let parent = popupRoot!.parentElement;
    while (parent && !parent.dataset.testid) {
      expect(parent.className).not.toContain('overflow-hidden');
      parent = parent.parentElement;
    }
  });

  it('keeps the selected account address below the address filter after clicking next/prev arrows', () => {
    const { rerenderModal } = renderModal();

    // Click the next arrow (button right after the active label button in CarouselFilter)
    const labelButton = screen.getByRole('button', { name: esCommon.nav.all_accounts });
    const nextArrow = labelButton.nextElementSibling as HTMLButtonElement;
    fireEvent.click(nextArrow);

    expect(mockSetSelectedAddresses).toHaveBeenCalledWith([MOCK_ACCOUNTS[0].address]);
    rerenderModal();

    const filterHeading = screen.getByText(esCommon.nav.filter_addresses);
    const addressText = screen.getByText(MOCK_ACCOUNTS[0].address);

    // Filter heading must precede the account address in DOM order
    expect(
      filterHeading.compareDocumentPosition(addressText) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('shows staking controls and cart mode even when the account has no existing stakes', () => {
    mockSelectedAddresses = [MOCK_ACCOUNTS[0].address];
    renderModal();

    const stakingTitleBase =
      dashboardExploradorEs.dashboard.transactions.account_summary.staking_validators_title;

    // Staking section is rendered even with 0 delegations
    expect(screen.getByText(`${stakingTitleBase} (0)`)).toBeInTheDocument();

    // Open validator selector popup and add Alpha Validator
    const validatorTrigger = screen.getByRole('button', { name: /Alpha Validator/i });
    fireEvent.click(validatorTrigger);

    // Select Alpha Validator in the popup and click Add
    const validatorRow = screen.getByRole('button', { name: 'Alpha Validator', pressed: false });
    fireEvent.click(validatorRow);
    const addButton = screen.getByRole('button', { name: /Add|Añadir/i });
    fireEvent.click(addButton);

    // Now Alpha Validator row appears with Stake input & cart mode controls
    expect(screen.getByText(`${stakingTitleBase} (1)`)).toBeInTheDocument();
    expect(screen.getByText('validator_rdx1alpha000000000000000000000000000000000000')).toBeInTheDocument();

    // Enter an amount in both the batch input and the validator row input
    const amountInputs = screen.getAllByRole('spinbutton');
    const batchInput = amountInputs[0];
    const validatorInput = amountInputs[amountInputs.length - 1];
    fireEvent.change(batchInput, { target: { value: '50' } });
    fireEvent.change(validatorInput, { target: { value: '50' } });

    // With 0 XRD staked, every Unstake button (batch and per-validator) must stay disabled
    const unstakeButtons = screen.getAllByRole('button', { name: 'Unstake' });
    expect(unstakeButtons.length).toBeGreaterThanOrEqual(2);
    for (const btn of unstakeButtons) {
      expect(btn).toBeDisabled();
    }

    const stakingButton = screen.getByRole('button', { name: 'Staking' });
    fireEvent.click(stakingButton);

    // Cart mode operation summary & Send to wallet button appear
    expect(
      screen.getByText(
        dashboardExploradorEs.dashboard.transactions.account_summary.info_modal_title_operations,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/50 XRD/)).toBeInTheDocument();
  });

  it('disables Unstake when stake is sub-cent dust that renders as 0 XRD', () => {
    mockSelectedAddresses = [MOCK_ACCOUNTS[0].address];
    mockStakingRows = [
      {
        validatorName: 'Alpha Validator',
        validatorIcon: '',
        validatorAddress: 'validator_rdx1alpha000000000000000000000000000000000000',
        xrdInStake: 0.0004,
        xrdInUnstake: 0,
        xrdInClaim: 0,
        unstakes: [],
      },
    ];
    renderModal();

    const amountInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(amountInputs[0], { target: { value: '10' } });
    fireEvent.change(amountInputs[amountInputs.length - 1], { target: { value: '10' } });

    const unstakeButtons = screen.getAllByRole('button', { name: 'Unstake' });
    expect(unstakeButtons.length).toBeGreaterThanOrEqual(2);
    for (const btn of unstakeButtons) {
      expect(btn).toBeDisabled();
    }
  });
});
