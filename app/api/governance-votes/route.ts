import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { validateAddress } from '@/utils/apiValidation';
import { systemByComponent, type GovernanceSystem } from '@/features/governance/config/systems';
import { fetchAccountVotingPowers, fetchVoteTally, type CollectorItemType } from '@/features/governance/services/voteCollector.server';
import { fetchVoteRecords } from '@/features/governance/services/voteRecords.server';
import { fetchGovernanceEntry } from '@/features/governance/services/governanceLedger.server';
import { votingPhase } from '@/features/governance/lib/governanceVotes';
import type { VoterRow } from '@/features/governance/types';

const TYPES: readonly CollectorItemType[] = ['proposal', 'temperature_check', 'election'];
const NO_STORE = { 'Cache-Control': 'no-cache, private, max-age=0, must-revalidate' };

/**
 * GET /api/governance-votes?component=…&type=proposal|temperature_check&id=…[&account=…][&voters=1]
 *
 * Weighted tally of a governance vote from that system's vote collector.
 * `account` adds that account's voting power. `voters=1` adds every voter:
 * their current choice, transaction and time from the ledger, joined with the
 * voting power the collector gives them.
 */
export async function GET(request: NextRequest) {
    const params = new URL(request.url).searchParams;
    const component = validateAddress(params.get('component'));
    const type = params.get('type') as CollectorItemType | null;
    const id = params.get('id') ?? '';
    const account = params.get('account') ? validateAddress(params.get('account')) : null;
    const withVoters = params.get('voters') === '1';

    if (!component || !type || !TYPES.includes(type) || !/^\d{1,19}$/.test(id)) {
        return NextResponse.json(null, { status: 400, headers: NO_STORE });
    }
    const system = systemByComponent(component);
    // A governance component that is not listed is not an error: there is just no tally.
    if (!system) return NextResponse.json(null, { headers: NO_STORE });

    try {
        const [tally, voterData] = await Promise.all([
            fetchVoteTally(component, type, id, { account, withVoters }).catch(err => {
                logger.warn({ err }, 'Vote collector unavailable for %s %s #%s', system.key, type, id);
                return null;
            }),
            withVoters ? loadVoters(system, type, id) : Promise.resolve(null),
        ]);

        const voters = voterData?.rows ?? null;
        const closed = voterData?.closed ?? false;

        let rows: VoterRow[] | null = null;
        let accountPower = tally?.accountPower ?? null;
        if (voters) {
            const power = new Map<string, string>();
            for (const v of tally?.accountVotes ?? []) if (!power.has(v.account)) power.set(v.account, v.votePower);
            if (type === 'election' && voters.length > 0) {
                const missing = voters.map(r => r.account).filter(a => !power.has(a));
                const fetched = await fetchAccountVotingPowers(component, missing);
                for (const [acc, vp] of fetched) power.set(acc, vp);
            }
            rows = voters.map(r => ({ ...r, votePower: power.get(r.account) ?? null }));
            if (account && accountPower == null && power.has(account)) {
                accountPower = power.get(account) ?? null;
            }
        } else if (type === 'election' && account && accountPower == null) {
            const fetched = await fetchAccountVotingPowers(component, [account]);
            accountPower = fetched.get(account) ?? null;
        }

        const missingRequestedPower = (Boolean(account) && accountPower == null)
            || (withVoters && (rows?.some(r => r.votePower === null) ?? true));

        // Closed votes with complete power never change: cache longer at the edge CDN.
        const cacheControl = closed
            ? 'public, s-maxage=86400, stale-while-revalidate=604800'
            : 'public, s-maxage=60, stale-while-revalidate=300';

        return NextResponse.json(
            tally || rows ? {
                results: tally?.results ?? [],
                accountPower,
                voters: rows,
                source: tally?.source ?? null,
                ...(tally?.electionData ? { electionData: tally.electionData } : {}),
            } : null,
            {
                headers: missingRequestedPower
                    ? NO_STORE
                    : { 'Cache-Control': cacheControl },
            },
        );
    } catch (error) {
        logger.warn({ err: error }, 'Governance votes unavailable for %s %s #%s', system.key, type, id);
        return NextResponse.json(null, { status: 502, headers: NO_STORE });
    }
}

async function loadVoters(system: GovernanceSystem, kind: CollectorItemType, id: string) {
    const entry = await fetchGovernanceEntry(system.key, kind, id);
    if (!entry) return null;
    const { start, deadline } = entry.item;
    const closed = votingPhase(entry.item, Date.now() / 1000) === 'closed';
    const records = await fetchVoteRecords(system, kind, id, { start, deadline, closed });
    return {
        closed,
        rows: records.map(r => ({ account: r.account, choices: r.choices, txid: r.txid, time: r.time, voteId: r.voteId, changes: r.votes - 1 })),
    };
}
