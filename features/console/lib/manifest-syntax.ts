/**
 * Lightweight tokenizer for Radix Transaction Manifest (RTM) syntax.
 * Colors map to the `--code-*` CSS variables defined by every theme.
 */

export type ManifestTokenType =
  | 'keyword'
  | 'type'
  | 'string'
  | 'number'
  | 'comment'
  | 'punct'
  | 'plain';

export interface ManifestToken {
  type: ManifestTokenType;
  text: string;
}

/* Groups (in order): comment, string, number, INSTRUCTION, Constructor, punct */
const TOKEN_RE =
  /(#[^\n]*)|("(?:[^"\\]|\\.)*"?)|(\b\d[\w.]*\b)|(\b[A-Z][A-Z0-9_]{2,}\b)|(\b(?:true|false)\b|\b[A-Z][A-Za-z0-9]*\b)|(=>|[()<>,;{}[\]|&=])/g;

const GROUP_TYPES: ManifestTokenType[] = ['comment', 'string', 'number', 'keyword', 'type', 'punct'];

export function tokenizeManifest(code: string): ManifestToken[] {
  const tokens: ManifestToken[] = [];
  let lastIndex = 0;

  for (const match of code.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push({ type: 'plain', text: code.slice(lastIndex, index) });
    }
    const groupIndex = match.slice(1).findIndex((group) => group !== undefined);
    tokens.push({ type: GROUP_TYPES[groupIndex] ?? 'plain', text: match[0] });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < code.length) {
    tokens.push({ type: 'plain', text: code.slice(lastIndex) });
  }
  return tokens;
}

/** Inline style per token type, driven by the active theme's code palette. */
export const MANIFEST_TOKEN_STYLES: Record<ManifestTokenType, React.CSSProperties> = {
  keyword: { color: 'var(--code-keyword)', fontWeight: 700 },
  type: { color: 'var(--code-type)' },
  string: { color: 'var(--code-string)' },
  number: { color: 'var(--code-type)' },
  comment: { color: 'var(--code-comment)', fontStyle: 'italic' },
  punct: { color: 'var(--code-punct)' },
  plain: { color: 'var(--color-text-main)' },
};

/* ─── Autocomplete vocabulary ─────────────────────────────────────────────── */

const INSTRUCTIONS = [
  'CALL_METHOD',
  'CALL_FUNCTION',
  'TAKE_FROM_WORKTOP',
  'TAKE_ALL_FROM_WORKTOP',
  'TAKE_NON_FUNGIBLES_FROM_WORKTOP',
  'RETURN_TO_WORKTOP',
  'ASSERT_WORKTOP_CONTAINS',
  'ASSERT_WORKTOP_CONTAINS_ANY',
  'ASSERT_WORKTOP_CONTAINS_NON_FUNGIBLES',
  'ASSERT_WORKTOP_IS_EMPTY',
  'POP_FROM_AUTH_ZONE',
  'PUSH_TO_AUTH_ZONE',
  'DROP_AUTH_ZONE_PROOFS',
  'DROP_AUTH_ZONE_REGULAR_PROOFS',
  'DROP_AUTH_ZONE_SIGNATURE_PROOFS',
  'CREATE_PROOF_FROM_AUTH_ZONE_OF_AMOUNT',
  'CREATE_PROOF_FROM_AUTH_ZONE_OF_NON_FUNGIBLES',
  'CREATE_PROOF_FROM_AUTH_ZONE_OF_ALL',
  'CREATE_PROOF_FROM_BUCKET_OF_AMOUNT',
  'CREATE_PROOF_FROM_BUCKET_OF_NON_FUNGIBLES',
  'CREATE_PROOF_FROM_BUCKET_OF_ALL',
  'BURN_RESOURCE',
  'CLONE_PROOF',
  'DROP_PROOF',
  'DROP_ALL_PROOFS',
  'PUBLISH_PACKAGE',
  'PUBLISH_PACKAGE_ADVANCED',
  'CREATE_FUNGIBLE_RESOURCE',
  'CREATE_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY',
  'CREATE_NON_FUNGIBLE_RESOURCE',
  'CREATE_NON_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY',
  'CREATE_IDENTITY',
  'CREATE_IDENTITY_ADVANCED',
  'CREATE_ACCOUNT',
  'CREATE_ACCOUNT_ADVANCED',
  'CREATE_VALIDATOR',
  'MINT_FUNGIBLE',
  'MINT_NON_FUNGIBLE',
  'SET_METADATA',
  'REMOVE_METADATA',
  'LOCK_METADATA',
  'RECALL_FROM_VAULT',
  'RECALL_NON_FUNGIBLES_FROM_VAULT',
  'FREEZE_VAULT',
  'UNFREEZE_VAULT',
  'SET_OWNER_ROLE',
  'LOCK_OWNER_ROLE',
  'SET_ROLE',
  'SET_COMPONENT_ROYALTY',
  'LOCK_COMPONENT_ROYALTY',
  'CLAIM_COMPONENT_ROYALTIES',
  'ALLOCATE_GLOBAL_ADDRESS',
  'YIELD_TO_PARENT',
  'YIELD_TO_CHILD',
  'VERIFY_PARENT',
  'ENTIRE_WORKTOP',
  'ENTIRE_AUTH_ZONE',
];

const CONSTRUCTORS = [
  'Address',
  'AddressReservation',
  'Array',
  'Blob',
  'Bucket',
  'Bytes',
  'Decimal',
  'Enum',
  'Expression',
  'Map',
  'NamedAddress',
  'None',
  'NonFungibleGlobalId',
  'NonFungibleLocalId',
  'PreciseDecimal',
  'Proof',
  'Some',
  'Tuple',
  'true',
  'false',
];

const COMMON_METHODS = [
  'withdraw',
  'withdraw_non_fungibles',
  'deposit',
  'deposit_batch',
  'try_deposit_or_abort',
  'try_deposit_batch_or_abort',
  'try_deposit_or_refund',
  'try_deposit_batch_or_refund',
  'create_proof_of_amount',
  'create_proof_of_non_fungibles',
  'stake',
  'stake_as_owner',
  'unstake',
  'claim_xrd',
  'lock_owner_stake_units',
  'start_unlock_owner_stake_units',
  'finish_unlock_owner_stake_units',
  'update_non_fungible_data',
  'free',
];

export const MANIFEST_COMPLETIONS: string[] = [
  ...INSTRUCTIONS,
  ...CONSTRUCTORS,
  ...COMMON_METHODS,
];

/**
 * Completion candidates for the word being typed (case-insensitive prefix),
 * excluding an exact match.
 */
export function manifestCompletions(word: string, limit = 8): string[] {
  if (word.length < 2) return [];
  const lower = word.toLowerCase();
  return MANIFEST_COMPLETIONS
    .filter((candidate) => candidate.toLowerCase().startsWith(lower) && candidate !== word)
    .slice(0, limit);
}
