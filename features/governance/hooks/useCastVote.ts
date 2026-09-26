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
import { useAccountVote, accountVoteKey } from './useAccountVote';

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
    const [chosenAccount, setChosenAccount] = useState<string | null>(null);
    const account = wallet.accounts.some(a => a.address === chosenAccount) ? chosenAccount : wallet.accounts[0]?.address ?? null;
    const currentVote = useAccountVote(item.votersStore, kind, account, system.network);
    const [picked, setPicked] = useState<string[]>([]);
    const tx = useConsoleTransaction();

    const phase = votingPhase(item, now);
    const onNetwork = wallet.activeNetwork === system.network;
    const maxPick = kind === 'temperature_check' ? 1 : Math.max(1, item.maxSelections);
    const current = currentVote.data ?? null;
    const currentText = current
        ? (current.type === 'stance' ? selectedLabels(current, item).map(stanceLabel) : selectedLabels(current, item)).join(', ')
        : null;
    /** The ballot can be used right now by this reader. */
    const canVote = phase === 'open' && wallet.isConnected && onNetwork && !!account;

    const toggle = (key: string) => {
        if (!canVote) return;
        tx.reset();
        setPicked(prev => {
            if (maxPick === 1) return [key];
            if (prev.includes(key)) return prev.filter(k => k !== key);
            return prev.length < maxPick ? [...prev, key] : prev;
        });
    };

    const selectAccount = (address: string) => { setChosenAccount(address); setPicked([]); tx.reset(); };

    const submit = async () => {
        if (!account || picked.length === 0) return;
        const selection: VoteSelection = kind === 'temperature_check'
            ? { type: 'stance', stance: picked[0] }
            : { type: 'options', optionIds: picked.map(Number) };
        const manifest = buildVoteManifest({ component: system.component, kind, itemId: id, account, selection });
        const result = await tx.sendTransaction(manifest);
        if (result) {
            setPicked([]);
            await queryClient.invalidateQueries({ queryKey: accountVoteKey(item.votersStore, account) });
            await queryClient.invalidateQueries({ queryKey: ['governance-tally', system.component, kind, id] });
        }
    };

    return {
        phase, canVote, maxPick, picked, toggle, submit, tx,
        account, selectAccount, accounts: wallet.accounts,
        isConnected: wallet.isConnected, isLoading: wallet.isLoading, onNetwork,
        connect: () => wallet.connect(RadixNetworkId.Mainnet),
        current, currentText, currentLoading: currentVote.isLoading,
    };
}

export type CastVote = ReturnType<typeof useCastVote>;
