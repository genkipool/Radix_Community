import { formatPct, formatXrd } from './format';
import {
    METHOD_PARAMS,
    marginalWeight,
    type MethodKey,
    type Resistance,
} from './methodCatalog';
import type { ConsensusAttackId } from './consensusResistance';

/** Live or historical aggregates passed into `computeMethodResistance` for exact calculations. */
export interface MethodResistanceMetrics {
    counted: number;
    eligibleXrd: number;
    totalWeight: number;
    decisiveQuantileCount?: number | null;
    decisiveCount?: number | null;
    decisiveOf?: number | null;
    validVotesCount?: number;
    totalVotes?: number;
    avgNakamoto?: number | null;
    isElection?: boolean;
    isHistorical?: boolean;
    quantile?: number;
    singleWhaleShareOverride?: number | null;
    lastMinTwabSingleShareOverride?: number | null;
}

export interface MethodAttackEval {
    id: ConsensusAttackId;
    /** Exact mathematically derived control/impact share (0..1). */
    maxShare: number;
    /** Translation key under `governance.compare` describing what the attack captures. */
    capturesKey: string;
    /** Translation key under `governance.compare` describing what blocks the attack. */
    blockedKey: string;
    /** Verified parameter values interpolated into the locale templates. */
    params: Record<string, string>;
}

export interface MethodResistanceReport {
    key: MethodKey;
    resistance: Resistance;
    hasLiveData: boolean;
    intro1Key: string;
    tableNoteKey: string;
    nuancePositiveKey: string;
    nuanceWarningKey: string;
    summaryKey: string;
    params: Record<string, string>;
    scenarios: MethodAttackEval[];
}

type ArchKey =
    | 'linear'
    | 'deductible'
    | 'staked_only'
    | 'capped_10k'
    | 'capped_fixed'
    | 'capped_share'
    | 'sublinear_very_low'
    | 'one_address'
    | 'one_address_min'
    | 'sybil_addr_1k'
    | 'sybil_addr_high'
    | 'address_age'
    | 'age_gate_linear'
    | 'veterans_address'
    | 'seniority_bonus'
    | 'twab_90d'
    | 'held_90d'
    | 'hybrid_half'
    | 'hybrid_half_veterans'
    | 'double_majority'
    | 'double_majority_sybil'
    | 'capped_veterans_fixed'
    | 'capped_veterans_share'
    | 'staked_capped_share'
    | 'twab_90d_capped_share'
    | 'marginal_veterans'
    | 'sybil_quadratic'
    | 'no_top1'
    | 'no_whales'
    | 'whales_only';

interface ScenarioSpec {
    maxShare: number;
    capturesKey: string;
    blockedKey: string;
}

function shareAfterAddition(totalWeight: number, attackerWeight: number, hasLive: boolean, noLiveFallback: number): number {
    if (!hasLive) return noLiveFallback;
    if (attackerWeight <= 0) return 0;
    return Math.min(1, Math.max(0, attackerWeight / (totalWeight + attackerWeight)));
}

