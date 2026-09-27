import { summarizeTally, type BallotChoice, type GovernanceItem, type TallyRow, type VoteOutcome } from './governanceVotes';

/**
 * The same ballots counted with other voting rules.
 *
 * Every governance vote on Radix is weighed 1 XRD = 1 vote. Here each voter
 * keeps their choice and XRD, and only the rule deciding how much that vote
 * weighs changes: per address, by square root, by account age… Each rule
 * gives its own result and its own picture of how concentrated power is.
 */

export interface MethodVoter {
    account: string;
    /** Ballot keys picked (option ids or a stance). */
    choices: string[];
    /** Voting power the collector gives the account, in XRD. */
    power: number;
    /** Account age when the vote opened, in days; null when unknown (or still loading). */
    ageDays: number | null;
}

export type MethodFamily = 'wealth' | 'address' | 'seniority' | 'hybrid';

export type MethodKey =
    | 'linear' | 'capped' | 'capped_share' | 'quadratic' | 'cube_root' | 'logarithmic' | 'tiered'
    | 'one_address' | 'one_address_min' | 'one_address_sybil' | 'address_age'
    | 'one_year' | 'veterans' | 'veterans_address' | 'veterans_bonus' | 'seniority_bonus'
    | 'hybrid_half' | 'double_majority' | 'quadratic_seniority' | 'sybil_quadratic' | 'no_top1' | 'no_whales' | 'whales_only';

/** Figures the rules use; also shown to the reader in each rule's explanation. */
export const METHOD_PARAMS = {
    /** Most XRD a single address may weigh with. */
    cap: 1_000_000,
    /** Balance an address needs to count, per address. */
    minBalance: 10_000,
    /** Anti-sybil filter: balance and age an address needs. */
    sybilBalance: 1_000,
    sybilDays: 365,
    /** Age that makes an account a veteran. */
    veteranDays: 730,
    /** Extra weight per full year of account age. */
    bonusPerYear: 0.25,
    /** Largest voters left out by the "no whales" rule. */
    whales: 10,
    /** Most a single address may weigh, as a share of all the XRD that voted. */
    capShare: 0.01,
    /** Balance brackets of the tiered rule: one more vote from each. */
    tiers: [1_000, 10_000, 100_000, 1_000_000],
    /** Balance that makes a large wallet. */
    whaleMin: 1_000_000,
} as const;

const DAY_YEAR = 365;
const years = (v: MethodVoter) => Math.floor((v.ageDays ?? 0) / DAY_YEAR);
const bonus = (v: MethodVoter) => 1 + METHOD_PARAMS.bonusPerYear * years(v);
const isVeteran = (v: MethodVoter) => (v.ageDays ?? -1) >= METHOD_PARAMS.veteranDays;
const isSybilSafe = (v: MethodVoter) => v.power >= METHOD_PARAMS.sybilBalance && (v.ageDays ?? -1) >= METHOD_PARAMS.sybilDays;

interface WeighContext {
    /** XRD of every voter. */
    total: number;
    count: number;
    whales: Set<string>;
    /** The voter with the most XRD. */
    largest: string | null;
}

interface MethodSpec {
    key: MethodKey;
    family: MethodFamily;
    /** Needs every voter's account age. */
    needsAge: boolean;
    /** Weight of one vote; 0 leaves the voter out. */
    weigh: (v: MethodVoter, ctx: WeighContext) => number;
    /** Passing also takes the threshold counting one vote per address (double majority). */
    headcount?: boolean;
}

