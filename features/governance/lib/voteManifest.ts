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
    account: string;
    selection: VoteSelection;
}): string {
    const { component, kind, itemId, account, selection } = params;
    if (!ADDRESS.test(component) || !ADDRESS.test(account)) throw new Error('Invalid address');
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
    return [
        'CALL_METHOD',
        `    Address("${component}")`,
        `    "${method}"`,
        `    Address("${account}")`,
        `    ${itemId}u64`,
        `    ${vote}`,
        ';',
        'CALL_METHOD',
        `    Address("${account}")`,
        '    "deposit_batch"',
        '    Expression("ENTIRE_WORKTOP")',
        ';',
        '',
    ].join('\n');
}
