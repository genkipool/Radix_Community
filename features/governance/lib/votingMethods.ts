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
    /** XRD staked in validators when the vote opened; null/undefined when unknown. */
    stakedXrd?: number | null;
    /** 90-day time-weighted average XRD (liquid + staked); null/undefined when unknown. */
    twab90Xrd?: number | null;
    /** Minimum XRD (liquid + staked) continuously held over 90 days; null/undefined when unknown. */
    min90Xrd?: number | null;
}

export type MethodFamily = 'wealth' | 'address' | 'seniority' | 'hybrid';

export type MethodKey =
    | 'linear' | 'deductible_linear' | 'staked_only' | 'capped_10k' | 'capped_100k' | 'capped' | 'capped_5m' | 'capped_10m' | 'capped_share' | 'capped_share_5' | 'capped_share_10' | 'quadratic' | 'cube_root' | 'logarithmic' | 'tiered'
    | 'one_address' | 'one_address_min' | 'one_address_sybil' | 'one_address_sybil_10k' | 'one_address_sybil_100k' | 'one_address_sybil_1m' | 'one_address_sybil_age' | 'one_address_sybil_age_10k' | 'one_address_sybil_age_100k' | 'one_address_sybil_age_1m' | 'address_age'
    | 'one_year' | 'veterans' | 'veterans_address' | 'veterans_bonus' | 'seniority_bonus' | 'twab_90d' | 'held_90d'
    | 'hybrid_half' | 'hybrid_half_veterans' | 'double_majority' | 'double_majority_sybil' | 'capped_veterans' | 'capped_veterans_5m' | 'capped_veterans_10m' | 'capped_share_veterans_1' | 'capped_share_veterans' | 'staked_capped_share' | 'twab_90d_capped_share' | 'marginal_veterans' | 'quadratic_seniority' | 'sybil_quadratic' | 'no_top1' | 'no_whales' | 'whales_only';

