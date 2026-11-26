import type { GovernanceItemKind, VoteSelection } from './governanceVotes';

/** Order of the `TemperatureCheckVote` enum in the governance blueprint. */
const STANCE_VARIANT: Record<string, number> = { For: 0, Against: 1 };

const ADDRESS = /^[a-z0-9_]+$/;

/**
 * Transaction manifest casting (or replacing) a vote.
 *
 * No `lock_fee`: the wallet adds its own fee payment and refuses a request
 * that already locks one.
 *
 * The closing `deposit_batch` on the voting account is not optional. The
 * blueprint asserts the account's owner rule, and the wallet only signs with
 * accounts whose owner-protected methods the manifest calls; passing the
 * account as a plain argument is not enough. Without it the wallet does not
 * sign with that account, its preview fails and it answers
 * `failedToPrepareTransaction`. The official dApp ends its vote the same way.
 */
export function buildVoteManifest(params: {
    component: string;
    kind: GovernanceItemKind;
    itemId: string;
    /** One or more accounts; each casts the same vote in the same transaction. */
    accounts: string[];
    selection: VoteSelection;
}): string {
    const { component, kind, itemId, accounts, selection } = params;
    const unique = [...new Set(accounts)];
    if (unique.length === 0) throw new Error('At least one account is needed');
    if (!ADDRESS.test(component) || !unique.every(a => ADDRESS.test(a))) throw new Error('Invalid address');
    if (!/^\d{1,19}$/.test(itemId)) throw new Error('Invalid item id');

    let vote: string;
    if (kind === 'temperature_check') {
        if (selection.type !== 'stance' || !(selection.stance in STANCE_VARIANT)) throw new Error('A temperature check takes For or Against');
        vote = `Enum<${STANCE_VARIANT[selection.stance]}u8>()`;
    } else {
        if (selection.type !== 'options' || selection.optionIds.length === 0) throw new Error('A proposal takes at least one option');
        if (!selection.optionIds.every(id => Number.isInteger(id) && id >= 0 && id <= 0xffffffff)) throw new Error('Invalid option id');
        vote = `Array<Tuple>(${selection.optionIds.map(id => `Tuple(${id}u32)`).join(', ')})`;
    }

    const method = kind === 'temperature_check' ? 'vote_on_temperature_check' : 'vote_on_proposal';
    const votes = unique.flatMap(account => [
        'CALL_METHOD',
        `    Address("${component}")`,
        `    "${method}"`,
        `    Address("${account}")`,
        `    ${itemId}u64`,
        `    ${vote}`,
        ';',
    ]);
    // One owner-protected call per account, so the wallet asks every one of them to sign.
    const signers = unique.flatMap(account => [
        'CALL_METHOD',
        `    Address("${account}")`,
        '    "deposit_batch"',
        '    Expression("ENTIRE_WORKTOP")',
        ';',
    ]);
    return [...votes, ...signers, ''].join('\n');
}

/**
 * Transaction manifest casting (or replacing) a Majority Judgment election
 * ballot. Every candidate must be graded on the 0..4 scale (Poor..Excellent).
 */
export function buildElectionVoteManifest(params: {
    component: string;
    electionId: string;
    round: 'RoundOne' | 'Rerun';
    accounts: string[];
    grades: Array<{ candidateId: number; grade: number }>;
}): string {
    const { component, electionId, round, accounts, grades } = params;
    const unique = [...new Set(accounts)];
    if (unique.length === 0) throw new Error('At least one account is needed');
    if (!ADDRESS.test(component) || !unique.every(a => ADDRESS.test(a))) throw new Error('Invalid address');
    if (!/^\d{1,19}$/.test(electionId)) throw new Error('Invalid election id');
    if (grades.length === 0) throw new Error('At least one candidate grade is needed');

    const sorted = [...grades].sort((a, b) => a.candidateId - b.candidateId);
    for (const { candidateId, grade } of sorted) {
        if (!Number.isInteger(candidateId) || candidateId < 0 || candidateId > 0xffffffff) throw new Error('Invalid candidate id');
        if (!Number.isInteger(grade) || grade < 0 || grade > 4) throw new Error('Invalid grade');
    }

    const roundEnum = round === 'Rerun' ? 'Enum<1u8>()' : 'Enum<0u8>()';
    const gradesArg = `Array<Tuple>(${sorted.map(({ candidateId, grade }) => `Tuple(Tuple(${candidateId}u32), Enum<${grade}u8>())`).join(', ')})`;

    const votes = unique.flatMap(account => [
        'CALL_METHOD',
        `    Address("${component}")`,
        '    "vote_on_majority_judgment_election"',
        `    Address("${account}")`,
        `    ${electionId}u64`,
        `    ${roundEnum}`,
        `    ${gradesArg}`,
        ';',
    ]);
    const signers = unique.flatMap(account => [
        'CALL_METHOD',
        `    Address("${account}")`,
        '    "deposit_batch"',
        '    Expression("ENTIRE_WORKTOP")',
        ';',
    ]);
    return [...votes, ...signers, ''].join('\n');
}
