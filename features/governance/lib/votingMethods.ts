import { summarizeTally, type BallotChoice, type GovernanceItem, type TallyRow, type VoteOutcome } from './governanceVotes';
import {
    evaluateMajorityJudgment,
    parseQuantile,
    type ElectionCandidateOutcome,
    type ElectionMethodCandidate,
    type ElectionMethodSummary,
    type ElectionSeatChange,
} from './majorityJudgment';
import {
    CURRENT_METHOD, DUST, METHODS, METHOD_PARAMS, isVeteran,
    type MethodFamily, type MethodKey, type MethodSpec, type MethodVoter, type Resistance, type WeighContext,
} from './methodCatalog';
import {
    RESISTANCE_SCORE, SPREAD_LEVELS,
    balanceExtremes, balanceExtremesBy, balanceScore, balanceScoreOf,
    concentration, concentrationLevel,
    effectiveExtremes, effectiveExtremesBy, effectiveScore, effectiveScoreOf,
    spreadExtremes,
    type Concentration, type ConcentrationLevel,
} from './methodMetrics';

export type { ElectionCandidateOutcome, ElectionMethodCandidate, ElectionMethodSummary, ElectionSeatChange };
export {
    CURRENT_METHOD, METHODS, METHOD_PARAMS,
    type MethodFamily, type MethodKey, type MethodVoter, type Resistance,
    RESISTANCE_SCORE, SPREAD_LEVELS,
    balanceExtremes, balanceExtremesBy, balanceScore, balanceScoreOf,
    concentration, concentrationLevel,
    effectiveExtremes, effectiveExtremesBy, effectiveScore, effectiveScoreOf,
    spreadExtremes,
    type Concentration, type ConcentrationLevel,
};

/**
 * The fewest voters of the winning side who would have carried the result on
 * their own, even if every other voter had voted the other way.
 */
export interface Decisive {
    side: 'for' | 'against' | 'winner';
    count: number;
    /** Out of the voters on that side. */
    of: number;
    /** XRD those voters hold. */
    xrd: number;
}

export interface MethodResult {
    key: MethodKey;
    family: MethodFamily;
    current: boolean;
    needsAge: boolean;
    /** Voters whose vote weighs something under this rule. */
    counted: number;
    /** Voters left out by the rule. */
    excluded: number;
    rows: TallyRow[];
    /** Counted addresses behind each option, by ballot key. */
    addressesByChoice: Record<string, number>;
    /** Share in favour among decisive votes, 0..1; null on a ballot with no sides. */
    approvalShare: number | null;
    /** Double majority only: share in favour counting one vote per address. */
    headcountShare: number | null;
    /** XRD held by the counted voters (the pool the rule weighs and attacks are priced against). */
    eligibleXrd: number;
    /**
     * XRD measured against the quorum. Equals `eligibleXrd`, except for rules
     * that leave voters out for their rank among voters (no_top1, no_whales):
     * those voters still took part, so their XRD counts toward the quorum.
     */
    quorumXrd: number;
    /** Sum of transformed voter weights (`w`) under this rule. */
    totalWeight: number;
    quorumRatio: number | null;
    quorumMet: boolean | null;
    outcome: VoteOutcome | null;
    /** Option with the most weight (or #1 candidate in a Majority Judgment election). */
    winner: TallyRow | null;
    /** Majority Judgment election standings & seat diff under this method's voter weights. */
    electionSummary?: ElectionMethodSummary | null;
    concentration: Concentration;
    decisive: Decisive | null;
    /** Whether the result matches the current rule's; null for the current rule itself. */
    sameAsCurrent: boolean | null;
    /** Resistance to manipulation. */
    resistance: Resistance;
    /** Cheapest way found to flip the result by adding votes; null when there is no clear result to flip. */
    attack: Attack | null;
    /** Exact post-attack whale control shares for relative share-cap rules on live votes. */
    capShareAudit?: {
        singleWhaleShare: number;
        lastMinTwabSingleShare?: number;
    };
}

/**
 * What it would take one person to turn the result around by adding votes on
 * the losing side: `addresses` new (or old enough) addresses and `xrd` in total.
 * `impossible` when adding votes cannot flip it under this rule.
 */
