import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { withRetry } from '@/services/gateway/client';
import { gatewayPost } from '@/services/gateway/bases';
import { extractGovernanceVotes, selectionKeys, type GovernanceItemKind } from '../lib/governanceVotes';
import type { GatewayEvent } from '@/features/dashboard/types';
import type { GovernanceSystem } from '../config/systems';
import type { VoteHistoryEntry } from '../types';

/** One account's current vote on an item, as recorded on the ledger. */
export interface VoteRecord {
    account: string;
    /** Ballot keys picked: option ids ("0") or a stance ("For"). */
    choices: string[];
    voteId: number;
    txid: string;
    /** ISO timestamp of the transaction. */
    time: string;
    /** How many times this account voted on the item (1 = never changed). */
    votes: number;
    /** Per-candidate Majority Judgment grades (candidate id -> 0..4), when `kind === 'election'`. */
    grades?: Record<string, number>;
    /** Full chronological vote history (original -> ... -> latest), present when `votes > 1`. */
    history?: VoteHistoryEntry[];
}

const PAGE_LIMIT = 100;
const MAX_PAGES = 200;

interface StreamPage {
    items?: Array<{ intent_hash?: string; confirmed_at?: string; receipt?: { events?: GatewayEvent[] } }>;
    next_cursor?: string | null;
}

/**
 * Every vote cast on one proposal or temperature check, read from the
 * governance component's transactions between the item's start and deadline,
 * reduced to each account's latest vote. A closed item never changes, so it is
 * cached for good; an open one for a couple of minutes.
 */
export async function fetchVoteRecords(
    system: GovernanceSystem,
    kind: GovernanceItemKind,
    itemId: string,
    window: { start: number | null; deadline: number | null; closed: boolean },
): Promise<VoteRecord[]> {
    'use cache';
    // A closed vote can no longer change; weeks is the longest built-in profile.
    if (window.closed) cacheLife('weeks'); else cacheLife('minutes');
    cacheTag('governance-votes', `governance-votes-${system.key}-${kind}-${itemId}`);

    const byAccount = new Map<string, VoteHistoryEntry[]>();
    let cursor: string | null | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
        const body: Record<string, unknown> = {
            limit_per_page: PAGE_LIMIT,
            order: 'Asc',
            event_global_emitters_filter: [system.component],
            opt_ins: { receipt_events: true },
            ...(window.start ? { from_ledger_state: { timestamp: new Date(window.start * 1000).toISOString() } } : {}),
            ...(window.closed && window.deadline ? { at_ledger_state: { timestamp: new Date((window.deadline + 60) * 1000).toISOString() } } : {}),
            ...(cursor ? { cursor } : {}),
        };
        const res = await withRetry(() => gatewayPost<StreamPage>(system.network, '/stream/transactions', body));

        for (const tx of res.items ?? []) {
            if (!tx.intent_hash || !tx.confirmed_at) continue;
            for (const vote of extractGovernanceVotes(tx.receipt?.events ?? [])) {
                if (vote.component !== system.component || vote.kind !== kind || vote.itemId !== itemId || !vote.account) continue;
                const entry: VoteHistoryEntry = {
                    choices: selectionKeys(vote.selection),
                    voteId: Number(vote.voteId ?? -1),
                    txid: tx.intent_hash,
                    time: tx.confirmed_at,
                    ...(vote.grades ? { grades: vote.grades } : {}),
                };
                const list = byAccount.get(vote.account);
                if (list) list.push(entry);
                else byAccount.set(vote.account, [entry]);
            }
        }
        cursor = res.next_cursor;
        if (!cursor) break;
    }

    const records: VoteRecord[] = [];
    for (const [account, entries] of byAccount) {
        entries.sort((a, b) => a.voteId - b.voteId);
        const latest = entries[entries.length - 1];
        records.push({
            account,
            choices: latest.choices,
            voteId: latest.voteId,
            txid: latest.txid,
            time: latest.time,
            votes: entries.length,
            ...(latest.grades ? { grades: latest.grades } : {}),
            ...(entries.length > 1 ? { history: entries } : {}),
        });
    }
    return records;
}
