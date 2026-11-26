/**
 * Catalogue of the 50 governance voting methods and their weighting rules.
 *
 * Re-exported from `votingMethods.ts` so all existing imports stay stable.
 */

export interface MethodVoter {
    account: string;
    /** Ballot keys picked (option ids or a stance). */
    choices: string[];
    /** Per-candidate grade index (0..4) for Majority Judgment elections, keyed by candidate id. */
    grades?: Record<string, number>;
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
export const isVeteran = (v: MethodVoter) => (v.ageDays ?? -1) >= METHOD_PARAMS.veteranDays;
export const isVeteranFunded = (v: MethodVoter) => isVeteran(v) && v.power >= METHOD_PARAMS.minBalance;
const isSybilSafe = (v: MethodVoter) => v.power >= METHOD_PARAMS.sybilBalance && (v.ageDays ?? -1) >= METHOD_PARAMS.sybilDays;

/** Piecewise-linear diminishing marginal weight: 100 % up to 100k, 50 % up to 1M, 10 % above 1M. */
function marginalWeight(xrd: number): number {
    const { first, second, midRate, topRate } = METHOD_PARAMS.marginalBrackets;
    if (xrd <= 0) return 0;
    if (xrd <= first) return xrd;
    if (xrd <= second) return first + (xrd - first) * midRate;
    return first + (second - first) * midRate + (xrd - second) * topRate;
}

export interface WeighContext {
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
export type SybilProfile =
    | { kind: 'capital'; perXrd: number; years?: number; minXrd?: number; cap?: number; capShare?: number }
    | { kind: 'addresses'; xrd: number; weight: number; years?: number }
    | { kind: 'hybrid'; minXrd?: number; years?: number }
    | { kind: 'double'; minXrd?: number; years?: number };

export interface MethodSpec {
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

export const DUST = 1;

/** 1 XRD = 1 vote up to `cap` XRD per address. */
function capped(key: MethodKey, cap: number): MethodSpec {
    return { key, family: 'wealth', resistance: 'low', sybil: { kind: 'capital', perXrd: 1, cap }, needsAge: false, weigh: v => Math.min(v.power, cap) };
}

/** 1 XRD = 1 vote up to `cap` XRD per address, only for veteran accounts (2+ years). */
function cappedVeterans(key: MethodKey, cap: number): MethodSpec {
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
        key: 'marginal_veterans', family: 'hybrid', resistance: 'high',
        sybil: { kind: 'capital', perXrd: 1, cap: METHOD_PARAMS.marginalBrackets.first, years: METHOD_PARAMS.veteranDays / DAY_YEAR },
        needsAge: true,
        weigh: v => (isVeteran(v) ? marginalWeight(v.power) : 0),
    },
    { key: 'quadratic_seniority', family: 'hybrid', resistance: 'very_low', sybil: DUST_ADDRESS, needsAge: true, weigh: v => (v.ageDays === null ? 0 : Math.sqrt(v.power) * bonus(v)) },
    {
        key: 'sybil_quadratic', family: 'hybrid', resistance: 'medium',
        sybil: { kind: 'addresses', xrd: METHOD_PARAMS.sybilBalance, weight: Math.sqrt(METHOD_PARAMS.sybilBalance), years: METHOD_PARAMS.sybilDays / DAY_YEAR },
        needsAge: true,
        weigh: v => (isSybilSafe(v) ? Math.sqrt(v.power) : 0),
    },
    { key: 'no_top1', family: 'hybrid', resistance: 'low', sybil: CAPITAL, needsAge: false, weigh: (v, ctx) => (v.account === ctx.largest ? 0 : v.power) },
    { key: 'no_whales', family: 'hybrid', resistance: 'low', sybil: CAPITAL, needsAge: false, weigh: (v, ctx) => (ctx.whales.has(v.account) ? 0 : v.power) },
    { key: 'whales_only', family: 'hybrid', resistance: 'high', sybil: { kind: 'capital', perXrd: 1, minXrd: METHOD_PARAMS.whaleMin }, needsAge: false, weigh: v => (v.power >= METHOD_PARAMS.whaleMin ? v.power : 0) },
];

/** The rule the governance systems actually use. */
export const CURRENT_METHOD: MethodKey = 'linear';