/** Figures the rules use; also shown to the reader in each rule's explanation. */
export const METHOD_PARAMS = {
    /** Most XRD a single address may weigh with. */
    cap: 1_000_000,
    /** The other fixed caps compared. */
    caps: { capped_10k: 10_000, capped_100k: 100_000, capped_5m: 5_000_000, capped_10m: 10_000_000 },
    /** The other caps as a share of all the XRD that voted. */
    capShares: { capped_share_5: 0.05, capped_share_10: 0.1 },
    /** Share cap used for veteran-only relative capping. */
    veteranShareCap: 0.05,
    /** Marginal brackets for progressive soft-cap veteran voting. */
    marginalBrackets: { first: 100_000, second: 1_000_000, midRate: 0.5, topRate: 0.1 },
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
const isVeteranFunded = (v: MethodVoter) => isVeteran(v) && v.power >= METHOD_PARAMS.minBalance;
const isSybilSafe = (v: MethodVoter) => v.power >= METHOD_PARAMS.sybilBalance && (v.ageDays ?? -1) >= METHOD_PARAMS.sybilDays;

/** Piecewise-linear diminishing marginal weight: 100 % up to 100k, 50 % up to 1M, 10 % above 1M. */
function marginalWeight(xrd: number): number {
    const { first, second, midRate, topRate } = METHOD_PARAMS.marginalBrackets;
    if (xrd <= 0) return 0;
    if (xrd <= first) return xrd;
    if (xrd <= second) return first + (xrd - first) * midRate;
    return first + (second - first) * midRate + (xrd - second) * topRate;
}

interface WeighContext {
    /** XRD of every voter. */
    total: number;
    count: number;
    /** XRD of veteran voters (2+ years). */
    veteranTotal: number;
    /** Total XRD staked in validators across voters. */
    stakedTotal: number;
    /** Total 90-day time-weighted average XRD across voters. */
    twabTotal: number;
    /** XRD and count of veteran funded voters (2+ years and >= 10,000 XRD). */
    veteranFundedTotal: number;
    veteranFundedCount: number;
    whales: Set<string>;
    /** The voter with the most XRD. */
    largest: string | null;
}

/**
 * How hard it is for one person to sway the vote beyond what they really
 * hold, with no identity checks: new addresses are free, XRD can be split
 * between addresses at no cost, and account age belongs to the account, not
 * to the XRD in it.
 */
export type Resistance = 'very_low' | 'low' | 'medium' | 'high';

/**
 * The cheapest way to add weight under a rule, used to price flipping the result:
 * - `capital`: more XRD (in one account or split, it weighs the same); `perXrd` is the weight each XRD adds.
 * - `addresses`: many new addresses holding `xrd` each, `weight` each.
 * - `hybrid`: new addresses shift the headcount half of the 50 / 50 rule.
 * - `double`: both majorities; the headcount one can be tipped with empty addresses.
 * `years` is the account age the rule asks for: new accounts do not count.
 */
type SybilProfile =
    | { kind: 'capital'; perXrd: number; years?: number; minXrd?: number; cap?: number; capShare?: number }
    | { kind: 'addresses'; xrd: number; weight: number; years?: number }
    | { kind: 'hybrid'; minXrd?: number; years?: number }
    | { kind: 'double'; minXrd?: number; years?: number };

interface MethodSpec {
    key: MethodKey;
    family: MethodFamily;
    resistance: Resistance;
    sybil: SybilProfile;
    /** Needs every voter's account age. */
    needsAge: boolean;
    /** Weight of one vote; 0 leaves the voter out. */
    weigh: (v: MethodVoter, ctx: WeighContext) => number;
    /** Passing also takes the threshold counting one vote per address (double majority). */
    headcount?: boolean;
    /** Optional filter for which voters count in the headcount chamber of a double majority. */
    headcountFilter?: (v: MethodVoter) => boolean;
}

const DUST = 1;

/** 1 XRD = 1 vote up to `cap` XRD per address. */
function capped(key: MethodKey, cap: number): MethodSpec {
    // The cap is dodged for free by splitting: it never holds a whale back.
    return { key, family: 'wealth', resistance: 'low', sybil: { kind: 'capital', perXrd: 1, cap }, needsAge: false, weigh: v => Math.min(v.power, cap) };
}

/** 1 XRD = 1 vote up to `cap` XRD per address, only for veteran accounts (2+ years). */
function cappedVeterans(key: MethodKey, cap: number): MethodSpec {
    // Splitting never multiplies votes beyond 1 XRD = 1 vote, and dodging the cap requires 2-year-old accounts prepared ahead.
    return {
        key,
        family: 'hybrid',
        resistance: 'high',
        sybil: { kind: 'capital', perXrd: 1, cap, years: METHOD_PARAMS.veteranDays / DAY_YEAR },
        needsAge: true,
        weigh: v => (isVeteran(v) ? Math.min(v.power, cap) : 0),
    };
}

/** 1 XRD = 1 vote up to `share` of all the XRD that voted, per address. */
function cappedShare(key: MethodKey, share: number): MethodSpec {
    return { key, family: 'wealth', resistance: 'low', sybil: { kind: 'capital', perXrd: 1, capShare: share }, needsAge: false, weigh: (v, ctx) => Math.min(v.power, ctx.total * share) };
}

/** 1 address = 1 vote (optionally +1 per full year) for accounts >= `minXrd` and >= 1 year old. */
function oneAddressSybil(key: MethodKey, minXrd: number, withAge = false): MethodSpec {
    const sybilYears = METHOD_PARAMS.sybilDays / DAY_YEAR;
    return {
        key,
        family: 'address',
        resistance: 'medium',
        sybil: { kind: 'addresses', xrd: minXrd, weight: withAge ? 2 : 1, years: sybilYears },
        needsAge: true,
        weigh: v => (v.power >= minXrd && (v.ageDays ?? -1) >= METHOD_PARAMS.sybilDays ? (withAge ? 1 + years(v) : 1) : 0),
    };
}
const CAPITAL: SybilProfile = { kind: 'capital', perXrd: 1 };
const DUST_ADDRESS: SybilProfile = { kind: 'addresses', xrd: DUST, weight: 1 };

export const METHODS: readonly MethodSpec[] = [
    { key: 'linear', family: 'wealth', resistance: 'high', sybil: CAPITAL, needsAge: false, weigh: v => v.power },
    { key: 'deductible_linear', family: 'wealth', resistance: 'high', sybil: { kind: 'capital', perXrd: 1, minXrd: METHOD_PARAMS.minBalance }, needsAge: false, weigh: v => Math.max(0, v.power - METHOD_PARAMS.minBalance) },
    { key: 'staked_only', family: 'wealth', resistance: 'high', sybil: CAPITAL, needsAge: true, weigh: v => (v.stakedXrd ?? 0) },
    capped('capped_10k', METHOD_PARAMS.caps.capped_10k),
    capped('capped_100k', METHOD_PARAMS.caps.capped_100k),
    capped('capped', METHOD_PARAMS.cap),
    capped('capped_5m', METHOD_PARAMS.caps.capped_5m),
    capped('capped_10m', METHOD_PARAMS.caps.capped_10m),
    cappedShare('capped_share', METHOD_PARAMS.capShare),
    cappedShare('capped_share_5', METHOD_PARAMS.capShares.capped_share_5),
    cappedShare('capped_share_10', METHOD_PARAMS.capShares.capped_share_10),
    // Sublinear rules reward splitting: 1 XRD in each of many addresses weighs 1 each.
    { key: 'quadratic', family: 'wealth', resistance: 'very_low', sybil: DUST_ADDRESS, needsAge: false, weigh: v => Math.sqrt(v.power) },
    { key: 'cube_root', family: 'wealth', resistance: 'very_low', sybil: DUST_ADDRESS, needsAge: false, weigh: v => Math.cbrt(v.power) },
    { key: 'logarithmic', family: 'wealth', resistance: 'very_low', sybil: { kind: 'addresses', xrd: DUST, weight: Math.log10(1 + DUST) }, needsAge: false, weigh: v => Math.log10(1 + v.power) },
    { key: 'tiered', family: 'wealth', resistance: 'very_low', sybil: DUST_ADDRESS, needsAge: false, weigh: v => (v.power > 0 ? 1 + METHOD_PARAMS.tiers.filter(t => v.power >= t).length : 0) },
    { key: 'one_address', family: 'address', resistance: 'very_low', sybil: DUST_ADDRESS, needsAge: false, weigh: v => (v.power > 0 ? 1 : 0) },
    { key: 'one_address_min', family: 'address', resistance: 'low', sybil: { kind: 'addresses', xrd: METHOD_PARAMS.minBalance, weight: 1 }, needsAge: false, weigh: v => (v.power >= METHOD_PARAMS.minBalance ? 1 : 0) },
    oneAddressSybil('one_address_sybil', METHOD_PARAMS.sybilBalance),
    oneAddressSybil('one_address_sybil_10k', METHOD_PARAMS.caps.capped_10k),
    oneAddressSybil('one_address_sybil_100k', METHOD_PARAMS.caps.capped_100k),
    oneAddressSybil('one_address_sybil_1m', METHOD_PARAMS.cap),
    oneAddressSybil('one_address_sybil_age', METHOD_PARAMS.sybilBalance, true),
    oneAddressSybil('one_address_sybil_age_10k', METHOD_PARAMS.caps.capped_10k, true),
    oneAddressSybil('one_address_sybil_age_100k', METHOD_PARAMS.caps.capped_100k, true),
    oneAddressSybil('one_address_sybil_age_1m', METHOD_PARAMS.cap, true),
    { key: 'address_age', family: 'address', resistance: 'very_low', sybil: DUST_ADDRESS, needsAge: true, weigh: v => (v.ageDays === null || v.power <= 0 ? 0 : 1 + years(v)) },
    // Age belongs to the account, not to the XRD: bought XRD sent to an old account count in full.
    { key: 'one_year', family: 'seniority', resistance: 'high', sybil: { kind: 'capital', perXrd: 1, years: 1 }, needsAge: true, weigh: v => ((v.ageDays ?? -1) >= DAY_YEAR ? v.power : 0) },
    { key: 'veterans', family: 'seniority', resistance: 'high', sybil: { kind: 'capital', perXrd: 1, years: METHOD_PARAMS.veteranDays / DAY_YEAR }, needsAge: true, weigh: v => (isVeteran(v) ? v.power : 0) },
    {
        key: 'veterans_address', family: 'seniority', resistance: 'medium',
        sybil: { kind: 'addresses', xrd: DUST, weight: 1, years: METHOD_PARAMS.veteranDays / DAY_YEAR },
        needsAge: true,
        weigh: v => (isVeteran(v) && v.power > 0 ? 1 : 0),
    },
    {
        key: 'veterans_bonus', family: 'seniority', resistance: 'high',
        sybil: { kind: 'capital', perXrd: 1 + METHOD_PARAMS.bonusPerYear * (METHOD_PARAMS.veteranDays / DAY_YEAR), years: METHOD_PARAMS.veteranDays / DAY_YEAR },
        needsAge: true,
        weigh: v => (isVeteran(v) ? v.power * bonus(v) : 0),
    },
    { key: 'seniority_bonus', family: 'seniority', resistance: 'high', sybil: CAPITAL, needsAge: true, weigh: v => (v.ageDays === null ? 0 : v.power * bonus(v)) },
    { key: 'twab_90d', family: 'seniority', resistance: 'high', sybil: CAPITAL, needsAge: true, weigh: v => (v.twab90Xrd ?? 0) },
    { key: 'held_90d', family: 'seniority', resistance: 'high', sybil: CAPITAL, needsAge: true, weigh: v => (v.min90Xrd ?? 0) },
    { key: 'hybrid_half', family: 'hybrid', resistance: 'low', sybil: { kind: 'hybrid' }, needsAge: false, weigh: (v, ctx) => (v.power > 0 && ctx.total > 0 ? 0.5 * (v.power / ctx.total) + 0.5 / ctx.count : 0) },
    {
        key: 'hybrid_half_veterans', family: 'hybrid', resistance: 'medium',
        sybil: { kind: 'hybrid', minXrd: METHOD_PARAMS.minBalance, years: METHOD_PARAMS.veteranDays / DAY_YEAR },
        needsAge: true,
        weigh: (v, ctx) => (isVeteranFunded(v) && ctx.veteranFundedTotal > 0 ? 0.5 * (v.power / ctx.veteranFundedTotal) + 0.5 / ctx.veteranFundedCount : 0),
    },
    { key: 'double_majority', family: 'hybrid', resistance: 'medium', sybil: { kind: 'double' }, needsAge: false, headcount: true, weigh: v => v.power },
    {
        key: 'double_majority_sybil', family: 'hybrid', resistance: 'medium',
        sybil: { kind: 'double', minXrd: METHOD_PARAMS.minBalance, years: METHOD_PARAMS.veteranDays / DAY_YEAR },
        needsAge: true,
        headcount: true,
        headcountFilter: isVeteranFunded,
        weigh: v => v.power,
    },
    cappedVeterans('capped_veterans', METHOD_PARAMS.cap),
    cappedVeterans('capped_veterans_5m', METHOD_PARAMS.caps.capped_5m),
    cappedVeterans('capped_veterans_10m', METHOD_PARAMS.caps.capped_10m),
    {
        key: 'capped_share_veterans_1', family: 'hybrid', resistance: 'high',
        sybil: { kind: 'capital', perXrd: 1, capShare: METHOD_PARAMS.capShare, years: METHOD_PARAMS.veteranDays / DAY_YEAR },
        needsAge: true,
        weigh: (v, ctx) => (isVeteran(v) ? Math.min(v.power, ctx.veteranTotal * METHOD_PARAMS.capShare) : 0),
    },
    {
        key: 'capped_share_veterans', family: 'hybrid', resistance: 'high',
        sybil: { kind: 'capital', perXrd: 1, capShare: METHOD_PARAMS.veteranShareCap, years: METHOD_PARAMS.veteranDays / DAY_YEAR },
        needsAge: true,
        weigh: (v, ctx) => (isVeteran(v) ? Math.min(v.power, ctx.veteranTotal * METHOD_PARAMS.veteranShareCap) : 0),
    },
    {
        key: 'staked_capped_share', family: 'hybrid', resistance: 'high',
        sybil: { kind: 'capital', perXrd: 1, capShare: METHOD_PARAMS.veteranShareCap },
        needsAge: true,
        weigh: (v, ctx) => (v.stakedXrd != null && ctx.stakedTotal > 0 ? Math.min(v.stakedXrd, ctx.stakedTotal * METHOD_PARAMS.veteranShareCap) : 0),
    },
    {
        key: 'twab_90d_capped_share', family: 'hybrid', resistance: 'high',
        sybil: { kind: 'capital', perXrd: 1, capShare: METHOD_PARAMS.veteranShareCap },
        needsAge: true,
        weigh: (v, ctx) => (v.twab90Xrd != null && ctx.twabTotal > 0 ? Math.min(v.twab90Xrd, ctx.twabTotal * METHOD_PARAMS.veteranShareCap) : 0),
    },
    {
        // Progressive soft cap for veterans: 100 % up to 100k, 50 % up to 1M, 10 % above 1M.
        // Splitting never exceeds 1 XRD = 1 vote; dodging the marginal drop requires 2-year-old accounts of 100k XRD each.
        key: 'marginal_veterans', family: 'hybrid', resistance: 'high',
        sybil: { kind: 'capital', perXrd: 1, cap: METHOD_PARAMS.marginalBrackets.first, years: METHOD_PARAMS.veteranDays / DAY_YEAR },
        needsAge: true,
        weigh: v => (isVeteran(v) ? marginalWeight(v.power) : 0),
    },
    { key: 'quadratic_seniority', family: 'hybrid', resistance: 'very_low', sybil: DUST_ADDRESS, needsAge: true, weigh: v => (v.ageDays === null ? 0 : Math.sqrt(v.power) * bonus(v)) },
    {
        key: 'sybil_quadratic', family: 'hybrid', resistance: 'medium',
        // The cheapest weight per XRD is the smallest balance that counts.
        sybil: { kind: 'addresses', xrd: METHOD_PARAMS.sybilBalance, weight: Math.sqrt(METHOD_PARAMS.sybilBalance), years: METHOD_PARAMS.sybilDays / DAY_YEAR },
        needsAge: true,
        weigh: v => (isSybilSafe(v) ? Math.sqrt(v.power) : 0),
    },
    // Splitting keeps the largest wallets out of the excluded places.
    { key: 'no_top1', family: 'hybrid', resistance: 'low', sybil: CAPITAL, needsAge: false, weigh: (v, ctx) => (v.account === ctx.largest ? 0 : v.power) },
    { key: 'no_whales', family: 'hybrid', resistance: 'low', sybil: CAPITAL, needsAge: false, weigh: (v, ctx) => (ctx.whales.has(v.account) ? 0 : v.power) },
    { key: 'whales_only', family: 'hybrid', resistance: 'high', sybil: { kind: 'capital', perXrd: 1, minXrd: METHOD_PARAMS.whaleMin }, needsAge: false, weigh: v => (v.power >= METHOD_PARAMS.whaleMin ? v.power : 0) },
];

/** The rule the governance systems actually use. */
export const CURRENT_METHOD: MethodKey = 'linear';

export interface Concentration {
    /** Fewest voters that together hold more than half of the weight. */
    nakamoto: number | null;
    /**
     * Degree of decentralisation, 0..1: effective voters over voters (Simpson
     * evenness, from the Herfindahl index). 1 when every address weighs the
     * same. Unlike the Nakamoto coefficient it takes every address into
     * account, has no jumps with few voters and does not hang on the 50 % line.
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
        spread: nakamoto === null ? null : 1 / sumSq / w.length,
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
    /** Counted addresses behind each option, by ballot key. */
    addressesByChoice: Record<string, number>;
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
    resistance: Resistance;
    /** Cheapest way found to flip the result by adding votes; null when there is no clear result to flip. */
    attack: Attack | null;
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

/** Counts the ballots with one rule. */
function applyMethod(
    spec: MethodSpec,
    voters: Array<{ v: MethodVoter; side: Side }>,
    ctx: WeighContext,
    choices: BallotChoice[],
    item: GovernanceItem | null,
): Omit<MethodResult, 'sameAsCurrent'> {
    const weighed = voters.map(({ v, side }) => ({ v, w: Math.max(0, spec.weigh(v, ctx)), side })).filter(x => x.w > 0);
    const byChoice = new Map<string, number>();
    const xrdByChoice = new Map<string, number>();
    for (const { v, w } of weighed) {
        for (const k of v.choices) {
            byChoice.set(k, (byChoice.get(k) ?? 0) + w);
            xrdByChoice.set(k, (xrdByChoice.get(k) ?? 0) + v.power);
        }
    }
    const results = [...byChoice].map(([vote, w]) => ({ vote, votePower: String(w) }));
    const addressesByChoice: Record<string, number> = {};
    for (const { v } of weighed) for (const k of v.choices) addressesByChoice[k] = (addressesByChoice[k] ?? 0) + 1;
    // Quorum is an XRD rule: it is checked apart, with the XRD of the voters that count.
    const summary = summarizeTally(choices, { results, accountPower: null }, item ? { ...item, quorum: null } : null);
    const eligibleXrd = [...xrdByChoice.values()].reduce((s, x) => s + x, 0);
    const quorumRatio = item?.quorum ? eligibleXrd / item.quorum : null;
    const quorumMet = quorumRatio === null ? null : quorumRatio >= 1;
    const threshold = item?.approvalThreshold ?? 0.5;

    const pro = weighed.filter(x => x.side === 'for').length;
    const con = weighed.filter(x => x.side === 'against').length;
    const headcountPool = spec.headcountFilter ? weighed.filter(x => spec.headcountFilter!(x.v)) : weighed;
    const hcPro = headcountPool.filter(x => x.side === 'for').length;
    const hcCon = headcountPool.filter(x => x.side === 'against').length;
    const headcountShare = spec.headcount && hcPro + hcCon > 0 ? hcPro / (hcPro + hcCon) : null;
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
        addressesByChoice,
        approvalShare: weighed.length ? summary.approvalShare : null,
        headcountShare,
        eligibleXrd,
        quorumRatio,
        quorumMet,
        outcome,
        winner,
        concentration: concentration(weighed.map(x => x.w)),
        decisive: decisiveVoters(weighed, outcome, winner, threshold, spec.headcount),
        resistance: spec.resistance,
        attack: attackCost(spec, outcome, summary.rows, {
            pro, con, hcPro, hcCon,
            proXrd: weighed.filter(x => x.side === 'for').reduce((s, x) => s + x.v.power, 0),
            conXrd: weighed.filter(x => x.side === 'against').reduce((s, x) => s + x.v.power, 0),
            total: weighed.reduce((s, x) => s + x.v.power, 0),
            count: weighed.length,
        }, threshold),
    };
}

const verdict = (r: Pick<MethodResult, 'outcome' | 'winner'>) => r.outcome ?? r.winner?.key ?? null;

/** Every rule applied to the same ballots, the current one first. */
export function compareMethods(voters: MethodVoter[], choices: BallotChoice[], item: GovernanceItem | null): MethodResult[] {
    const counted = voters.filter(v => v.power > 0);
    const ctx = buildWeighContext(counted);
    const toneOf = new Map(choices.map(c => [c.key, c.tone]));
    const prepared = counted.map(v => {
        const tones = v.choices.map(k => toneOf.get(k));
        const side: Side = tones.includes('positive') ? 'for' : tones.includes('negative') ? 'against' : 'neutral';
        return { v, side };
    });
    const results = METHODS.map(spec => applyMethod(spec, prepared, ctx, choices, item));
    const current = results.find(r => r.current);
    return results.map(r => ({
        ...r,
        sameAsCurrent: r.current || !current || r.counted === 0 ? null : verdict(r) === verdict(current),
    }));
}

/** Resistance to manipulation on a 0..1 scale. */
export const RESISTANCE_SCORE: Record<Resistance, number> = { very_low: 0, low: 1 / 3, medium: 2 / 3, high: 1 };

/**
 * How balanced a rule is, 0..1: the geometric mean of its resistance to
 * manipulation and its degree of decentralisation. Only a rule that is both
 * hard to game and spreads power scores high; failing at either sinks it.
 */
export function balanceScoreOf(resistance: Resistance, spread: number | null): number {
    // Rounded so float noise (0.9999… against 1) never breaks a real tie.
    return Math.round(Math.sqrt(RESISTANCE_SCORE[resistance] * (spread ?? 0)) * 1e6) / 1e6;
}

export function balanceScore(r: Pick<MethodResult, 'resistance' | 'concentration'>): number {
    return balanceScoreOf(r.resistance, r.concentration.spread);
}

/** Most and least decentralised items, rounded so float noise never breaks a real tie. */
export function spreadExtremes<T>(items: T[], getSpread: (item: T) => number | null): { most?: T; least?: T } {
    const round = (x: T) => Math.round((getSpread(x) ?? 0) * 1e6) / 1e6;
    let most: T | undefined;
    let least: T | undefined;
    for (const item of items) {
        const s = round(item);
        if (!most || s > round(most)) most = item;
        if (!least || s < round(least)) least = item;
    }
    return { most, least };
}

/**
 * Generic version of `balanceExtremes`: finds the most and least balanced items
 * using a custom `spread` accessor.
 */
export function balanceExtremesBy<T extends { resistance: Resistance }>(
    items: T[],
    getSpread: (item: T) => number | null,
): { most?: T; least?: T } {
    const gap = (r: T) => Math.abs(RESISTANCE_SCORE[r.resistance] - (getSpread(r) ?? 0));
    const scoreOf = (r: T) => balanceScoreOf(r.resistance, getSpread(r));
    let most: T | undefined;
    let least: T | undefined;
    for (const r of items) {
        const score = scoreOf(r);
        if (!most || score > scoreOf(most)) most = r;
        if (!least || score < scoreOf(least) || (score === scoreOf(least) && gap(r) > gap(least))) least = r;
    }
    return { most, least };
}

/**
 * The most and the least balanced rules. Ties go to the rule listed first for
 * the most balanced; for the least, to the most lopsided one (the widest gap
 * between resistance and decentralisation).
 */
export function balanceExtremes<T extends Pick<MethodResult, 'resistance' | 'concentration'>>(results: T[]): { most?: T; least?: T } {
    return balanceExtremesBy(results, r => r.concentration.spread);
}

/**
 * 3-factor effectiveness score (0..1): geometric mean of resistance,
 * decentralisation, and quorum/validity rate.
 */
export function effectiveScoreOf(resistance: Resistance, spread: number | null, validRate: number): number {
    return Math.round(Math.cbrt(RESISTANCE_SCORE[resistance] * (spread ?? 0) * Math.max(0, Math.min(1, validRate))) * 1e6) / 1e6;
}

/** Generic most and least effective items using custom `spread`, `validRate`, and tie-break accessors. */
export function effectiveExtremesBy<T extends { resistance: Resistance }>(
    items: T[],
    getSpread: (item: T) => number | null,
    getValidRate: (item: T) => number,
    getTieProgress: (item: T) => number = getValidRate,
): { most?: T; least?: T } {
    const scoreOf = (r: T) => effectiveScoreOf(r.resistance, getSpread(r), getValidRate(r));
    let most: T | undefined;
    let least: T | undefined;
    for (const r of items) {
        const s = scoreOf(r);
        if (!most || s > scoreOf(most)) most = r;
        if (
            !least
            || s < scoreOf(least)
            || (s === scoreOf(least) && getTieProgress(r) < getTieProgress(least))
            || (s === scoreOf(least) && getTieProgress(r) === getTieProgress(least) && (getSpread(r) ?? 0) < (getSpread(least) ?? 0))
        ) {
            least = r;
        }
    }
    return { most, least };
}

/** Single-vote effectiveness score (0..1). */
export function effectiveScore(r: Pick<MethodResult, 'resistance' | 'concentration' | 'counted' | 'quorumMet'>): number {
    return effectiveScoreOf(r.resistance, r.concentration.spread, r.counted > 0 && r.quorumMet !== false ? 1 : 0);
}

/** Most and least effective rules on a single vote (resistance × decentralisation × quorum). */
export function effectiveExtremes<T extends Pick<MethodResult, 'resistance' | 'concentration' | 'counted' | 'quorumMet' | 'quorumRatio'>>(results: T[]): { most?: T; least?: T } {
    return effectiveExtremesBy(
        results,
        r => r.concentration.spread,
        r => (r.counted > 0 && r.quorumMet !== false ? 1 : 0),
        r => (r.counted === 0 ? 0 : r.quorumRatio === null ? 1 : Math.min(1, r.quorumRatio)),
    );
}
