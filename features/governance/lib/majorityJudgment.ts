import type { GovernanceElectionSpec } from './governanceVotes';

/**
 * Shared Majority Judgment constants, helpers, and tally evaluation.
 *
 * Used by both the 50-method comparator (`votingMethods.ts`) and all election
 * UI components (Results, Comparison, Explorer tx card, Method guide drawer).
 */

export const MJ_GRADE_ORDER = [4, 3, 2, 1, 0] as const;

export const MJ_GRADE_BAR_COLOR: Record<number, string> = {
    4: 'bg-emerald-500',
    3: 'bg-teal-400',
    2: 'bg-[var(--color-primary)]',
    1: 'bg-amber-400',
    0: 'bg-rose-500',
};

export const MJ_GRADE_DOT_COLOR: Record<number, string> = {
    4: 'bg-emerald-500',
    3: 'bg-teal-400',
    2: 'bg-[var(--color-primary)]',
    1: 'bg-amber-400',
    0: 'bg-rose-500',
};

export const MJ_GRADE_ABBR_COLOR: Record<number, string> = {
    4: 'text-emerald-600 dark:text-emerald-400',
    3: 'text-teal-600 dark:text-teal-400',
    2: 'text-[var(--color-primary)]',
    1: 'text-amber-600 dark:text-amber-400',
    0: 'text-rose-600 dark:text-rose-400',
};