export interface Attack {
    xrd: number;
    addresses: number;
    /** Account age the addresses need; 0 for brand new ones. */
    years: number;
    /** True when the cheapest attack is priced in addresses rather than pure capital. */
    perAddress?: boolean;
    impossible?: boolean;
}

type Side = 'for' | 'against' | 'neutral';

/** Fewest of `list`, largest weight first (then most XRD), whose summed weight passes `ok`. */
function fewestLargest(list: Array<{ v: MethodVoter; w: number }>, ok: (sum: number) => boolean): { count: number; xrd: number } | null {
    const sorted = [...list].sort((a, b) => b.w - a.w || b.v.power - a.v.power);
    let sum = 0;
    let xrd = 0;
    for (let i = 0; i < sorted.length; i++) {
        sum += sorted[i].w;
        xrd += sorted[i].v.power;
        if (ok(sum)) return { count: i + 1, xrd };
    }
    return null;
}

function decisiveVoters(
    weighed: Array<{ v: MethodVoter; w: number; side: Side }>,
    outcome: VoteOutcome | null,
    winner: TallyRow | null,
    threshold: number,
    headcount = false,
): Decisive | null {
    const total = weighed.reduce((s, x) => s + x.w, 0);
    const n = weighed.length;
    const side = (s: Side) => weighed.filter(x => x.side === s);
    const settle = (kind: Decisive['side'], list: typeof weighed, ok: (sum: number) => boolean): Decisive | null => {
        const hit = fewestLargest(list, ok);
        return hit && { side: kind, count: hit.count, of: list.length, xrd: hit.xrd };
    };
    if (total <= 0) return null;
    // Approved: enough in favour even with everybody else against.
    if (outcome === 'approved') {
        // With a double majority, enough addresses are needed as well as enough XRD.
        const hit = settle('for', side('for'), f => f / total >= threshold);
        return hit && headcount ? { ...hit, count: Math.max(hit.count, Math.ceil(threshold * n)) } : hit;
    }
    // Rejected: enough against that the rest, all in favour, stay under the threshold.
    if (outcome === 'rejected') {
        const hit = settle('against', side('against'), a => (total - a) / total < threshold);
        // A double majority also fails when too many addresses are against, whatever they hold.
        const byCount = Math.floor((1 - threshold) * n) + 1;
        return hit && headcount && byCount < hit.count && byCount <= side('against').length ? { ...hit, count: byCount } : hit;
    }
    // A ballot with no sides: more than half of all the weight behind the winner.
    if (outcome === null && winner) return settle('winner', weighed.filter(x => x.v.choices.includes(winner.key)), w => w > total / 2);
    return null;
}

/**
 * Weight the losing side needs to add to flip a sided result.
 * Approved: in favour F must fall under the threshold; rejected: it must reach it.
 */
function weightToFlip(outcome: 'approved' | 'rejected', inFavour: number, against: number, threshold: number): number {
    if (outcome === 'approved') return Math.max(0, inFavour / threshold - inFavour - against);
    return threshold >= 1 ? Infinity : Math.max(0, (threshold * against) / (1 - threshold) - inFavour);
}

/** Fewest whole units of `step` that exceed (approved) or reach (rejected) `need`. */
function unitsFor(need: number, step: number, outcome: 'approved' | 'rejected'): number {
    if (!Number.isFinite(need)) return Infinity;
    return outcome === 'approved' ? Math.floor(need / step) + 1 : Math.max(1, Math.ceil(need / step - 1e-9));
}

