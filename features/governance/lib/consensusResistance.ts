import type { MethodKey } from './methodCatalog';
import type { MethodResult } from './votingMethods';

export type ConsensusAttackId =
    | 'cheap_sybil'
    | 'funded_sybil'
    | 'opportunistic_whale'
    | 'split_whale'
    | 'veteran_whale'
    | 'veteran_sybil_farm'
    | 'nation_state';

export interface ConsensusAttackScenario {
    id: ConsensusAttackId;
    /** Exact share (0..1) of the weighted consensus controllable by this technique. */
    maxShare: number;
    /** Number of evaluated methods fully or partially affected. */
    affectedCount: number;
    /** Total evaluated methods in the consensus. */
    totalMethods: number;
}

const CHEAP_SYBIL_FULL = new Set<MethodKey>([
    'quadratic', 'cube_root', 'logarithmic', 'tiered',
    'one_address', 'address_age', 'quadratic_seniority',
]);
const FUNDED_SYBIL_FULL = new Set<MethodKey>([
    ...CHEAP_SYBIL_FULL,
    'one_address_min',
]);
const OPPORTUNISTIC_WHALE_FULL = new Set<MethodKey>([
    'linear', 'deductible_linear', 'staked_only', 'whales_only', 'seniority_bonus',
]);
const SPLIT_WHALE_FULL = new Set<MethodKey>([
    'linear', 'deductible_linear', 'staked_only',
    'capped_10k', 'capped_100k', 'capped', 'capped_5m', 'capped_10m',
    'capped_share', 'capped_share_5', 'capped_share_10',
    'quadratic', 'cube_root', 'logarithmic', 'tiered',
    'one_address', 'one_address_min', 'address_age',
    'seniority_bonus',
    'hybrid_half', 'double_majority', 'staked_capped_share',
    'quadratic_seniority', 'no_top1', 'no_whales', 'whales_only',
]);
const VETERAN_WHALE_FULL = new Set<MethodKey>([
    'linear', 'deductible_linear', 'staked_only',
    'one_year', 'veterans', 'veterans_bonus', 'seniority_bonus', 'twab_90d', 'held_90d',
    'whales_only', 'marginal_veterans',
]);
const VETERAN_SYBIL_FULL = new Set<MethodKey>([
    'quadratic', 'cube_root', 'logarithmic', 'tiered',
    'one_address', 'address_age',
    'one_address_sybil', 'one_address_sybil_age',
    'veterans_address',
    'quadratic_seniority', 'sybil_quadratic',
]);

const ATTACK_CAPTURE_RULES: ReadonlyArray<{
    id: ConsensusAttackId;
    captureRatio: (key: MethodKey) => number;
}> = [
    {
        id: 'cheap_sybil',
        captureRatio: k => (CHEAP_SYBIL_FULL.has(k) ? 1 : k === 'hybrid_half' ? 0.5 : 0),
    },
    {
        id: 'funded_sybil',
        captureRatio: k => (FUNDED_SYBIL_FULL.has(k) ? 1 : k === 'hybrid_half' ? 0.5 : 0),
    },
    {
        id: 'opportunistic_whale',
        captureRatio: k => (OPPORTUNISTIC_WHALE_FULL.has(k) ? 1 : k === 'hybrid_half' ? 0.5 : 0),
    },
    {
        id: 'split_whale',
        captureRatio: k => (SPLIT_WHALE_FULL.has(k) ? 1 : 0),
    },
    {
        id: 'veteran_whale',
        captureRatio: k => (VETERAN_WHALE_FULL.has(k) ? 1 : (k === 'hybrid_half' || k === 'hybrid_half_veterans') ? 0.5 : 0),
    },
    {
        id: 'veteran_sybil_farm',
        captureRatio: k => (VETERAN_SYBIL_FULL.has(k) ? 1 : k === 'hybrid_half' ? 0.5 : 0),
    },
    {
        id: 'nation_state',
        captureRatio: () => 1,
    },
];

/**
 * Exact control share for the baseline `1 XRD = 1 vote` method under each of
 * the 7 attack scenarios (immune to wallet splitting; 100 % controllable with
 * > 60 % of snapshot XRD).
 */
export const CURRENT_ATTACK_SHARES: ReadonlyArray<{ id: ConsensusAttackId; maxShare: number }> = [
    { id: 'cheap_sybil', maxShare: 0 },
    { id: 'funded_sybil', maxShare: 0 },
    { id: 'opportunistic_whale', maxShare: 1 },
    { id: 'split_whale', maxShare: 1 },
    { id: 'veteran_whale', maxShare: 1 },
    { id: 'veteran_sybil_farm', maxShare: 0 },
    { id: 'nation_state', maxShare: 1 },
];

/**
 * Computes the exact share of the weighted consensus controllable under each
 * attack technique using the live normalized weights of the evaluated methods.
 */
export function computeConsensusResistance(
    methods: MethodResult[],
    methodWeights: Partial<Record<MethodKey, number>>,
): ConsensusAttackScenario[] {
    const evaluated = methods.filter(m => m.electionSummary && m.counted > 0 && (methodWeights[m.key] ?? 0) > 0);
    const totalMethods = evaluated.length;
    return ATTACK_CAPTURE_RULES.map(rule => {
        let share = 0;
        let affectedCount = 0;
        for (const m of evaluated) {
            const ratio = rule.captureRatio(m.key);
            if (ratio > 0) {
                share += (methodWeights[m.key] ?? 0) * ratio;
                affectedCount += 1;
            }
        }
        return {
            id: rule.id,
            maxShare: Math.min(1, Math.max(0, share)),
            affectedCount,
            totalMethods,
        };
    });
}
