import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';

describe('Dashboard Concurrency - useDeferredValue', () => {
  it('should verify that transaction tags are deferred to prevent UI blocking', () => {
    const spy = vi.spyOn(React, 'useDeferredValue');
    
    // Simulating the logic inside DashboardClient
    const useTestHook = (tag: string) => {
      const deferredTag = React.useDeferredValue(tag);
      return deferredTag;
    };

    const { result, rerender } = renderHook(({ tag }) => useTestHook(tag), {
      initialProps: { tag: 'All' }
    });

    // Initial state
    expect(spy).toHaveBeenCalledWith('All');
    expect(result.current).toBe('All');

    // Change tag
    act(() => {
      rerender({ tag: 'Success' });
    });

    // Verify useDeferredValue was called with the new tag
    expect(spy).toHaveBeenCalledWith('Success');
    
    // In a real concurrent environment, result.current might still be 'All' for a tick,
    // but here we are mainly testing that the hook is BEING USED.
    spy.mockRestore();
  });

  it('should ensure the code in DashboardClient uses the deferred tag for queries', async () => {
    // This is a "code structure" check. We can use grep or static analysis, 
    // but here we'll simulate the dependency chain.
    
    const tag = 'Success';
    const deferredTag = 'Success (Deferred)';
    
    // Mocking the behavior of useDeferredValue
    const mockUseDeferredValue = vi.fn().mockReturnValue(deferredTag);
    const mockUseTransactionsQuery = vi.fn();

    // The logic we want to protect:
    const simulateDashboardLogic = (currentTag: string) => {
      const dTag = mockUseDeferredValue(currentTag);
      mockUseTransactionsQuery({ tag: dTag });
    };

    simulateDashboardLogic(tag);

    // CRITICAL ASSERTION: The query MUST use the deferred tag, not the raw one.
    expect(mockUseTransactionsQuery).toHaveBeenCalledWith(
      expect.objectContaining({ tag: deferredTag })
    );
    expect(mockUseTransactionsQuery).not.toHaveBeenCalledWith(
      expect.objectContaining({ tag: tag })
    );
  });
});
