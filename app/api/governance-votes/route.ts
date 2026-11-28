import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { validateAddress } from '@/utils/apiValidation';
import { systemByComponent, type GovernanceSystem } from '@/features/governance/config/systems';
import { fetchAccountVotingPowers, fetchVoteTally, type CollectorItemType } from '@/features/governance/services/voteCollector.server';
import { fetchVoteRecords } from '@/features/governance/services/voteRecords.server';
import { fetchSnapshotVotePowers } from '@/features/governance/services/votePowerSnapshot.server';
import { decimalsAgree, isAccountAddress, sumDecimals, withDeadline } from '@/features/governance/lib/votePowerChecks';
import { fetchGovernanceEntry } from '@/features/governance/services/governanceLedger.server';
import { FRESH_VOTE_WINDOW_MS, votingPhase } from '@/features/governance/lib/governanceVotes';
import type { VoterRow } from '@/features/governance/types';

const TYPES: readonly CollectorItemType[] = ['proposal', 'temperature_check', 'election'];
/** Time the snapshot recount may take before current power stands in. */
const SNAPSHOT_BUDGET_MS = 12_000;
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
        const [tally, voterBundle] = await Promise.all([
            fetchVoteTally(component, type, id, { account, withVoters }).catch(err => {
                logger.warn({ err }, 'Vote collector unavailable for %s %s #%s', system.key, type, id);
                return null;
            }),
            withVoters ? loadVoters(system, type, id) : Promise.resolve(null),
        ]);

        const voters = voterBundle?.rows ?? null;
        const closed = voterBundle?.closed ?? false;

        // Elections: the collector publishes no per-ballot power, so each ballot is weighed
        // at round one's snapshot the way the collector does. If that fails or runs out of
        // time, current power (`/voting-power`) stands in and the response is cached briefly.
        let powerAt: 'snapshot' | 'current' | null = null;
        let shortCache = false;
        const snapshotAt = tally?.roundSnapshotAt ?? tally?.electionData?.roundSnapshotAt ?? null;
        const electionPowers = async (accounts: string[]): Promise<Map<string, string>> => {
            const eligible = accounts.length > 0 && accounts.every(a => isAccountAddress(system.network, a));
            if (snapshotAt && Date.parse(snapshotAt) < Date.now() && eligible) {
                try {
                    const controller = new AbortController();
                    const powers = await withDeadline(
                        fetchSnapshotVotePowers(system.network, snapshotAt, accounts, { signal: controller.signal }),
                        SNAPSHOT_BUDGET_MS,
                        () => controller.abort(new Error('Snapshot recount over budget')),
                    );
                    powerAt = 'snapshot';
                    return powers;
                } catch (err) {
                    logger.warn({ err }, 'Snapshot voting power failed for %s election #%s', system.key, id);
                }
            }
            powerAt = 'current';
            shortCache = true;
            return fetchAccountVotingPowers(component, accounts);
        };

        let rows: VoterRow[] | null = null;
        let accountPower = tally?.accountPower ?? null;
        if (voters) {
            const power = new Map<string, string>();
            for (const v of tally?.accountVotes ?? []) if (!power.has(v.account)) power.set(v.account, v.votePower);
            if (type === 'election' && voters.length > 0) {
                // First vote first: a new voter only changes the last cached batch of 20.
                const ordered = [...voters]
                    .sort((a, b) => (a.history?.[0]?.voteId ?? a.voteId) - (b.history?.[0]?.voteId ?? b.voteId))
                    .map(r => r.account);
                for (const [acc, vp] of await electionPowers(ordered)) {
                    if (!power.has(acc)) power.set(acc, vp);
                }
            }
            rows = voters.map(r => ({ ...r, votePower: power.get(r.account) ?? null }));
            if (account && accountPower == null && power.has(account)) {
                accountPower = power.get(account) ?? null;
            }
            // The recount must reproduce the official total. A closed vote that does not is
            // logged as an error and cached briefly; a live tally may simply lag the ledger.
            const official = tally?.electionData?.totalVotingPower;
            if (powerAt === 'snapshot' && official) {
                const counted = sumDecimals(rows.map(r => r.votePower ?? '0'));
                if (!decimalsAgree(counted, official)) {
                    shortCache = true;
                    if (closed) logger.error({ counted, official }, 'Snapshot recount differs from the official total for %s election #%s', system.key, id);
                    else logger.warn({ counted, official }, 'Live snapshot recount differs from the official total for %s election #%s', system.key, id);
                }
            }
        } else if (type === 'election' && account && accountPower == null) {
            const fetched = await electionPowers([account]);
            accountPower = fetched.get(account) ?? null;
        }

        const nowMs = Date.now();
        const hasPendingFreshVoter = withVoters && (rows
            ? rows.some(r => r.votePower === null && (nowMs - Date.parse(r.time)) < FRESH_VOTE_WINDOW_MS)
            : true);
        const missingRequestedPower = (Boolean(account) && accountPower == null) || hasPendingFreshVoter;

        // Closed votes with complete power never change: cache longer at the edge CDN.
        // Current power standing in for the snapshot is not final: keep it short.
        const cacheControl = closed && !shortCache
            ? 'public, s-maxage=86400, stale-while-revalidate=604800'
            : 'public, s-maxage=60, stale-while-revalidate=300';

        return NextResponse.json(
            tally || rows ? {
                results: tally?.results ?? [],
                accountPower,
                voters: rows,
                source: tally?.source ?? null,
                ...(tally?.electionData ? { electionData: powerAt ? { ...tally.electionData, powerAt } : tally.electionData } : {}),
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
        rows: records.map(r => ({
            account: r.account,
            choices: r.choices,
            txid: r.txid,
            time: r.time,
            voteId: r.voteId,
            changes: r.votes - 1,
            ...(r.grades ? { grades: r.grades } : {}),
            ...(r.history && r.history.length > 1 ? { history: r.history } : {}),
        })),
    };
}
