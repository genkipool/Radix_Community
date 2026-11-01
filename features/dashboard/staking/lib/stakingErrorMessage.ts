/**
 * The text shown for a failed staking transaction. The error is the wallet's
 * code (`rejectedByUser`, `failedToSignTransaction`, `timeout`…) or a free
 * sentence from elsewhere, so both spellings are recognised; anything else is
 * shown as it came.
 */

export type StakingErrorTexts = Partial<Record<StakingErrorKind, string>>;

type StakingErrorKind =
    | 'failedToPrepareTransaction'
    | 'rejectedByUser'
    | 'failedToSignTransaction'
    | 'failedToSubmitTransaction'
    | 'failedToCompileTransaction'
    | 'timeout';

/** Recognised by what the error contains, once lower-cased and without spaces. */
const KINDS: ReadonlyArray<[StakingErrorKind, string]> = [
    ['failedToPrepareTransaction', 'failedtoprepare'],
    ['rejectedByUser', 'rejected'],
    ['failedToSignTransaction', 'failedtosign'],
    ['failedToSubmitTransaction', 'failedtosubmit'],
    ['failedToCompileTransaction', 'failedtocompile'],
    ['timeout', 'timeout'],
];

const FALLBACK: Record<StakingErrorKind, string> = {
    failedToPrepareTransaction: 'Failed to prepare transaction. Check your manifest.',
    rejectedByUser: 'Transaction rejected by user.',
    failedToSignTransaction: 'Failed to sign transaction.',
    failedToSubmitTransaction: 'Failed to submit transaction.',
    failedToCompileTransaction: 'Failed to compile transaction.',
    timeout: 'The wallet did not answer in time. Please try again.',
};

export function stakingErrorMessage(error: string, texts?: StakingErrorTexts): string {
    const key = error.toLowerCase().replace(/\s+/g, '');
    const kind = KINDS.find(([, contains]) => key.includes(contains))?.[0];
    return kind ? texts?.[kind] || FALLBACK[kind] : error;
}
