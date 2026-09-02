'use client';

import React, { createContext, use, useState } from 'react';
import { useStakingTransaction } from '../hooks/useStakingTransaction';
import {
    PROTOCOL_UPDATE_SIGNAL,
    PROTOCOL_UPDATE_NAME,
    PROTOCOL_UPDATE_TARGET_ENABLED,
} from '../constants/protocolUpdate';

interface VoteTargetValidator {
    address: string;
    ownerBadge?: string;
}

interface ProtocolVoteContextValue {
    /** A valid 32-char target is configured (env). */
    enabled: boolean;
    /** The exact protocol version name signalled on-ledger. */
    signal: string;
    /** Human-friendly label for the target. */
    name: string;
    /** Whether the connected wallet owns this validator (can sign the vote). */
    canVote: (validatorAddress: string) => boolean;
    /** Optimistic flag: the vote tx for this validator was just accepted. */
    hasJustVoted: (validatorAddress: string) => boolean;
    /** Address of the validator whose vote is currently in flight, if any. */
    votingAddress: string | null;
    /** Send the signal_protocol_update_readiness transaction to the wallet. */
    vote: (validator: VoteTargetValidator) => Promise<void>;
    error: string | null;
}

const ProtocolVoteContext = createContext<ProtocolVoteContextValue | undefined>(undefined);

/**
 * Optional consumer. Returns `undefined` outside a provider, so presentational
 * badges (e.g. the explorer detail view) keep working in display-only mode.
 */
export const useProtocolVote = () => use(ProtocolVoteContext);

export const ProtocolVoteProvider = ({
    ownerValidatorMap,
    children,
}: {
    /** validator address → connected account that owns it. */
    ownerValidatorMap: Record<string, string>;
    children: React.ReactNode;
}) => {
    const { submitProtocolVote, isTransacting, error } = useStakingTransaction();
    const [votingAddress, setVotingAddress] = useState<string | null>(null);
    const [justVoted, setJustVoted] = useState<Set<string>>(() => new Set());

    const canVote = (addr: string) => PROTOCOL_UPDATE_TARGET_ENABLED && !!ownerValidatorMap[addr];

    const vote = async (validator: VoteTargetValidator) => {
        if (!PROTOCOL_UPDATE_TARGET_ENABLED || isTransacting) return;
        const account = ownerValidatorMap[validator.address];
        if (!account || !validator.ownerBadge) return;

        setVotingAddress(validator.address);
        const hash = await submitProtocolVote(
            account,
            validator.address,
            validator.ownerBadge,
            PROTOCOL_UPDATE_SIGNAL,
        );
        if (hash) {
            setJustVoted(prev => {
                const next = new Set(prev);
                next.add(validator.address);
                return next;
            });
        }
        setVotingAddress(null);
    };

    const value: ProtocolVoteContextValue = {
        enabled: PROTOCOL_UPDATE_TARGET_ENABLED,
        signal: PROTOCOL_UPDATE_SIGNAL,
        name: PROTOCOL_UPDATE_NAME,
        canVote,
        hasJustVoted: (addr: string) => justVoted.has(addr),
        votingAddress,
        vote,
        error,
    };

    return <ProtocolVoteContext.Provider value={value}>{children}</ProtocolVoteContext.Provider>;
};