function resolveArchetype(key: MethodKey): {
    arch: ArchKey;
    resistance: Resistance;
    capAmount?: number;
    shareCap?: number;
    minXrd?: number;
    years?: number;
    withAgeBonus?: boolean;
} {
    switch (key) {
        case 'linear':
            return { arch: 'linear', resistance: 'high' };
        case 'deductible_linear':
            return { arch: 'deductible', resistance: 'high', minXrd: METHOD_PARAMS.minBalance };
        case 'staked_only':
            return { arch: 'staked_only', resistance: 'high' };
        case 'capped_10k':
            return { arch: 'capped_10k', resistance: 'low', capAmount: METHOD_PARAMS.caps.capped_10k, minXrd: METHOD_PARAMS.caps.capped_10k };
        case 'capped_100k':
            return { arch: 'capped_fixed', resistance: 'low', capAmount: METHOD_PARAMS.caps.capped_100k };
        case 'capped':
            return { arch: 'capped_fixed', resistance: 'low', capAmount: METHOD_PARAMS.cap };
        case 'capped_5m':
            return { arch: 'capped_fixed', resistance: 'low', capAmount: METHOD_PARAMS.caps.capped_5m };
        case 'capped_10m':
            return { arch: 'capped_fixed', resistance: 'low', capAmount: METHOD_PARAMS.caps.capped_10m };
        case 'capped_share':
            return { arch: 'capped_share', resistance: 'low', shareCap: METHOD_PARAMS.capShare };
        case 'capped_share_5':
            return { arch: 'capped_share', resistance: 'low', shareCap: METHOD_PARAMS.capShares.capped_share_5 };
        case 'capped_share_10':
            return { arch: 'capped_share', resistance: 'low', shareCap: METHOD_PARAMS.capShares.capped_share_10 };
        case 'quadratic':
        case 'cube_root':
        case 'logarithmic':
        case 'tiered':
        case 'quadratic_seniority':
            return { arch: 'sublinear_very_low', resistance: 'very_low' };
        case 'one_address':
            return { arch: 'one_address', resistance: 'very_low' };
        case 'one_address_min':
            return { arch: 'one_address_min', resistance: 'low', minXrd: METHOD_PARAMS.minBalance };
        case 'one_address_sybil':
            return { arch: 'sybil_addr_1k', resistance: 'medium', minXrd: METHOD_PARAMS.sybilBalance, years: 1, withAgeBonus: false };
        case 'one_address_sybil_age':
            return { arch: 'sybil_addr_1k', resistance: 'medium', minXrd: METHOD_PARAMS.sybilBalance, years: 1, withAgeBonus: true };
        case 'one_address_sybil_10k':
            return { arch: 'sybil_addr_high', resistance: 'medium', minXrd: METHOD_PARAMS.caps.capped_10k, years: 1, withAgeBonus: false };
        case 'one_address_sybil_100k':
            return { arch: 'sybil_addr_high', resistance: 'medium', minXrd: METHOD_PARAMS.caps.capped_100k, years: 1, withAgeBonus: false };
        case 'one_address_sybil_1m':
            return { arch: 'sybil_addr_high', resistance: 'medium', minXrd: METHOD_PARAMS.cap, years: 1, withAgeBonus: false };
        case 'one_address_sybil_age_10k':
            return { arch: 'sybil_addr_high', resistance: 'medium', minXrd: METHOD_PARAMS.caps.capped_10k, years: 1, withAgeBonus: true };
        case 'one_address_sybil_age_100k':
            return { arch: 'sybil_addr_high', resistance: 'medium', minXrd: METHOD_PARAMS.caps.capped_100k, years: 1, withAgeBonus: true };
        case 'one_address_sybil_age_1m':
            return { arch: 'sybil_addr_high', resistance: 'medium', minXrd: METHOD_PARAMS.cap, years: 1, withAgeBonus: true };
        case 'address_age':
            return { arch: 'address_age', resistance: 'very_low' };
        case 'one_year':
            return { arch: 'age_gate_linear', resistance: 'high', years: 1, withAgeBonus: false };
        case 'veterans':
            return { arch: 'age_gate_linear', resistance: 'high', years: 2, withAgeBonus: false };
        case 'veterans_bonus':
            return { arch: 'age_gate_linear', resistance: 'high', years: 2, withAgeBonus: true };
        case 'veterans_address':
            return { arch: 'veterans_address', resistance: 'medium', years: 2 };
        case 'seniority_bonus':
            return { arch: 'seniority_bonus', resistance: 'high' };
        case 'twab_90d':
            return { arch: 'twab_90d', resistance: 'high' };
        case 'held_90d':
            return { arch: 'held_90d', resistance: 'high' };
        case 'hybrid_half':
            return { arch: 'hybrid_half', resistance: 'low' };
        case 'hybrid_half_veterans':
            return { arch: 'hybrid_half_veterans', resistance: 'medium', minXrd: METHOD_PARAMS.minBalance, years: 2 };
        case 'double_majority':
            return { arch: 'double_majority', resistance: 'medium' };
        case 'double_majority_sybil':
            return { arch: 'double_majority_sybil', resistance: 'medium', minXrd: METHOD_PARAMS.minBalance, years: 2 };
        case 'capped_veterans':
            return { arch: 'capped_veterans_fixed', resistance: 'high', capAmount: METHOD_PARAMS.cap, years: 2 };
        case 'capped_veterans_5m':
            return { arch: 'capped_veterans_fixed', resistance: 'high', capAmount: METHOD_PARAMS.caps.capped_5m, years: 2 };
        case 'capped_veterans_10m':
            return { arch: 'capped_veterans_fixed', resistance: 'high', capAmount: METHOD_PARAMS.caps.capped_10m, years: 2 };
        case 'capped_share_veterans_1':
            return { arch: 'capped_veterans_share', resistance: 'high', shareCap: METHOD_PARAMS.capShare, years: 2 };
        case 'capped_share_veterans':
            return { arch: 'capped_veterans_share', resistance: 'high', shareCap: METHOD_PARAMS.veteranShareCap, years: 2 };
        case 'staked_capped_share':
            return { arch: 'staked_capped_share', resistance: 'high', shareCap: METHOD_PARAMS.veteranShareCap };
        case 'twab_90d_capped_share':
            return { arch: 'twab_90d_capped_share', resistance: 'high', shareCap: METHOD_PARAMS.veteranShareCap };
        case 'marginal_veterans':
            return { arch: 'marginal_veterans', resistance: 'high', years: 2 };
        case 'sybil_quadratic':
            return { arch: 'sybil_quadratic', resistance: 'medium', minXrd: METHOD_PARAMS.sybilBalance, years: 1 };
        case 'no_top1':
            return { arch: 'no_top1', resistance: 'low' };
        case 'no_whales':
            return { arch: 'no_whales', resistance: 'low' };
        case 'whales_only':
            return { arch: 'whales_only', resistance: 'high', minXrd: METHOD_PARAMS.whaleMin };
        default: {
            const _exhaustive: never = key;
            return _exhaustive;
        }
    }
}