function attackCost(
    spec: MethodSpec,
    outcome: VoteOutcome | null,
    rows: TallyRow[],
    sides: { pro: number; con: number; hcPro: number; hcCon: number; proXrd: number; conXrd: number; total: number; count: number },
    threshold: number,
): Attack | null {
    if (outcome !== 'approved' && outcome !== 'rejected') return null;
    const inFavour = rows.filter(r => r.tone === 'positive').reduce((s, r) => s + r.power, 0);
    const against = rows.filter(r => r.tone === 'negative').reduce((s, r) => s + r.power, 0);
    const need = weightToFlip(outcome, inFavour, against, threshold);
    const p = spec.sybil;

    if (p.kind === 'capital') {
        const xrd = Math.max(p.minXrd ?? 0, need / p.perXrd);
        // A cap is dodged by splitting the XRD into addresses just under it.
        const chunk = p.cap ?? (p.capShare ? (sides.total + xrd) * p.capShare : Infinity);
        return { xrd, addresses: Number.isFinite(chunk) ? Math.max(1, Math.ceil(xrd / chunk)) : 1, years: p.years ?? 0 };
    }
    if (p.kind === 'addresses') {
        const addresses = unitsFor(need, p.weight, outcome);
        if (!Number.isFinite(addresses)) return { xrd: 0, addresses: 0, years: p.years ?? 0, perAddress: true, impossible: true };
        return { xrd: addresses * p.xrd, addresses, years: p.years ?? 0, perAddress: true };
    }
    if (p.kind === 'double') {
        const unitXrd = p.minXrd ?? DUST;
        const yrs = p.years ?? 0;
        // Approved: addresses against break the headcount majority on their own.
        if (outcome === 'approved') {
            const k = Math.max(1, Math.floor(sides.hcPro / threshold - sides.hcPro - sides.hcCon) + 1);
            return { xrd: k * unitXrd, addresses: k, years: yrs, perAddress: true };
        }
        // Rejected: both majorities are needed, so the XRD and the qualifying addresses.
        const xrdNeed = weightToFlip('rejected', sides.proXrd, sides.conXrd, threshold);
        const k = threshold >= 1 ? Infinity : Math.max(0, Math.ceil((threshold * sides.hcCon) / (1 - threshold) - sides.hcPro));
        if (!Number.isFinite(k) || !Number.isFinite(xrdNeed)) return { xrd: 0, addresses: 0, years: yrs, impossible: true };
        return { xrd: Math.max(xrdNeed, k * unitXrd), addresses: Math.max(1, k), years: k > 0 ? yrs : 0 };
    }
    // 50 / 50: each qualifying address adds to the headcount half and dilutes everyone else's share of it.
    const unitXrd = p.minXrd ?? DUST;
    const yrs = p.years ?? 0;
    const share = (k: number) => {
        const n = sides.count + k;
        const tot = sides.total + k * unitXrd;
        const addPro = outcome === 'rejected' ? k : 0;
        const addCon = outcome === 'approved' ? k : 0;
        const f = 0.5 * (tot ? (sides.proXrd + addPro * unitXrd) / tot : 0) + (0.5 * (sides.pro + addPro)) / n;
        const a = 0.5 * (tot ? (sides.conXrd + addCon * unitXrd) / tot : 0) + (0.5 * (sides.con + addCon)) / n;
        return f / (f + a);
    };
    const flipped = (k: number) => (outcome === 'approved' ? share(k) < threshold : share(k) >= threshold);
    let hi = 1;
    while (!flipped(hi) && hi < 1e12) hi *= 2;
    if (!flipped(hi)) return { xrd: 0, addresses: 0, years: yrs, perAddress: true, impossible: true };
    let lo = 0;
    while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (flipped(mid)) hi = mid; else lo = mid;
    }
    return { xrd: hi * unitXrd, addresses: hi, years: yrs, perAddress: true };
}

/** Pre-computed voter aggregates shared across all methods in a single vote. */
function buildWeighContext(voters: MethodVoter[]): WeighContext {
    let total = 0;
    let count = 0;
    let veteranTotal = 0;
    let stakedTotal = 0;
    let twabTotal = 0;
    let veteranFundedTotal = 0;
    let veteranFundedCount = 0;
    let largestVoter: MethodVoter | null = null;
    for (const v of voters) {
        total += v.power;
        if (v.power > 0) count += 1;
        if (isVeteran(v)) {
            veteranTotal += v.power;
            if (v.power >= METHOD_PARAMS.minBalance) {
                veteranFundedTotal += v.power;
                veteranFundedCount += 1;
            }
        }
        stakedTotal += v.stakedXrd ?? 0;
        twabTotal += v.twab90Xrd ?? 0;
        if (!largestVoter || v.power > largestVoter.power) largestVoter = v;
    }
    const whales = new Set([...voters].sort((a, b) => b.power - a.power).slice(0, METHOD_PARAMS.whales).map(v => v.account));
    return {
        total,
        count,
        veteranTotal,
        stakedTotal,
        twabTotal,
        veteranFundedTotal,
        veteranFundedCount,
        whales,
        largest: largestVoter?.account ?? null,
    };
}