export const MJ_GRADE_PILL_COLOR: Record<number, string> = {
    4: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    3: 'border-teal-400/35 bg-teal-400/10 text-teal-600 dark:text-teal-400',
    2: 'border-[var(--color-primary)]/35 bg-[var(--color-primary)]/10 text-[var(--color-primary)]',
    1: 'border-amber-400/35 bg-amber-400/10 text-amber-600 dark:text-amber-400',
    0: 'border-rose-500/35 bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

export interface MjTextSlice {
    grades?: readonly string[];
    band_hint_A?: string;
    band_hint_B?: string;
    band_hint_C?: string;
}

export function gradeLabel(mj: MjTextSlice | undefined, grade: number): string {
    return mj?.grades?.[grade] ?? String(grade);
}

export function bandHint(mj: MjTextSlice | undefined, band: string): string | undefined {
    if (band === 'A') return mj?.band_hint_A;
    if (band === 'B') return mj?.band_hint_B;
    if (band === 'C') return mj?.band_hint_C;
    return undefined;
}

const MJ_BAND_ORDER: Record<'A' | 'B' | 'C', number> = { A: 2, B: 1, C: 0 };
const MJ_DEFAULT_QUANTILE = 0.6;
const MJ_EPS = 1e-12;

/** Parses a rational quantile like "3/5" or decimal like "0.6" into a 0..1 number. */
export function parseQuantile(raw?: string | null): number {
    if (!raw) return MJ_DEFAULT_QUANTILE;
    const parts = raw.split('/');
    if (parts.length === 2) {
        const num = Number(parts[0]);
        const den = Number(parts[1]);
        if (Number.isFinite(num) && Number.isFinite(den) && den > 0 && num > 0 && num <= den) {
            return num / den;
        }
    }
    const dec = Number(raw);
    if (Number.isFinite(dec) && dec > 0 && dec <= 1) return dec;
    return MJ_DEFAULT_QUANTILE;
}

export type ElectionCandidateOutcome = 'elected' | 'tied' | 'reserve' | 'not_elected';

export interface ElectionMethodCandidate {
    id: number;
    label: string;
    /** Qualifying grade index (0..4) at the applied quantile (default 3/5 = 60%). */
    qualifyingGrade: number;
    /** Majority gauge band: A (p > q), B (p = q), C (p < q). */
    band: 'A' | 'B' | 'C';
    /** Share of total weight strictly above the qualifying grade. */
    p: number;
    /** Share of total weight strictly below the qualifying grade. */
    q: number;
    /** Real XRD of counted voters who gave this candidate its qualifying grade. */
    qualifyingXrd: number;
    /** Share of total weight at or above the minimum qualifying grade. */
    electableShare: number;
    electable: boolean;
    /** Competition rank (1, 1, 3…) — tied candidates share the same rank. */
    rank: number;
    /** True when another candidate has the exact same qualifying grade and majority gauge. */
    tied: boolean;
    outcome: ElectionCandidateOutcome;
}

export interface ElectionMethodSummary {
    seatCount: number;
    minimumMedianGrade: number;
    standings: ElectionMethodCandidate[];
    /** Candidates unambiguously elected (their entire tie group fits within seatCount). */
    elected: ElectionMethodCandidate[];
    /** Candidates in a tie group straddling the seatCount boundary (not arbitrarily broken by id). */
    tiedAtCutoff: ElectionMethodCandidate[];
    /** Number of seats that differ from 1 XRD = 1 vote (null for current or when no voters count). */
    seatsChanged: number | null;
    /** Candidate names entering the elected slate compared with 1 XRD = 1 vote. */
    entered: string[];
    /** Candidate names leaving the elected slate compared with 1 XRD = 1 vote. */
    left: string[];
}

export interface MajorityJudgmentBallot {
    grades?: Record<string, number>;
    power: number;
}

function qualifyingGradeFromHist(hist: number[], total: number, quantile: number): number {
    let acc = 0;
    for (let g = 4; g >= 0; g--) {
        acc += hist[g];
        if (acc + MJ_EPS >= total * quantile) return g;
    }
    return 0;
}

type RawMjCandidate = Omit<ElectionMethodCandidate, 'rank' | 'tied' | 'outcome'>;

function compareMjGauge(a: RawMjCandidate, b: RawMjCandidate): number {
    if (b.qualifyingGrade !== a.qualifyingGrade) return b.qualifyingGrade - a.qualifyingGrade;
    if (MJ_BAND_ORDER[b.band] !== MJ_BAND_ORDER[a.band]) return MJ_BAND_ORDER[b.band] - MJ_BAND_ORDER[a.band];
    if (a.band === 'A') {
        if (Math.abs(b.p - a.p) > MJ_EPS) return b.p - a.p;
        if (Math.abs(a.q - b.q) > MJ_EPS) return a.q - b.q;
    } else if (a.band === 'C') {
        if (Math.abs(a.q - b.q) > MJ_EPS) return a.q - b.q;
        if (Math.abs(b.p - a.p) > MJ_EPS) return b.p - a.p;
    } else if (Math.abs(b.p - a.p) > MJ_EPS) {
        return b.p - a.p;
    }
    return 0;
}

/**
 * Evaluates a Majority Judgment election using each voter's weight `w` under a given voting method.
 * Uses the applied grade quantile (default 3/5 = 60%), Majority Gauge tie-breaking (Band A > B > C, p, q),
 * true competition ranking without arbitrary tie-breaking by candidate id, and optional headcount floor
 * for double-majority rules.
 */
export function evaluateMajorityJudgment(
    weighed: Array<{ v: MajorityJudgmentBallot; w: number }>,
    election: GovernanceElectionSpec,
    options?: {
        quantile?: number;
        headcountPool?: Array<{ v: MajorityJudgmentBallot }>;
    },
): ElectionMethodSummary {
    const seatCount = election.seatCount ?? 7;
    const minimumMedianGrade = election.minimumMedianGrade ?? 2;
    const quantile = options?.quantile ?? MJ_DEFAULT_QUANTILE;
    const headcountPool = options?.headcountPool;

    const raw: RawMjCandidate[] = election.candidates.map(candidate => {
        const key = String(candidate.id);
        const hist = [0, 0, 0, 0, 0];
        const xrdHist = [0, 0, 0, 0, 0];
        for (const { v, w } of weighed) {
            const g = v.grades?.[key];
            if (g !== undefined && g >= 0 && g <= 4) {
                hist[g] += w;
                xrdHist[g] += v.power;
            }
        }
        const total = hist[0] + hist[1] + hist[2] + hist[3] + hist[4];
        if (total <= 0) {
            return {
                id: candidate.id,
                label: candidate.displayName,
                qualifyingGrade: 0,
                band: 'B',
                p: 0,
                q: 0,
                qualifyingXrd: 0,
                electableShare: 0,
                electable: false,
            };
        }
        const qualifyingGrade = qualifyingGradeFromHist(hist, total, quantile);
        let above = 0;
        let below = 0;
        let electablePower = 0;
        for (let g = 0; g <= 4; g++) {
            if (g > qualifyingGrade) above += hist[g];
            else if (g < qualifyingGrade) below += hist[g];
            if (g >= minimumMedianGrade) electablePower += hist[g];
        }
        const p = above / total;
        const q = below / total;
        const band: 'A' | 'B' | 'C' = p > q + MJ_EPS ? 'A' : q > p + MJ_EPS ? 'C' : 'B';

        let headcountOk = true;
        if (headcountPool) {
            const hcHist = [0, 0, 0, 0, 0];
            for (const { v } of headcountPool) {
                const g = v.grades?.[key];
                if (g !== undefined && g >= 0 && g <= 4) hcHist[g] += 1;
            }
            const hcTotal = hcHist[0] + hcHist[1] + hcHist[2] + hcHist[3] + hcHist[4];
            headcountOk = hcTotal > 0 && qualifyingGradeFromHist(hcHist, hcTotal, quantile) >= minimumMedianGrade;
        }

        return {
            id: candidate.id,
            label: candidate.displayName,
            qualifyingGrade,
            band,
            p,
            q,
            qualifyingXrd: xrdHist[qualifyingGrade],
            electableShare: electablePower / total,
            electable: qualifyingGrade >= minimumMedianGrade && headcountOk,
        };
    });

    raw.sort((a, b) => {
        if (a.electable !== b.electable) return a.electable ? -1 : 1;
        const cmp = compareMjGauge(a, b);
        return cmp !== 0 ? cmp : a.id - b.id;
    });

    const groups: RawMjCandidate[][] = [];
    for (const cand of raw) {
        const last = groups[groups.length - 1];
        if (last && last[0].electable === cand.electable && compareMjGauge(last[0], cand) === 0) {
            last.push(cand);
        } else {
            groups.push([cand]);
        }
    }

    const standings: ElectionMethodCandidate[] = [];
    let rankCursor = 1;
    let electablePlaced = 0;
    for (const group of groups) {
        const isTied = group.length > 1;
        const isElectable = group[0].electable;
        let groupOutcome: ElectionCandidateOutcome;
        if (!isElectable) {
            groupOutcome = 'not_elected';
        } else if (electablePlaced + group.length <= seatCount) {
            groupOutcome = 'elected';
        } else if (electablePlaced < seatCount) {
            groupOutcome = 'tied';
        } else {
            groupOutcome = 'reserve';
        }
        for (const cand of group) {
            standings.push({
                ...cand,
                rank: rankCursor,
                tied: isTied,
                outcome: groupOutcome,
            });
        }
        rankCursor += group.length;
        if (isElectable) electablePlaced += group.length;
    }

    const elected = standings.filter(c => c.outcome === 'elected');
    const tiedAtCutoff = standings.filter(c => c.outcome === 'tied');

    return {
        seatCount,
        minimumMedianGrade,
        standings,
        elected,
        tiedAtCutoff,
        seatsChanged: null,
        entered: [],
        left: [],
    };
}