const CAP = (capturesKey: string, blockedKey: string, maxShare: number): ScenarioSpec => ({
    maxShare,
    capturesKey,
    blockedKey,
});

/**
 * Computes the exact attack-resistance profile of any of the 50 voting methods
 * from its mathematical specification (`methodCatalog.ts`) and live/historical metrics.
 */
export function computeMethodResistance(
    key: MethodKey,
    metrics: MethodResistanceMetrics,
    language = 'en',
): MethodResistanceReport {
    const info = resolveArchetype(key);
    const { arch, resistance } = info;
    const E = Math.max(0, metrics.eligibleXrd);
    const W = Math.max(0, metrics.totalWeight);
    const hasLive = metrics.counted > 0 && W > 0 && E > 0;
    // >60 % of post-attack raw participating XRD (P / (E + P) = 60 % => P = 1.5 * E).
    const whaleCapital = 1.5 * E;
    const cap = info.capAmount ?? METHOD_PARAMS.cap;
    const shareCap = info.shareCap ?? METHOD_PARAMS.capShare;
    const minXrd = info.minXrd ?? METHOD_PARAMS.minBalance;
    const yrs = info.years ?? 2;

    const singleSublinearWeight = (veteran: boolean): number => {
        if (!hasLive) return 0;
        switch (key) {
            case 'quadratic': return Math.sqrt(whaleCapital);
            case 'cube_root': return Math.cbrt(whaleCapital);
            case 'logarithmic': return Math.log10(1 + whaleCapital);
            case 'tiered': return 1 + METHOD_PARAMS.tiers.filter(t => whaleCapital >= t).length;
            case 'quadratic_seniority': return Math.sqrt(whaleCapital) * (veteran ? 1 + METHOD_PARAMS.bonusPerYear * 2 : 1);
            default: return 0;
        }
    };

    const singleCapShareWeight = (rawPower: number, basePool: number) =>
        Math.min(rawPower, (basePool + rawPower) * shareCap);

    // Build exact per-attack specifications grounded directly in the rule above.
    const map: Record<ConsensusAttackId, ScenarioSpec> = {
        cheap_sybil: CAP('method_res_cap_none_dust_linear', 'method_res_blk_linear_no_mult', 0),
        funded_sybil: CAP('method_res_cap_none_no_majority', 'method_res_blk_no_capital_majority', 0),
        opportunistic_whale: CAP('method_res_cap_whale_100', 'method_res_blk_none_snapshot', 1),
        split_whale: CAP('method_res_cap_split_linear_100', 'method_res_blk_none_snapshot', 1),
        veteran_whale: CAP('method_res_cap_vet_whale_100', 'method_res_blk_vet_whale_none', 1),
        veteran_sybil_farm: CAP('method_res_cap_none_no_majority', 'method_res_blk_no_capital_majority', 0),
        nation_state: CAP('method_res_cap_nation_state_100', 'method_res_blk_nation_state_capital', 1),
    };

    const fundedBypass = hasLive && W < E ? shareAfterAddition(W, 0.25 * E, true, 0.6) : 0;
    const farmPool = hasLive ? 0.25 * E : 0;
    let farmCountValue = 0;

    switch (arch) {
        case 'linear':
            // Baseline 1 XRD = 1 vote matches CURRENT_ATTACK_SHARES 1:1.
            break;
        case 'deductible':
            map.cheap_sybil = CAP('method_res_cap_none_zero', 'method_res_blk_min_balance', 0);
            map.funded_sybil = CAP('method_res_cap_none_zero', 'method_res_blk_deductible_10k', 0);
            map.opportunistic_whale = CAP('method_res_cap_whale_deductible', 'method_res_blk_deductible_once', 1);
            map.split_whale = CAP('method_res_cap_split_deductible', 'method_res_blk_deductible_split', 1);
            map.veteran_sybil_farm = CAP('method_res_cap_none_zero', 'method_res_blk_min_balance_vet', 0);
            break;
        case 'staked_only':
            map.cheap_sybil = CAP('method_res_cap_none_zero_liquid', 'method_res_blk_staked_only', 0);
            map.funded_sybil = CAP('method_res_cap_none_staked_no_maj', 'method_res_blk_staked_no_majority', 0);
            map.opportunistic_whale = CAP('method_res_cap_whale_staked', 'method_res_blk_staked_unstake', 1);
            map.split_whale = CAP('method_res_cap_split_staked', 'method_res_blk_staked_unstake', 1);
            break;
        case 'capped_10k': {
            const singleS = shareAfterAddition(W, cap, hasLive, 1);
            map.funded_sybil = CAP('method_res_cap_funded_cap10k', 'method_res_blk_none_no_age', 1);
            map.opportunistic_whale = CAP('method_res_cap_single_cap_fixed', 'method_res_blk_cap_fixed', singleS);
            map.split_whale = CAP('method_res_cap_split_dodge_cap', 'method_res_blk_none_capital', 1);
            map.veteran_whale = CAP('method_res_cap_single_cap_fixed', 'method_res_blk_cap_fixed', singleS);
            break;
        }
        case 'capped_fixed': {
            const singleS = shareAfterAddition(W, cap, hasLive, 1);
            if (fundedBypass > 0) {
                map.funded_sybil = CAP('method_res_cap_funded_bypass', 'method_res_blk_none_no_age', fundedBypass);
            }
            map.opportunistic_whale = CAP('method_res_cap_single_cap_fixed', 'method_res_blk_cap_fixed', singleS);
            map.split_whale = CAP('method_res_cap_split_dodge_cap', 'method_res_blk_none_capital', 1);
            map.veteran_whale = CAP('method_res_cap_single_cap_fixed', 'method_res_blk_cap_fixed', singleS);
            break;
        }
        case 'capped_share': {
            const singleS = metrics.singleWhaleShareOverride
                ?? shareAfterAddition(W, singleCapShareWeight(whaleCapital, E), hasLive, shareCap);
            if (fundedBypass > 0) {
                map.funded_sybil = CAP('method_res_cap_funded_bypass', 'method_res_blk_none_no_age', fundedBypass);
            }
            map.opportunistic_whale = CAP('method_res_cap_single_cap_share', 'method_res_blk_cap_share', singleS);
            map.split_whale = CAP('method_res_cap_split_dodge_share', 'method_res_blk_none_capital', 1);
            map.veteran_whale = CAP('method_res_cap_single_cap_share', 'method_res_blk_cap_share', singleS);
            break;
        }
        case 'sublinear_very_low': {
            const singleNew = shareAfterAddition(W, singleSublinearWeight(false), hasLive, 1);
            const singleVet = shareAfterAddition(W, singleSublinearWeight(true), hasLive, 1);
            map.cheap_sybil = CAP('method_res_cap_sybil_dust_100', 'method_res_blk_none_unbounded', 1);
            map.funded_sybil = CAP('method_res_cap_sybil_funded_100', 'method_res_blk_none_unbounded', 1);
            map.opportunistic_whale = CAP('method_res_cap_single_sublinear', 'method_res_blk_sublinear_single', singleNew);
            map.split_whale = CAP('method_res_cap_split_sybil_100', 'method_res_blk_none_no_age', 1);
            map.veteran_whale = CAP('method_res_cap_single_sublinear', 'method_res_blk_sublinear_single', singleVet);
            map.veteran_sybil_farm = CAP('method_res_cap_vet_farm_sublinear_100', 'method_res_blk_vet_farm_none', 1);
            break;
        }
        case 'one_address': {
            const singleS = shareAfterAddition(W, 1, hasLive, 1);
            map.cheap_sybil = CAP('method_res_cap_sybil_dust_100', 'method_res_blk_none_unbounded', 1);
            map.funded_sybil = CAP('method_res_cap_sybil_funded_100', 'method_res_blk_none_unbounded', 1);
            map.opportunistic_whale = CAP('method_res_cap_single_address', 'method_res_blk_one_vote_per_addr', singleS);
            map.split_whale = CAP('method_res_cap_split_sybil_100', 'method_res_blk_none_no_age', 1);
            map.veteran_whale = CAP('method_res_cap_single_address', 'method_res_blk_one_vote_per_addr', singleS);
            map.veteran_sybil_farm = CAP('method_res_cap_vet_farm_addr_100', 'method_res_blk_vet_farm_none', 1);
            break;
        }
        case 'one_address_min': {
            const singleS = shareAfterAddition(W, 1, hasLive, 1);
            map.cheap_sybil = CAP('method_res_cap_none_zero', 'method_res_blk_min_balance', 0);
            map.funded_sybil = CAP('method_res_cap_funded_min_addr', 'method_res_blk_none_no_age', 1);
            map.opportunistic_whale = CAP('method_res_cap_single_address', 'method_res_blk_one_vote_per_addr', singleS);
            map.split_whale = CAP('method_res_cap_split_sybil_100', 'method_res_blk_none_no_age', 1);
            map.veteran_whale = CAP('method_res_cap_single_address', 'method_res_blk_one_vote_per_addr', singleS);
            map.veteran_sybil_farm = CAP('method_res_cap_none_zero', 'method_res_blk_min_balance_vet', 0);
            break;
        }
        case 'sybil_addr_1k': {
            const vetW = info.withAgeBonus ? 3 : 1;
            const vetS = shareAfterAddition(W, vetW, hasLive, 1);
            map.cheap_sybil = CAP('method_res_cap_none_zero', 'method_res_blk_age_and_min', 0);
            map.funded_sybil = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.opportunistic_whale = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.split_whale = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.veteran_whale = CAP('method_res_cap_single_address', 'method_res_blk_one_vote_per_addr', vetS);
            map.veteran_sybil_farm = CAP('method_res_cap_vet_farm_addr_100', 'method_res_blk_vet_farm_none', 1);
            break;
        }
        case 'sybil_addr_high': {
            const vetW = info.withAgeBonus ? 3 : 1;
            const vetS = shareAfterAddition(W, vetW, hasLive, 1);
            farmCountValue = hasLive ? Math.floor(farmPool / minXrd) : 0;
            const farmShare = farmCountValue > 0 ? shareAfterAddition(W, farmCountValue * vetW, true, 1) : 0;
            map.cheap_sybil = CAP('method_res_cap_none_zero', 'method_res_blk_age_and_min', 0);
            map.funded_sybil = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.opportunistic_whale = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.split_whale = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.veteran_whale = CAP('method_res_cap_single_address', 'method_res_blk_one_vote_per_addr', vetS);
            map.veteran_sybil_farm = farmShare > 0
                ? CAP('method_res_cap_vet_farm_funded_addr', 'method_res_blk_vet_farm_none', farmShare)
                : CAP('method_res_cap_none_zero', 'method_res_blk_min_balance_vet', 0);
            break;
        }
        case 'address_age': {
            const sNew = shareAfterAddition(W, 1, hasLive, 1);
            const sVet = shareAfterAddition(W, 3, hasLive, 1);
            map.cheap_sybil = CAP('method_res_cap_sybil_dust_100', 'method_res_blk_none_unbounded', 1);
            map.funded_sybil = CAP('method_res_cap_sybil_funded_100', 'method_res_blk_none_unbounded', 1);
            map.opportunistic_whale = CAP('method_res_cap_single_address', 'method_res_blk_one_vote_per_addr', sNew);
            map.split_whale = CAP('method_res_cap_split_sybil_100', 'method_res_blk_none_no_age', 1);
            map.veteran_whale = CAP('method_res_cap_single_address', 'method_res_blk_one_vote_per_addr', sVet);
            map.veteran_sybil_farm = CAP('method_res_cap_vet_farm_addr_100', 'method_res_blk_vet_farm_none', 1);
            break;
        }
        case 'age_gate_linear':
            map.cheap_sybil = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.funded_sybil = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.opportunistic_whale = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.split_whale = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            if (info.withAgeBonus) {
                const sVet = shareAfterAddition(W, whaleCapital * 1.5, hasLive, 1);
                map.veteran_whale = CAP('method_res_cap_seniority_vet_whale', 'method_res_blk_vet_whale_none', sVet);
            }
            break;
        case 'veterans_address': {
            const sVet = shareAfterAddition(W, 1, hasLive, 1);
            map.cheap_sybil = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.funded_sybil = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.opportunistic_whale = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.split_whale = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.veteran_whale = CAP('method_res_cap_single_address', 'method_res_blk_one_vote_per_addr', sVet);
            map.veteran_sybil_farm = CAP('method_res_cap_vet_farm_addr_100', 'method_res_blk_vet_farm_none', 1);
            break;
        }
        case 'seniority_bonus': {
            const sNew = shareAfterAddition(W, whaleCapital, hasLive, 0.6);
            const sVet = shareAfterAddition(W, whaleCapital * 1.5, hasLive, 1);
            map.opportunistic_whale = CAP('method_res_cap_seniority_new_whale', 'method_res_blk_seniority_bonus', sNew);
            map.split_whale = CAP('method_res_cap_seniority_new_whale', 'method_res_blk_seniority_bonus', sNew);
            map.veteran_whale = CAP('method_res_cap_seniority_vet_whale', 'method_res_blk_vet_whale_none', sVet);
            break;
        }
        case 'twab_90d': {
            const sLastMin = shareAfterAddition(W, whaleCapital * 0.25, hasLive, 0.2727);
            map.cheap_sybil = CAP('method_res_cap_none_twab_linear', 'method_res_blk_twab_no_mult', 0);
            map.funded_sybil = CAP('method_res_cap_none_twab_no_maj', 'method_res_blk_twab_no_majority', 0);
            map.opportunistic_whale = CAP('method_res_cap_twab_lastmin', 'method_res_blk_twab_three_quarters', sLastMin);
            map.split_whale = CAP('method_res_cap_twab_lastmin', 'method_res_blk_twab_three_quarters', sLastMin);
            break;
        }
        case 'held_90d':
            map.cheap_sybil = CAP('method_res_cap_none_zero', 'method_res_blk_held_90d', 0);
            map.funded_sybil = CAP('method_res_cap_none_zero', 'method_res_blk_held_90d', 0);
            map.opportunistic_whale = CAP('method_res_cap_none_zero', 'method_res_blk_held_90d', 0);
            map.split_whale = CAP('method_res_cap_none_zero', 'method_res_blk_held_90d', 0);
            break;
        case 'hybrid_half':
            map.cheap_sybil = CAP('method_res_cap_half_headcount', 'method_res_blk_half_capital', 0.5);
            map.funded_sybil = CAP('method_res_cap_half_headcount', 'method_res_blk_half_capital', 0.5);
            map.opportunistic_whale = CAP('method_res_cap_half_capital', 'method_res_blk_half_headcount', 0.5);
            map.split_whale = CAP('method_res_cap_split_sybil_100', 'method_res_blk_none_no_age', 1);
            map.veteran_whale = CAP('method_res_cap_half_capital', 'method_res_blk_half_headcount', 0.5);
            map.veteran_sybil_farm = CAP('method_res_cap_half_headcount', 'method_res_blk_half_capital', 0.5);
            break;
        case 'hybrid_half_veterans': {
            farmCountValue = hasLive ? Math.floor(farmPool / minXrd) : 0;
            const farmHalfShare = farmCountValue > 0 && metrics.counted > 0
                ? Math.min(0.5, 0.5 * (farmCountValue / (metrics.counted + farmCountValue)))
                : 0;
            map.cheap_sybil = CAP('method_res_cap_none_zero', 'method_res_blk_age_and_min', 0);
            map.funded_sybil = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.opportunistic_whale = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.split_whale = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.veteran_whale = CAP('method_res_cap_half_capital', 'method_res_blk_half_headcount', 0.5);
            map.veteran_sybil_farm = farmHalfShare > 0
                ? CAP('method_res_cap_vet_farm_half_addr', 'method_res_blk_half_capital', farmHalfShare)
                : CAP('method_res_cap_none_zero', 'method_res_blk_min_balance_vet', 0);
            break;
        }
        case 'double_majority':
            map.cheap_sybil = CAP('method_res_cap_chamber_headcount', 'method_res_blk_chamber_capital', 0.5);
            map.funded_sybil = CAP('method_res_cap_chamber_headcount', 'method_res_blk_chamber_capital', 0.5);
            map.opportunistic_whale = CAP('method_res_cap_chamber_capital', 'method_res_blk_chamber_headcount', 0.5);
            map.split_whale = CAP('method_res_cap_split_sybil_100', 'method_res_blk_none_no_age', 1);
            map.veteran_whale = CAP('method_res_cap_chamber_capital', 'method_res_blk_chamber_headcount', 0.5);
            map.veteran_sybil_farm = CAP('method_res_cap_chamber_headcount', 'method_res_blk_chamber_capital', 0.5);
            break;
        case 'double_majority_sybil': {
            farmCountValue = hasLive ? Math.floor(farmPool / minXrd) : 0;
            const farmChamberShare = farmCountValue > 0 && metrics.counted > 0
                ? Math.min(0.5, 0.5 * (farmCountValue / (metrics.counted + farmCountValue)))
                : 0;
            map.cheap_sybil = CAP('method_res_cap_none_zero_both', 'method_res_blk_age_and_min_veto', 0);
            map.funded_sybil = CAP('method_res_cap_none_no_majority', 'method_res_blk_age_and_capital', 0);
            map.opportunistic_whale = CAP('method_res_cap_chamber_capital', 'method_res_blk_chamber_vet_headcount', 0.5);
            map.split_whale = CAP('method_res_cap_chamber_capital', 'method_res_blk_chamber_vet_headcount', 0.5);
            map.veteran_whale = CAP('method_res_cap_chamber_capital', 'method_res_blk_chamber_vet_headcount', 0.5);
            map.veteran_sybil_farm = farmChamberShare > 0
                ? CAP('method_res_cap_vet_farm_half_addr', 'method_res_blk_chamber_capital', farmChamberShare)
                : CAP('method_res_cap_none_zero_both', 'method_res_blk_min_balance_vet_and_cap', 0);
            break;
        }
        case 'capped_veterans_fixed': {
            const sVet = shareAfterAddition(W, cap, hasLive, 1);
            map.cheap_sybil = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.funded_sybil = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.opportunistic_whale = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.split_whale = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.veteran_whale = CAP('method_res_cap_single_cap_fixed', 'method_res_blk_cap_fixed', sVet);
            break;
        }
        case 'capped_veterans_share': {
            const sVet = metrics.singleWhaleShareOverride
                ?? shareAfterAddition(W, singleCapShareWeight(whaleCapital, E), hasLive, shareCap);
            map.cheap_sybil = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.funded_sybil = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.opportunistic_whale = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.split_whale = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.veteran_whale = CAP('method_res_cap_single_cap_share', 'method_res_blk_cap_share', sVet);
            break;
        }
        case 'staked_capped_share': {
            const singleS = metrics.singleWhaleShareOverride
                ?? shareAfterAddition(W, singleCapShareWeight(whaleCapital, E), hasLive, shareCap);
            map.cheap_sybil = CAP('method_res_cap_none_zero_liquid', 'method_res_blk_staked_only', 0);
            map.funded_sybil = CAP('method_res_cap_none_staked_no_maj', 'method_res_blk_staked_no_majority', 0);
            map.opportunistic_whale = CAP('method_res_cap_single_cap_share_staked', 'method_res_blk_cap_share_staked', singleS);
            map.split_whale = CAP('method_res_cap_split_staked', 'method_res_blk_staked_unstake', 1);
            map.veteran_whale = CAP('method_res_cap_single_cap_share_staked', 'method_res_blk_cap_share', singleS);
            break;
        }
        case 'twab_90d_capped_share': {
            const lastMin = whaleCapital * 0.25;
            const sLastOne = metrics.lastMinTwabSingleShareOverride
                ?? shareAfterAddition(W, singleCapShareWeight(lastMin, E), hasLive, shareCap);
            const sLastSplit = shareAfterAddition(W, lastMin, hasLive, 0.2727);
            const sVetOne = metrics.singleWhaleShareOverride
                ?? shareAfterAddition(W, singleCapShareWeight(whaleCapital, E), hasLive, shareCap);
            map.cheap_sybil = CAP('method_res_cap_none_twab_linear', 'method_res_blk_twab_no_mult', 0);
            map.funded_sybil = CAP('method_res_cap_none_twab_no_maj', 'method_res_blk_twab_no_majority', 0);
            map.opportunistic_whale = CAP('method_res_cap_twab_capped_single', 'method_res_blk_twab_and_cap', sLastOne);
            map.split_whale = CAP('method_res_cap_twab_lastmin', 'method_res_blk_twab_three_quarters', sLastSplit);
            map.veteran_whale = CAP('method_res_cap_single_cap_share', 'method_res_blk_cap_share', sVetOne);
            break;
        }
        case 'marginal_veterans': {
            const sVet = shareAfterAddition(W, marginalWeight(whaleCapital), hasLive, 0.3);
            map.cheap_sybil = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.funded_sybil = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.opportunistic_whale = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.split_whale = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.veteran_whale = CAP('method_res_cap_marginal_single', 'method_res_blk_marginal_brackets', sVet);
            break;
        }
        case 'sybil_quadratic': {
            const sVet = shareAfterAddition(W, Math.sqrt(whaleCapital), hasLive, 1);
            map.cheap_sybil = CAP('method_res_cap_none_zero', 'method_res_blk_age_and_min', 0);
            map.funded_sybil = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.opportunistic_whale = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.split_whale = CAP('method_res_cap_none_zero', 'method_res_blk_age_gate', 0);
            map.veteran_whale = CAP('method_res_cap_single_sublinear', 'method_res_blk_sublinear_single', sVet);
            map.veteran_sybil_farm = CAP('method_res_cap_vet_farm_sublinear_100', 'method_res_blk_vet_farm_none', 1);
            break;
        }
        case 'no_top1':
            if (fundedBypass > 0) {
                map.funded_sybil = CAP('method_res_cap_funded_bypass', 'method_res_blk_none_no_age', fundedBypass);
            }
            map.opportunistic_whale = CAP('method_res_cap_none_zero', 'method_res_blk_no_top1', 0);
            map.split_whale = CAP('method_res_cap_split_dodge_excl', 'method_res_blk_none_capital', 1);
            map.veteran_whale = CAP('method_res_cap_none_zero', 'method_res_blk_no_top1', 0);
            break;
        case 'no_whales':
            if (fundedBypass > 0) {
                map.funded_sybil = CAP('method_res_cap_funded_bypass', 'method_res_blk_none_no_age', fundedBypass);
            }
            map.opportunistic_whale = CAP('method_res_cap_none_zero', 'method_res_blk_no_whales', 0);
            map.split_whale = CAP('method_res_cap_split_dodge_excl', 'method_res_blk_none_capital', 1);
            map.veteran_whale = CAP('method_res_cap_none_zero', 'method_res_blk_no_whales', 0);
            break;
        case 'whales_only':
            map.cheap_sybil = CAP('method_res_cap_none_zero', 'method_res_blk_min_balance', 0);
            map.funded_sybil = CAP('method_res_cap_none_zero', 'method_res_blk_min_balance', 0);
            map.veteran_sybil_farm = CAP('method_res_cap_none_zero', 'method_res_blk_min_balance_vet', 0);
            break;
    }

    const commonParams: Record<string, string> = {
        cap: cap.toLocaleString(language),
        min: minXrd.toLocaleString(language),
        share: formatPct(shareCap, language),
        years: yrs.toLocaleString(language),
        farmCount: farmCountValue.toLocaleString(language),
        bracketFirst: METHOD_PARAMS.marginalBrackets.first.toLocaleString(language),
        bracketSecond: METHOD_PARAMS.marginalBrackets.second.toLocaleString(language),
        counted: metrics.counted.toLocaleString(language),
        xrd: formatXrd(metrics.eligibleXrd, language),
        weight: formatXrd(metrics.totalWeight, language),
        valid: (metrics.validVotesCount ?? 0).toLocaleString(language),
        total: (metrics.totalVotes ?? 0).toLocaleString(language),
        nakamoto: metrics.avgNakamoto != null ? metrics.avgNakamoto.toLocaleString(language, { maximumFractionDigits: 1 }) : '—',
        quantilePct: formatPct(metrics.quantile ?? 0.6, language),
    };

    const scenarios: MethodAttackEval[] = (Object.keys(map) as ConsensusAttackId[]).map(id => {
        const spec = map[id];
        return {
            id,
            maxShare: spec.maxShare,
            capturesKey: spec.capturesKey,
            blockedKey: spec.blockedKey,
            params: { ...commonParams, pct: formatPct(spec.maxShare, language) },
        };
    });

    const highestNonNation = Math.max(
        ...scenarios.filter(s => s.id !== 'nation_state').map(s => s.maxShare),
    );
    const decisiveCount = metrics.isElection ? (metrics.decisiveQuantileCount ?? 0) : (metrics.decisiveCount ?? 0);
    const decisiveOf = metrics.isElection ? metrics.counted : (metrics.decisiveOf ?? metrics.counted);
    const decisivePct = decisiveOf > 0 ? formatPct(decisiveCount / decisiveOf, language) : '0 %';

    const reportParams: Record<string, string> = {
        ...commonParams,
        maxVector: formatPct(highestNonNation, language),
        decisiveCount: decisiveCount.toLocaleString(language),
        decisiveOf: decisiveOf.toLocaleString(language),
        decisivePct,
    };

    const intro1Key = `method_res_intro1_${resistance}`;
    const tableNoteKey = !hasLive
        ? 'method_res_table_note_empty'
        : metrics.isHistorical
            ? 'method_res_table_note_hist'
            : 'method_res_table_note_live';

    const sybilSafe = map.cheap_sybil.maxShare === 0
        && map.funded_sybil.maxShare === 0
        && map.veteran_sybil_farm.maxShare === 0;
    const nuancePositiveKey = sybilSafe && resistance === 'high'
        && map.opportunistic_whale.maxShare === 0
        && map.split_whale.maxShare === 0
        ? 'method_res_pos_high_time_locked'
        : sybilSafe && resistance === 'high'
            ? 'method_res_pos_high_sybil_immune'
            : sybilSafe && resistance === 'medium'
                ? 'method_res_pos_medium_sybil_immune'
                : resistance === 'medium'
                    ? 'method_res_pos_medium_aged'
                    : resistance === 'low'
                        ? (map.cheap_sybil.maxShare === 0 ? 'method_res_pos_low_capped' : 'method_res_pos_low_split')
                        : 'method_res_pos_very_low';

    const nuanceWarningKey = !hasLive
        ? 'method_res_warn_empty'
        : metrics.isHistorical
            ? 'method_res_warn_hist'
            : metrics.isElection
                ? 'method_res_warn_election'
                : (decisiveCount > 0 ? 'method_res_warn_standard' : 'method_res_warn_no_decisive');

    const summaryKey = `method_res_summary_${resistance}`;

    return {
        key,
        resistance,
        hasLiveData: hasLive,
        intro1Key,
        tableNoteKey,
        nuancePositiveKey,
        nuanceWarningKey,
        summaryKey,
        params: reportParams,
        scenarios,
    };
}
