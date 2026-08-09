/**
 * The wallet's accounts on a GIVEN ledger, which is not always the ledger the
 * wallet itself is pointed at.
 *
 * The context's `accounts` is `sessions[activeNetwork]` — whichever ledger the
 * wallet is on. The dashboard reads stakes for the ledger the PAGE is showing,
 * and during a switch those are two different things, so taking `accounts` put
 * the whole wallet round trip on the critical path: the click had to reach the
 * provider, the provider had to change its own network, and only then could the
 * read even start. Both sessions are held at once, so the accounts for either
 * ledger are known without waiting for any of that — which is also what makes
 * it possible to warm the other ledger's stakes before the switch happens.
 *
 * The addresses themselves are ledger-specific (`account_rdx…` against
 * `account_tdx_2_…`), so asking for one ledger's accounts on the other returns
 * nothing at all. That is the read the old code was making.
 */
import type { NetworkSessions } from '@/features/wallet/types/wallet';
import type { Network } from '@/features/dashboard/types';

export interface WalletAccountsInput {
  /** Which ledger the accounts are wanted for. */
  network: Network;
  sessions: NetworkSessions | undefined;
  /** The ledger the wallet itself is pointed at; the selection belongs to it. */
  activeNetwork: string | undefined;
  selectedAccountAddresses: string[];
  /** The ledger this page was rendered for, which the server's seed matches. */
  pageNetwork: Network;
  initialIsWalletConnected: boolean;
  /** Seeded by the server from the session cookie, for `pageNetwork` only. */
  initialConnectedAccounts: string[];
}

export function walletAccountsForNetwork({
  network,
  sessions,
  activeNetwork,
  selectedAccountAddresses,
  pageNetwork,
  initialIsWalletConnected,
  initialConnectedAccounts,
}: WalletAccountsInput): string[] {
  const session = sessions?.[network as 'mainnet' | 'stokenet'];

  if (session?.accounts?.length) {
    // Picking specific accounts is a choice made against the ledger the wallet
    // is on; it says nothing about the other one.
    if (network === activeNetwork && selectedAccountAddresses.length > 0) {
      return selectedAccountAddresses;
    }
    return session.accounts.map((account) => account.address);
  }

  // Before the provider restores its sessions — the first renders, including
  // the one that has to match the server's HTML — its own seed is all there is,
  // and it describes the ledger this page was rendered for.
  if (network === pageNetwork && initialIsWalletConnected) {
    return initialConnectedAccounts;
  }

  return [];
}