export interface CompareOptions {
    /** Applied Majority Judgment quantile (e.g. "3/5" or "0.6"). Defaults to 3/5 (60%). */
    gradeQuantile?: string | null;
}

/** Counts the ballots with one rule. */
function applyMethod(
    spec: MethodSpec,
    voters: Array<{ v: MethodVoter; side: Side }>,
    ctx: WeighContext,
    choices: BallotChoice[],
    item: GovernanceItem | null,
    options?: CompareOptions,
): Omit<MethodResult, 'sameAsCurrent'> {
    const weighed = voters.map(({ v, side }) => ({ v, w: Math.max(0, spec.weigh(v, ctx)), side })).filter(x => x.w > 0);
    const byChoice = new Map<string, number>();
    for (const { v, w } of weighed) {
        for (const k of v.choices) {
            byChoice.set(k, (byChoice.get(k) ?? 0) + w);
        }
    }
    const results = [...byChoice].map(([vote, w]) => ({ vote, votePower: String(w) }));
    const addressesByChoice: Record<string, number> = {};
    for (const { v } of weighed) for (const k of v.choices) addressesByChoice[k] = (addressesByChoice[k] ?? 0) + 1;
    // Quorum is an XRD rule: it is checked apart, with the XRD of the voters that count (counted once per voter).
    const summary = summarizeTally(choices, { results, accountPower: null }, item ? { ...item, quorum: null } : null);
    const totalWeight = weighed.reduce((s, x) => s + x.w, 0);
    const castBallot = (v: MethodVoter) => v.choices.length > 0 || (v.grades != null && Object.keys(v.grades).length > 0);
    const eligibleXrd = weighed.reduce((s, x) => s + (castBallot(x.v) ? x.v.power : 0), 0);
    // Weight caps never shrink the quorum (it is measured in raw XRD). Rules that drop voters for
    // their rank among voters count them too; rules that drop voters for failing a requirement do not.
    const quorumXrd = spec.quorumCountsExcluded
        ? voters.reduce((s, { v }) => s + (castBallot(v) ? v.power : 0), 0)
        : eligibleXrd;
    let capShareAudit: MethodResult['capShareAudit'];
    if (spec.sybil.kind === 'capital' && spec.sybil.capShare != null) {
        const shareCap = spec.sybil.capShare;
        const poolValue = (v: MethodVoter): number => {
            switch (spec.key) {
                case 'capped_share':
                case 'capped_share_5':
                case 'capped_share_10':
                    return v.power;
                case 'capped_share_veterans_1':
                case 'capped_share_veterans':
                    return isVeteran(v) ? v.power : 0;
                case 'staked_capped_share':
                    return v.stakedXrd ?? 0;
                case 'twab_90d_capped_share':
                    return v.twab90Xrd ?? 0;
                default:
                    return v.power;
            }
        };
        const basePool = spec.key === 'capped_share_veterans_1' || spec.key === 'capped_share_veterans'
            ? ctx.veteranTotal
            : spec.key === 'staked_capped_share'
                ? ctx.stakedTotal
                : spec.key === 'twab_90d_capped_share'
                    ? ctx.twabTotal
                    : ctx.total;
        if (basePool > 0) {
            const simShare = (addedCapital: number): number => {
                const postPool = basePool + addedCapital;
                const postCap = postPool * shareCap;
                let honestPostWeight = 0;
                for (const { v } of weighed) {
                    honestPostWeight += Math.min(poolValue(v), postCap);
                }
                const attackerWeight = Math.min(addedCapital, postCap);
                const denom = honestPostWeight + attackerWeight;
                return denom > 0 ? Math.min(1, Math.max(0, attackerWeight / denom)) : 1;
            };
            const whaleCapital = 1.5 * basePool;
            capShareAudit = {
                singleWhaleShare: simShare(whaleCapital),
                ...(spec.key === 'twab_90d_capped_share'
                    ? { lastMinTwabSingleShare: simShare(whaleCapital * 0.25) }
                    : {}),
            };
        }
    }
    const quorumRatio = item?.quorum ? quorumXrd / item.quorum : null;
    const quorumMet = quorumRatio === null ? null : quorumRatio >= 1;
    const threshold = item?.approvalThreshold ?? 0.5;

    const pro = weighed.filter(x => x.side === 'for').length;
    const con = weighed.filter(x => x.side === 'against').length;
    const headcountPool = spec.headcountFilter ? weighed.filter(x => spec.headcountFilter!(x.v)) : weighed;
    const hcPro = headcountPool.filter(x => x.side === 'for').length;
    const hcCon = headcountPool.filter(x => x.side === 'against').length;
    const headcountShare = spec.headcount && hcPro + hcCon > 0 ? hcPro / (hcPro + hcCon) : null;

    const isElection = Boolean(item?.election && weighed.some(x => x.v.grades));
    const appliedQuantile = parseQuantile(options?.gradeQuantile);
    let decisiveQuantileCount: number | null = null;
    let decisiveQuantileXrd: number | null = null;
    if (isElection && weighed.length > 0) {
        const sortedForQuantile = [...weighed].filter(x => x.w > 0).sort((a, b) => b.w - a.w || b.v.power - a.v.power);
        const totalW = sortedForQuantile.reduce((s, x) => s + x.w, 0);
        if (totalW > 0) {
            let accW = 0;
            let accXrd = 0;
            for (let i = 0; i < sortedForQuantile.length; i++) {
                accW += sortedForQuantile[i].w;
                accXrd += sortedForQuantile[i].v.power;
                if (accW >= totalW * appliedQuantile) {
                    decisiveQuantileCount = i + 1;
                    decisiveQuantileXrd = Math.round(accXrd * 100) / 100;
                    break;
                }
            }
        }
    }
    const electionSummary = isElection && item?.election
        ? {
            ...evaluateMajorityJudgment(weighed, item.election, {
                quantile: appliedQuantile,
                headcountPool: spec.headcount ? headcountPool : undefined,
            }),
            decisiveQuantileCount,
            decisiveQuantileXrd,
        }
        : null;
    const passes = (share: number | null) => share !== null && share >= threshold;
    const outcome: VoteOutcome | null = weighed.length === 0
        ? null
        : quorumMet === false
            ? 'no_quorum'
            : summary.approvalShare === null
                ? null
                : passes(summary.approvalShare) && (!spec.headcount || passes(headcountShare)) ? 'approved' : 'rejected';
    const topCandidate = electionSummary?.standings[0] ?? null;
    const winner: TallyRow | null = topCandidate
        ? {
            key: String(topCandidate.id),
            label: topCandidate.label,
            power: topCandidate.electableShare,
            share: topCandidate.electableShare,
            tone: 'neutral',
            selected: false,
        }
        : summary.rows.reduce<TallyRow | null>((best, r) => (r.power > 0 && (!best || r.power > best.power) ? r : best), null);

    return {
        key: spec.key,
        family: spec.family,
        current: spec.key === CURRENT_METHOD,
        needsAge: spec.needsAge,
        counted: weighed.length,
        excluded: voters.length - weighed.length,
        rows: summary.rows,
        addressesByChoice,
        approvalShare: weighed.length ? summary.approvalShare : null,
        headcountShare,
        eligibleXrd,
        quorumXrd,
        totalWeight,
        quorumRatio,
        quorumMet,
        outcome,
        winner,
        electionSummary,
        concentration: concentration(weighed.map(x => x.w), voters.length),
        decisive: isElection ? null : decisiveVoters(weighed, outcome, winner, threshold, spec.headcount),
        resistance: spec.resistance,
        attack: isElection ? null : attackCost(spec, outcome, summary.rows, {
            pro, con, hcPro, hcCon,
            proXrd: weighed.filter(x => x.side === 'for').reduce((s, x) => s + x.v.power, 0),
            conXrd: weighed.filter(x => x.side === 'against').reduce((s, x) => s + x.v.power, 0),
            total: weighed.reduce((s, x) => s + x.v.power, 0),
            count: weighed.length,
        }, threshold),
        ...(capShareAudit ? { capShareAudit } : {}),
    };
}

