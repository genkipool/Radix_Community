/**
 * Which of the wallet's accounts the dashboard reads stakes for.
 *
 * The wallet context exposes `accounts` for whichever ledger the WALLET is on.
 * The page reads stakes for the ledger it is SHOWING, and during a switch those
 * are two different things — so taking `accounts` meant nothing could be read
 * until the provider had finished changing its own network, and warming the
 * other ledger ahead of a switch was impossible. Worse, the addresses are
 * ledger-specific, so one ledger's accounts asked for on the other come back
 * empty: the warming that was supposed to make the switch instant was filling
 * cache entries nobody would ever read.
 *
 * Both sessions are held at once, so this answers for either ledger without
 * waiting for anything.
 */

import { describe, expect, it } from 'vitest';
import { walletAccountsForNetwork } from '@/features/dashboard/staking/lib/walletAccounts';
import type { NetworkSessions } from '@/features/wallet/types/wallet';

const account = (address: string) => ({ address, label: '', appearanceId: 0 });

const sessions = {
    mainnet: {
        identityAddress: 'identity_rdx_1',
        personaLabel: 'me',
        accounts: [account('account_rdx_1'), account('account_rdx_2')],
    },
    stokenet: {
        identityAddress: 'identity_tdx_2_1',
        personaLabel: 'me',
        accounts: [account('account_tdx_2_1')],
    },
} as unknown as NetworkSessions;

const base = {
    sessions,
    activeNetwork: 'mainnet',
    selectedAccountAddresses: [] as string[],
    pageNetwork: 'mainnet' as const,
    initialIsWalletConnected: true,
    initialConnectedAccounts: ['account_rdx_1', 'account_rdx_2'],
};

describe('the wallet accounts a ledger is read for', () => {
    it('answers for the ledger asked about, not the one the wallet is on', () => {
        // The wallet is on Mainnet; the page is switching to Stokenet.
        expect(walletAccountsForNetwork({ ...base, network: 'stokenet' }))
            .toEqual(['account_tdx_2_1']);
    });

    it('answers for the wallet\'s own ledger too', () => {
        expect(walletAccountsForNetwork({ ...base, network: 'mainnet' }))
            .toEqual(['account_rdx_1', 'account_rdx_2']);
    });

    it('applies a selection only to the ledger it was made on', () => {
        const withSelection = { ...base, selectedAccountAddresses: ['account_rdx_2'] };

        expect(walletAccountsForNetwork({ ...withSelection, network: 'mainnet' }))
            .toEqual(['account_rdx_2']);
        // Picking accounts on Mainnet says nothing about Stokenet.
        expect(walletAccountsForNetwork({ ...withSelection, network: 'stokenet' }))
            .toEqual(['account_tdx_2_1']);
    });

    it('falls back to the server\'s seed before the sessions are restored', () => {
        // The first renders, including the one that has to match the server's
        // HTML: the provider has not restored anything yet.
        expect(walletAccountsForNetwork({ ...base, sessions: undefined, network: 'mainnet' }))
            .toEqual(['account_rdx_1', 'account_rdx_2']);
    });

    it('does not lend that seed to the other ledger', () => {
        // It describes the ledger the page was rendered for. Handing it over
        // would ask for Mainnet addresses on Stokenet, which resolve to nothing.
        expect(walletAccountsForNetwork({ ...base, sessions: undefined, network: 'stokenet' }))
            .toEqual([]);
    });

    it('reports none when there is no wallet on that ledger', () => {
        const onlyMainnet = { mainnet: sessions.mainnet, stokenet: null } as NetworkSessions;
        expect(walletAccountsForNetwork({
            ...base, sessions: onlyMainnet, network: 'stokenet',
        })).toEqual([]);
    });

    it('reports none when no wallet is connected at all', () => {
        expect(walletAccountsForNetwork({
            ...base, sessions: undefined, initialIsWalletConnected: false, network: 'mainnet',
        })).toEqual([]);
    });
});