export const METHODS: readonly MethodSpec[] = [
    { key: 'linear', family: 'wealth', needsAge: false, weigh: v => v.power },
    { key: 'capped', family: 'wealth', needsAge: false, weigh: v => Math.min(v.power, METHOD_PARAMS.cap) },
    { key: 'capped_share', family: 'wealth', needsAge: false, weigh: (v, ctx) => Math.min(v.power, ctx.total * METHOD_PARAMS.capShare) },
    { key: 'quadratic', family: 'wealth', needsAge: false, weigh: v => Math.sqrt(v.power) },
    { key: 'cube_root', family: 'wealth', needsAge: false, weigh: v => Math.cbrt(v.power) },
    { key: 'logarithmic', family: 'wealth', needsAge: false, weigh: v => Math.log10(1 + v.power) },
    { key: 'tiered', family: 'wealth', needsAge: false, weigh: v => (v.power > 0 ? 1 + METHOD_PARAMS.tiers.filter(t => v.power >= t).length : 0) },
    { key: 'one_address', family: 'address', needsAge: false, weigh: v => (v.power > 0 ? 1 : 0) },
    { key: 'one_address_min', family: 'address', needsAge: false, weigh: v => (v.power >= METHOD_PARAMS.minBalance ? 1 : 0) },
    {
        key: 'one_address_sybil', family: 'address', needsAge: true,
        weigh: v => (isSybilSafe(v) ? 1 : 0),
    },
    { key: 'address_age', family: 'address', needsAge: true, weigh: v => (v.ageDays === null || v.power <= 0 ? 0 : 1 + years(v)) },
    { key: 'one_year', family: 'seniority', needsAge: true, weigh: v => ((v.ageDays ?? -1) >= DAY_YEAR ? v.power : 0) },
    { key: 'veterans', family: 'seniority', needsAge: true, weigh: v => (isVeteran(v) ? v.power : 0) },
    { key: 'veterans_address', family: 'seniority', needsAge: true, weigh: v => (isVeteran(v) && v.power > 0 ? 1 : 0) },
    { key: 'veterans_bonus', family: 'seniority', needsAge: true, weigh: v => (isVeteran(v) ? v.power * bonus(v) : 0) },
    { key: 'seniority_bonus', family: 'seniority', needsAge: true, weigh: v => (v.ageDays === null ? 0 : v.power * bonus(v)) },
    { key: 'hybrid_half', family: 'hybrid', needsAge: false, weigh: (v, ctx) => (v.power > 0 && ctx.total > 0 ? 0.5 * (v.power / ctx.total) + 0.5 / ctx.count : 0) },
    { key: 'double_majority', family: 'hybrid', needsAge: false, headcount: true, weigh: v => v.power },
    { key: 'quadratic_seniority', family: 'hybrid', needsAge: true, weigh: v => (v.ageDays === null ? 0 : Math.sqrt(v.power) * bonus(v)) },
    { key: 'sybil_quadratic', family: 'hybrid', needsAge: true, weigh: v => (isSybilSafe(v) ? Math.sqrt(v.power) : 0) },
    { key: 'no_top1', family: 'hybrid', needsAge: false, weigh: (v, ctx) => (v.account === ctx.largest ? 0 : v.power) },
    { key: 'no_whales', family: 'hybrid', needsAge: false, weigh: (v, ctx) => (ctx.whales.has(v.account) ? 0 : v.power) },
    { key: 'whales_only', family: 'hybrid', needsAge: false, weigh: v => (v.power >= METHOD_PARAMS.whaleMin ? v.power : 0) },
];

/** The rule the governance systems actually use. */
export const CURRENT_METHOD: MethodKey = 'linear';

export interface Concentration {
    /** Fewest voters that together hold more than half of the weight. */
    nakamoto: number | null;
    /**
     * How spread out the weight is, 0..1: `nakamoto` against the most it could
     * be (half the voters plus one, when all weigh the same). It does not
     * depend on how many addresses voted, so votes of any size compare.
     */
    spread: number | null;
    /** Voters that would give the same concentration if all weighed the same (1 / Σ share²). */
    effective: number;
    /** Weight share of the largest voter and of the ten largest, 0..1. */
    top1: number;
    top10: number;
}

export type ConcentrationLevel = 'extreme' | 'high' | 'moderate' | 'low' | 'minimal';

/** Upper bounds of `spread` for each level; one address holding half always reads as extreme. */
export const SPREAD_LEVELS = { high: 0.15, moderate: 0.35, low: 0.65 } as const;

export function concentrationLevel({ nakamoto, spread }: Pick<Concentration, 'nakamoto' | 'spread'>): ConcentrationLevel | null {
    if (nakamoto === null || spread === null) return null;
    if (nakamoto <= 1) return 'extreme';
    if (spread < SPREAD_LEVELS.high) return 'high';
    if (spread < SPREAD_LEVELS.moderate) return 'moderate';
    if (spread < SPREAD_LEVELS.low) return 'low';
    return 'minimal';
}

export function concentration(weights: number[]): Concentration {
    const w = weights.filter(x => x > 0).sort((a, b) => b - a);
    const total = w.reduce((s, x) => s + x, 0);
    if (total <= 0) return { nakamoto: null, spread: null, effective: 0, top1: 0, top10: 0 };
    let acc = 0;
    let nakamoto: number | null = null;
    for (let i = 0; i < w.length; i++) {
        acc += w[i];
        if (acc > total / 2) { nakamoto = i + 1; break; }
    }
    const sumSq = w.reduce((s, x) => s + (x / total) ** 2, 0);
    return {
        nakamoto,
        spread: nakamoto === null ? null : nakamoto / (Math.floor(w.length / 2) + 1),
        effective: 1 / sumSq,
        top1: w[0] / total,
        top10: w.slice(0, 10).reduce((s, x) => s + x, 0) / total,
    };
}

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
    /** Share in favour among decisive votes, 0..1; null on a ballot with no sides. */
    approvalShare: number | null;
    /** Double majority only: share in favour counting one vote per address. */
    headcountShare: number | null;
    /** XRD held by the counted voters, measured against the quorum. */
    eligibleXrd: number;
    quorumRatio: number | null;
    quorumMet: boolean | null;
    outcome: VoteOutcome | null;
    /** Option with the most weight. */
    winner: TallyRow | null;
    concentration: Concentration;
    decisive: Decisive | null;
    /** Whether the result matches the current rule's; null for the current rule itself. */
    sameAsCurrent: boolean | null;
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