const verdict = (r: Pick<MethodResult, 'outcome' | 'winner'>) => r.outcome ?? r.winner?.key ?? null;

/** Every rule applied to the same ballots, the current one first. */
export function compareMethods(
    voters: MethodVoter[],
    choices: BallotChoice[],
    item: GovernanceItem | null,
    options?: CompareOptions,
): MethodResult[] {
    const counted = voters.filter(v => v.power > 0);
    const ctx = buildWeighContext(counted);
    const toneOf = new Map(choices.map(c => [c.key, c.tone]));
    const prepared = counted.map(v => {
        const tones = v.choices.map(k => toneOf.get(k));
        const side: Side = tones.includes('positive') ? 'for' : tones.includes('negative') ? 'against' : 'neutral';
        return { v, side };
    });
    const results = METHODS.map(spec => applyMethod(spec, prepared, ctx, choices, item, options));
    const current = results.find(r => r.current);
    const currentElectedIds = current?.electionSummary
        ? new Set(current.electionSummary.elected.map(c => c.id))
        : null;
    const currentTiedIds = current?.electionSummary
        ? new Set(current.electionSummary.tiedAtCutoff.map(c => c.id))
        : null;
    const currentRankById = current?.electionSummary
        ? new Map(current.electionSummary.standings.map(c => [c.id, c.rank]))
        : null;

    return results.map(r => {
        if (r.electionSummary && current?.electionSummary && currentElectedIds && currentTiedIds && currentRankById) {
            if (r.current || r.counted === 0) {
                return { ...r, sameAsCurrent: null };
            }
            const methodIds = new Set(r.electionSummary.elected.map(c => c.id));
            const methodTiedIds = new Set(r.electionSummary.tiedAtCutoff.map(c => c.id));
            const methodRankById = new Map(r.electionSummary.standings.map(c => [c.id, c.rank]));
            const enteredCands = r.electionSummary.elected.filter(c => !currentElectedIds.has(c.id));
            const leftCands = current.electionSummary.elected.filter(c => !methodIds.has(c.id));
            const entered = enteredCands.map(c => c.label);
            const left = leftCands.map(c => c.label);
            const enteredDetails: ElectionSeatChange[] = enteredCands.map(c => ({
                id: c.id,
                label: c.label,
                currentRank: currentRankById.get(c.id) ?? c.rank,
                methodRank: c.rank,
            }));
            const leftDetails: ElectionSeatChange[] = leftCands.map(c => ({
                id: c.id,
                label: c.label,
                currentRank: c.rank,
                methodRank: methodRankById.get(c.id) ?? c.rank,
            }));
            const sameTies = methodTiedIds.size === currentTiedIds.size
                && [...methodTiedIds].every(id => currentTiedIds.has(id));
            const seatsChanged = Math.max(entered.length, left.length);
            return {
                ...r,
                electionSummary: {
                    ...r.electionSummary,
                    seatsChanged,
                    entered,
                    left,
                    enteredDetails,
                    leftDetails,
                },
                sameAsCurrent: seatsChanged === 0 && sameTies,
            };
        }
        return {
            ...r,
            sameAsCurrent: r.current || !current || r.counted === 0 ? null : verdict(r) === verdict(current),
        };
    });
}

