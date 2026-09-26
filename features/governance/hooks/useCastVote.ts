'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { useConsoleTransaction } from '@/features/console/hooks/useConsoleTransaction';
import type { GovernanceSystem } from '../config/systems';
import type { GovernanceEntry } from '../types';
import { selectedLabels, votingPhase, type VoteSelection } from '../lib/governanceVotes';
import { buildVoteManifest } from '../lib/voteManifest';
import { useAccountVotes, accountVoteKey } from './useAccountVote';

/**
 * Everything needed to cast a vote from any part of the page: wallet and
 * account, the account's current vote, the choice being made, and sending
 * the transaction. The ballot UI (a list in the side panel, the result bars)
 * only renders it.
 */
export function useCastVote(entry: GovernanceEntry, system: GovernanceSystem, now: number, stanceLabel: (s: string) => string) {
    const { item, kind, id } = entry;
    const queryClient = useQueryClient();
    const wallet = useRadixWallet();
    // Accounts that vote; the first shared account until the reader picks.
    const [chosen, setChosen] = useState<string[] | null>(null);
    const available = wallet.accounts.map(a => a.address);
    const selectedAccounts = (chosen ?? available.slice(0, 1)).filter(a => available.includes(a));
    const currentVotes = useAccountVotes(item.votersStore, kind, selectedAccounts, system.network);
    const [picked, setPicked] = useState<string[]>([]);
    const tx = useConsoleTransaction();

    const phase = votingPhase(item, now);
    const onNetwork = wallet.activeNetwork === system.network;
    const maxPick = kind === 'temperature_check' ? 1 : Math.max(1, item.maxSelections);
    const describe = (selection: VoteSelection) =>
        (selection.type === 'stance' ? selectedLabels(selection, item).map(stanceLabel) : selectedLabels(selection, item)).join(', ');
    /** Current vote of each selected account (null when it has not voted). */
    const current = currentVotes.votes.map(v => ({ account: v.account, selection: v.selection, text: v.selection ? describe(v.selection) : null }));
    const anyVoted = current.some(v => v.selection);
    /** The ballot can be used right now by this reader. */
    const canVote = phase === 'open' && wallet.isConnected && onNetwork && available.length > 0;

    const toggle = (key: string) => {
        if (!canVote) return;
        tx.reset();
        setPicked(prev => {
            if (maxPick === 1) return [key];
            if (prev.includes(key)) return prev.filter(k => k !== key);
            return prev.length < maxPick ? [...prev, key] : prev;
        });
    };

    const setAccounts = (next: string[]) => { setChosen(next); tx.reset(); };
    const toggleAccount = (address: string) =>
        setAccounts(selectedAccounts.includes(address) ? selectedAccounts.filter(a => a !== address) : [...selectedAccounts, address]);

    const submit = async () => {
        if (selectedAccounts.length === 0 || picked.length === 0) return;
        const selection: VoteSelection = kind === 'temperature_check'
            ? { type: 'stance', stance: picked[0] }
            : { type: 'options', optionIds: picked.map(Number) };
        const manifest = buildVoteManifest({ component: system.component, kind, itemId: id, accounts: selectedAccounts, selection });
        const result = await tx.sendTransaction(manifest);
        if (result) {
            setPicked([]);
            await Promise.all(selectedAccounts.map(a => queryClient.invalidateQueries({ queryKey: accountVoteKey(item.votersStore, a) })));
            await queryClient.invalidateQueries({ queryKey: ['governance-tally', system.component, kind, id] });
        }
    };

    return {
        phase, canVote, maxPick, picked, toggle, submit, tx,
        accounts: wallet.accounts, selectedAccounts, toggleAccount, setAccounts,
        isConnected: wallet.isConnected, isLoading: wallet.isLoading, onNetwork,
        connect: () => wallet.connect(RadixNetworkId.Mainnet),
        current, anyVoted, currentLoading: currentVotes.isLoading,
    };
}

export type CastVote = ReturnType<typeof useCastVote>;
