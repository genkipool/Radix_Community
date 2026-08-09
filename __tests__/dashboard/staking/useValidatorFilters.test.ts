import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useValidatorFilters } from '@/features/dashboard/staking/hooks/useValidatorFilters';
import { type Validator } from '@/types/radix';

describe('useValidatorFilters', () => {
  const mockValidator = (id: string, status: 'active' | 'inactive', fee: number, apy: number, stake: number): Validator => ({
    id,
    name: `Validator ${id}`,
    address: `validator_rdx${id}`,
    status,
    nominalFee: fee,
    apy,
    totalStakeXRD: stake,
    recentUptime: 99,
    tags: [],
    // ... other required fields with dummy data
    website: '',
    lsuResource: '',
    publicKey: '',
    externalStakeAccepted: true,
    registered: true,
    protocolUpdateVote: '',
    recentProposalsMissed: 0,
    recentProposalsMade: 0,
    totalProposalsMissed: 0,
    totalProposalsMade: 0,
    totalUptime: 99,
    startOfLiveProposalsMade: 0,
    startOfLiveProposalsMissed: 0,
    serverLiveProposalsMade: 0,
    serverLiveProposalsMissed: 0,
    rank: 1,
    delegators: 10,
    delegatedStake: stake,
    delegatedStakePercent: 1,
    ownerDelegation: 0,
    ownerAddress: '',
    lsu2xrdFactor: 1,
    apyProjection: apy,
    effectiveFee: fee,
    onlineStatus: true,
    acceptsConnect: true,
    provider: '',
    providerPercent: 0,
    country: '',
    countryPercent: 0,
    countryCode: '',
    version: '',
    commit: '',
    epochPerformance: [],
    feePercent: fee,
    uptimePercent: 99,
    ownerStake: 0,
    proposalsMade: 0,
    proposalsMissed: 0
  });

  const validators: Validator[] = [
    mockValidator('1', 'active', 1, 5, 1000),
    mockValidator('2', 'inactive', 5, 2, 500),
    mockValidator('3', 'active', 0.5, 6, 2000),
  ];

  const baseOptions = {
    validators,
    searchQuery: '',
    sortMode: 'random' as const,
    network: 'mainnet' as const,
    activeView: 'staking' as const,
    randomSeed: 123,
    activeTags: [] as string[],
  };

  it('filters by "Active" tag', () => {
    const { result } = renderHook(() => useValidatorFilters({
      ...baseOptions,
      activeTags: ['Active'],
    }));
    expect(result.current.filtered).toHaveLength(2);
    expect(result.current.filtered.every(v => v.status === 'active')).toBe(true);
  });

  it('filters by "Inactive" tag', () => {
    const { result } = renderHook(() => useValidatorFilters({
      ...baseOptions,
      activeTags: ['Inactive'],
    }));
    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].id).toBe('2');
  });

  it('combines "Active" and "Inactive" using OR logic', () => {
    const { result } = renderHook(() => useValidatorFilters({
      ...baseOptions,
      activeTags: ['Active', 'Inactive'],
    }));
    // Should show all as some are active and some are inactive
    expect(result.current.filtered).toHaveLength(3);
  });

  it('combines "Active" and "Low Fee" using AND logic', () => {
    const { result } = renderHook(() => useValidatorFilters({
      ...baseOptions,
      activeTags: ['Active', 'Low Fee'],
    }));
    // Both active validators have fee <= 2, so both should show
    expect(result.current.filtered).toHaveLength(2);
  });

  it('sorts by APY (newest/date)', () => {
    const { result } = renderHook(() => useValidatorFilters({
      ...baseOptions,
      activeTags: ['All'],
      sortMode: 'date',
    }));
    // APYs are 5, 2, 6. Sorted desc: 6, 5, 2
    expect(result.current.filtered[0].id).toBe('3');
    expect(result.current.filtered[1].id).toBe('1');
    expect(result.current.filtered[2].id).toBe('2');
  });

  /**
   * The wallet filter and the search are two halves of one answer, and the
   * grid renders whatever pair it is handed. Handing it a pair from two
   * different moments — the search already cleared, the wallet filter not yet
   * back on — is what flashed the whole network for a frame between clearing
   * the box and the wallet's own validators returning. These pin down what
   * each pair means, so the caller has something to be consistent WITH.
   */
  describe('the wallet filter', () => {
    it('keeps only the wallet\'s validators', () => {
      const { result } = renderHook(() => useValidatorFilters({
        ...baseOptions,
        isWalletFilterActive: true,
        pinnedValidatorAddresses: ['validator_rdx2'],
      }));
      expect(result.current.filtered.map(v => v.id)).toEqual(['2']);
    });

    it('shows nothing rather than everything when the wallet stakes nowhere', () => {
      const { result } = renderHook(() => useValidatorFilters({
        ...baseOptions,
        isWalletFilterActive: true,
        pinnedValidatorAddresses: [],
      }));
      expect(result.current.filtered).toHaveLength(0);
    });

    it('is what a cleared search must come back to, in the same pass', () => {
      // The state right after the x is pressed: no search term, filter on.
      const { result } = renderHook(() => useValidatorFilters({
        ...baseOptions,
        searchQuery: '',
        isWalletFilterActive: true,
        pinnedValidatorAddresses: ['validator_rdx2'],
      }));
      expect(result.current.filtered.map(v => v.id)).toEqual(['2']);

      // The pair that used to appear for one render in between: search gone,
      // filter still off. It shows the whole network, which is why the two
      // values must never be read from different renders.
      const { result: mismatched } = renderHook(() => useValidatorFilters({
        ...baseOptions,
        searchQuery: '',
        isWalletFilterActive: false,
        pinnedValidatorAddresses: ['validator_rdx2'],
      }));
      expect(mismatched.current.filtered.length).toBeGreaterThan(1);
    });
  });
});
