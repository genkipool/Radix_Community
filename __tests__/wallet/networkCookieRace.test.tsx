/**
 * The cookie must never outrank a ledger somebody asked for.
 *
 * `RadixWalletProvider` restores the last-used network from the
 * `radix_active_network` cookie in a `setTimeout(0)` on mount — which lands
 * AFTER the effects of everything below it, including a page that opens on the
 * ledger its own URL names. So the cookie got the last word, and a link like
 * `/dashboard/validator/validator_tdx_2_1…?network=stokenet` was pulled onto
 * Mainnet a tick after it appeared: the dashboard saw the wallet's network
 * change under it and followed, landing on `/dashboard/staking?network=mainnet`
 * with the validator gone.
 *
 * These render the real provider, because the race is in the timing, and timing
 * is exactly what a re-description of the rule cannot check. The companion test
 * for the other half — what the dashboard does with what the wallet reports —
 * is `__tests__/dashboard/networkSync.test.ts`.
 */
import React, { useEffect, useRef } from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// The toolkit talks to the wallet extension; none of that is under test here,
// and `null` is a shape the provider already handles (no extension present).
vi.mock('@/features/wallet/lib/radix-toolkit', () => ({
  getOrCreateToolkit: () => null,
  disconnectToolkit: () => {},
  destroyToolkit: () => {},
}));

import { RadixWalletProvider } from '@/features/wallet/context/RadixWalletProvider';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';

type Net = 'mainnet' | 'stokenet';

/** Shows the ledger the wallet context currently reports. */
function ActiveNetwork() {
  const { activeNetwork } = useRadixWallet();
  return <span data-testid="active">{activeNetwork}</span>;
}

/**
 * A page that names its ledger, the way the dashboard does: it asks the wallet
 * for its own network once, on mount, and that ask is what has to survive.
 */
function PageOnNetwork({ network }: { network: Net }) {
  const { switchNetwork } = useRadixWallet();
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    switchNetwork(network);
  }, [network, switchNetwork]);
  return <ActiveNetwork />;
}

function setCookie(value: string | null) {
  document.cookie = value
    ? `radix_active_network=${value}; path=/`
    : 'radix_active_network=; path=/; max-age=0';
}

/** Mounts, then lets the provider's deferred cookie restore actually run. */
function renderAndSettle(ui: React.ReactElement) {
  render(ui);
  act(() => {
    vi.runAllTimers();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  setCookie(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the wallet provider’s network, cookie vs. choice', () => {
  it('keeps the ledger a page asked for, against a cookie that says otherwise', () => {
    // THE regression: last visit left "mainnet" behind; this page is Stokenet.
    setCookie('mainnet');
    renderAndSettle(
      <RadixWalletProvider initialSession={null} initialNetwork="mainnet">
        <PageOnNetwork network="stokenet" />
      </RadixWalletProvider>,
    );
    expect(screen.getByTestId('active')).toHaveTextContent('stokenet');
  });

  it('keeps it the other way round too', () => {
    // The mirror image, which the first fix for this missed: a Mainnet link
    // opened after a Stokenet visit.
    setCookie('stokenet');
    renderAndSettle(
      <RadixWalletProvider initialSession={null} initialNetwork="stokenet">
        <PageOnNetwork network="mainnet" />
      </RadixWalletProvider>,
    );
    expect(screen.getByTestId('active')).toHaveTextContent('mainnet');
  });

  it('holds even when the page asks for the ledger already on screen', () => {
    // Asking is what claims the choice. When the two happened to agree, an
    // earlier version stayed quiet — and the cookie was then free to assert the
    // other ledger, which the dashboard read as a deliberate switch.
    setCookie('stokenet');
    renderAndSettle(
      <RadixWalletProvider initialSession={null} initialNetwork="mainnet">
        <PageOnNetwork network="mainnet" />
      </RadixWalletProvider>,
    );
    expect(screen.getByTestId('active')).toHaveTextContent('mainnet');
  });

  it('still restores the cookie when nobody has chosen anything', () => {
    // The guard must not cost the feature: on a page that names no ledger, the
    // last-used one is still what comes back.
    setCookie('stokenet');
    renderAndSettle(
      <RadixWalletProvider initialSession={null} initialNetwork={null}>
        <ActiveNetwork />
      </RadixWalletProvider>,
    );
    expect(screen.getByTestId('active')).toHaveTextContent('stokenet');
  });

  it('lets a later choice move the wallet, once the page has claimed one', () => {
    // The wallet popover and the profile modal go through the same call, and
    // they must keep working for the rest of the session.
    function PageThenPopover() {
      const { activeNetwork, switchNetwork } = useRadixWallet();
      const asked = useRef(false);
      useEffect(() => {
        if (asked.current) return;
        asked.current = true;
        switchNetwork('stokenet');
      }, [switchNetwork]);
      return (
        <>
          <span data-testid="active">{activeNetwork}</span>
          <button type="button" onClick={() => switchNetwork('mainnet')}>
            pick mainnet
          </button>
        </>
      );
    }

    setCookie('mainnet');
    renderAndSettle(
      <RadixWalletProvider initialSession={null} initialNetwork="mainnet">
        <PageThenPopover />
      </RadixWalletProvider>,
    );
    expect(screen.getByTestId('active')).toHaveTextContent('stokenet');

    act(() => {
      screen.getByRole('button', { name: 'pick mainnet' }).click();
      vi.runAllTimers();
    });
    expect(screen.getByTestId('active')).toHaveTextContent('mainnet');
  });
});