/** Counts the ballots with one rule. */
function applyMethod(spec: MethodSpec, voters: MethodVoter[], choices: BallotChoice[], item: GovernanceItem | null): Omit<MethodResult, 'sameAsCurrent'> {
    const total = voters.reduce((s, v) => s + v.power, 0);
    const whales = new Set([...voters].sort((a, b) => b.power - a.power).slice(0, METHOD_PARAMS.whales).map(v => v.account));
    const largest = voters.reduce<MethodVoter | null>((best, v) => (!best || v.power > best.power ? v : best), null)?.account ?? null;
    const ctx: WeighContext = { total, count: voters.filter(v => v.power > 0).length, whales, largest };
    const toneOf = new Map(choices.map(c => [c.key, c.tone]));
    const sideOf = (v: MethodVoter): Side => {
        const tones = v.choices.map(k => toneOf.get(k));
        return tones.includes('positive') ? 'for' : tones.includes('negative') ? 'against' : 'neutral';
    };

    const weighed = voters.map(v => ({ v, w: Math.max(0, spec.weigh(v, ctx)), side: sideOf(v) })).filter(x => x.w > 0);
    const byChoice = new Map<string, number>();
    const xrdByChoice = new Map<string, number>();
    for (const { v, w } of weighed) {
        for (const k of v.choices) {
            byChoice.set(k, (byChoice.get(k) ?? 0) + w);
            xrdByChoice.set(k, (xrdByChoice.get(k) ?? 0) + v.power);
        }
    }
    const results = [...byChoice].map(([vote, w]) => ({ vote, votePower: String(w) }));
    // Quorum is an XRD rule: it is checked apart, with the XRD of the voters that count.
    const summary = summarizeTally(choices, { results, accountPower: null }, item ? { ...item, quorum: null } : null);
    const eligibleXrd = [...xrdByChoice.values()].reduce((s, x) => s + x, 0);
    const quorumRatio = item?.quorum ? eligibleXrd / item.quorum : null;
    const quorumMet = quorumRatio === null ? null : quorumRatio >= 1;
    const threshold = item?.approvalThreshold ?? 0.5;

    const pro = weighed.filter(x => x.side === 'for').length;
    const con = weighed.filter(x => x.side === 'against').length;
    const headcountShare = spec.headcount && pro + con > 0 ? pro / (pro + con) : null;
    const passes = (share: number | null) => share !== null && share >= threshold;
    const outcome: VoteOutcome | null = weighed.length === 0
        ? null
        : quorumMet === false
            ? 'no_quorum'
            : summary.approvalShare === null
                ? null
                : passes(summary.approvalShare) && (!spec.headcount || passes(headcountShare)) ? 'approved' : 'rejected';
    const winner = summary.rows.reduce<TallyRow | null>((best, r) => (r.power > 0 && (!best || r.power > best.power) ? r : best), null);

    return {
        key: spec.key,
        family: spec.family,
        current: spec.key === CURRENT_METHOD,
        needsAge: spec.needsAge,
        counted: weighed.length,
        excluded: voters.length - weighed.length,
        rows: summary.rows,
        approvalShare: weighed.length ? summary.approvalShare : null,
        headcountShare,
        eligibleXrd,
        quorumRatio,
        quorumMet,
        outcome,
        winner,
        concentration: concentration(weighed.map(x => x.w)),
        decisive: decisiveVoters(weighed, outcome, winner, threshold, spec.headcount),
    };
}

const verdict = (r: Pick<MethodResult, 'outcome' | 'winner'>) => r.outcome ?? r.winner?.key ?? null;

/** Every rule applied to the same ballots, the current one first. */
export function compareMethods(voters: MethodVoter[], choices: BallotChoice[], item: GovernanceItem | null): MethodResult[] {
    const counted = voters.filter(v => v.power > 0);
    const results = METHODS.map(spec => applyMethod(spec, counted, choices, item));
    const current = results.find(r => r.current);
    return results.map(r => ({
        ...r,
        sameAsCurrent: r.current || !current || r.counted === 0 ? null : verdict(r) === verdict(current),
    }));
}