export {
    ATTACK_OPERATIONAL_COST,
    CURRENT_ATTACK_SHARES,
    computeAttackDifficulty,
    computeConsensusResistance,
    computeConsensusStructuralRatio,
    computeElectionConclusions,
    computeElectionConsensus,
    computeGlobalResistanceScore,
    computeHistoricalMethodScoreRows,
    computeMethodScoreRows,
    methodResistanceMetricsFromHistorical,
    methodResistanceMetricsFromResult,
    nextMethodScoreSort,
    resistanceLevelFromScore,
    roundResistanceScore,
    scoreMethodResult,
    fairBalanceScore,
    fairEffectiveScore,
    fairScoreExtremes,
    controlShare,
    CONTROL_SHARE,
    sortMethodScoreRows,
    type AttackDifficulty,
    type AttackOperationalCost,
    type ConsensusAttackId,
    type ConsensusAttackScenario,
    type ElectionConsensusCandidate,
    type ElectionConsensusConcentration,
    type ElectionConsensusConclusions,
    type ElectionConsensusFamilySummary,
    type ElectionConsensusSummary,
    type GlobalResistanceScore,
    type RawResistanceScore,
    type MethodScoreRow,
    type MethodScoreSortKey,
    type MethodScoreSortState,
    type SortDirection,
} from './electionConsensus';
export {
    computeMethodResistance,
    type MethodAttackEval,
    type MethodResistanceMetrics,
    type MethodResistanceReport,
} from './methodResistance';
