/**
 * Manifest builders for managing resources you control (my-resources tool):
 * minting, burning, locking metadata, owner-role changes, recall and freeze.
 */

const escape = (text: string) => text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

export const DEPOSIT_ALL_SUFFIX = (account: string) => `
CALL_METHOD
    Address("${account}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
`;

export const mintFungibleManifest = (resource: string, amount: string) => `
MINT_FUNGIBLE
    Address("${resource}")
    Decimal("${amount}")
;
`;

/**
 * The local-id type a non-fungible resource was created with. It is FIXED at
 * creation and the engine rejects a mint whose ids are of any other type with
 * `NonFungibleResourceManagerError(InvalidNonFungibleIdType)`, so every mint
 * has to be built from the resource's own type rather than assumed.
 *
 * Matches the Gateway's `non_fungible_id_type`.
 */
export type NonFungibleIdKind = 'String' | 'Integer' | 'Bytes' | 'Ruid';

/** Local-id syntax per type, as the transaction manifest spells it. */
const ID_PATTERNS: Record<NonFungibleIdKind, RegExp> = {
  // u64, e.g. #12#
  Integer: /^#\d{1,20}#$/,
  // up to 64 alphanumerics/underscore, e.g. <invoice_2026>
  String: /^<[A-Za-z0-9_]{1,64}>$/,
  // 1..64 bytes as hex pairs, e.g. [c0ffee]
  Bytes: /^\[(?:[0-9a-fA-F]{2}){1,64}\]$/,
  // 4 x 16 hex digits, e.g. {1111111111111111-...}
  Ruid: /^\{[0-9a-fA-F]{16}-[0-9a-fA-F]{16}-[0-9a-fA-F]{16}-[0-9a-fA-F]{16}\}$/,
};

/** Example id per type, for placeholders. Manifest syntax, not translatable. */
export const NFT_ID_EXAMPLES: Record<NonFungibleIdKind, string> = {
  Integer: '#12#',
  String: '<invoice_2026>',
  Bytes: '[c0ffee]',
  Ruid: '{1111111111111111-2222222222222222-3333333333333333-4444444444444444}',
};

/** How the type is written for humans (the Gateway spells RUID as `Ruid`). */
export function nonFungibleIdKindLabel(kind: NonFungibleIdKind): string {
  return kind === 'Ruid' ? 'RUID' : kind;
}

/**
 * Normalise whatever the Gateway reports into a known kind, case-insensitively.
 * The spelling is the API's to choose (`Ruid` today, `RUID` in other places in
 * the docs), and reading a pattern for an unrecognised one crashed the page, so
 * anything unexpected falls back to the overwhelmingly common Integer.
 */
export function toNonFungibleIdKind(raw: unknown): NonFungibleIdKind {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  const match = (Object.keys(ID_PATTERNS) as NonFungibleIdKind[]).find(
    (kind) => kind.toLowerCase() === value,
  );
  return match ?? 'Integer';
}

/** Pattern lookup that survives an unknown kind instead of throwing. */
const patternFor = (kind: NonFungibleIdKind): RegExp =>
  ID_PATTERNS[kind] ?? ID_PATTERNS.Integer;

/**
 * Wrap a bare value in the local-id syntax of `kind`, leaving an
 * already-delimited id untouched. Lets the user type `12` or `#12#`.
 */
export function formatNonFungibleLocalId(kind: NonFungibleIdKind, raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  if (patternFor(kind).test(value)) return value;
  const bare = value.replace(/^[#<[{]|[#>\]}]$/g, '').trim();
  if (!bare) return '';
  switch (kind) {
    case 'Integer':
      return `#${bare}#`;
    case 'String':
      return `<${bare}>`;
    case 'Bytes':
      return `[${bare}]`;
    case 'Ruid':
      return `{${bare}}`;
  }
}

export function isValidNonFungibleLocalId(kind: NonFungibleIdKind, id: string): boolean {
  return patternFor(kind).test(id.trim());
}

/**
 * A free id to pre-fill the form with. Only integer ids can be guessed: string
 * and byte ids are the caller's to choose, and RUIDs are assigned by the
 * ledger, never by the minter.
 */
export function suggestNonFungibleLocalId(
  kind: NonFungibleIdKind,
  existingIds: string[],
): string {
  if (kind !== 'Integer') return '';
  const highest = existingIds.reduce((max, id) => {
    const match = /^#(\d+)#$/.exec(id.trim());
    const value = match ? Number(match[1]) : 0;
    return Number.isSafeInteger(value) && value > max ? value : max;
  }, 0);
  return `#${highest + 1}#`;
}


/* ─── NFT data field types ────────────────────────────────────────────────── */

/**
 * SBOR kinds, as the Gateway reports them in `programmatic_json`, that a plain
 * text input can express, with how each is written in a manifest.
 *
 * A schema is not all strings: a field declared `U64` refuses `"5"` and wants
 * `5u64`, a `Decimal` wants `Decimal("1.5")`. Emitting everything quoted worked
 * only for the all-string schemas this app creates and failed on anyone else's.
 */
const INTEGER_KINDS = [
  'I8', 'I16', 'I32', 'I64', 'I128',
  'U8', 'U16', 'U32', 'U64', 'U128',
] as const;

/** A sample value per kind, shown when no existing NFT can supply a real one. */
const KIND_EXAMPLES: Record<string, string> = {
  String: 'texto',
  Bool: 'true',
  Decimal: '1.5',
  PreciseDecimal: '1.5',
  NonFungibleLocalId: '#1#',
  Reference: 'resource_…',
  Own: 'internal_…',
  I8: '-8', I16: '-16', I32: '-32', I64: '-64', I128: '-128',
  U8: '8', U16: '16', U32: '32', U64: '64', U128: '128',
};

/** True when the kind can be typed into a text box at all. */
export function isEditableNftFieldKind(kind: string | undefined): boolean {
  return !!kind && kind in KIND_EXAMPLES;
}

/** `U64 · 64` — the type and a sample, for an empty field's placeholder. */
export function nftFieldPlaceholder(kind: string | undefined): string {
  if (!kind) return '';
  const example = KIND_EXAMPLES[kind];
  return example ? `${kind} · ${example}` : kind;
}

/**
 * One NFT data value as manifest syntax for its kind. Returns null for kinds a
 * text field cannot express (enums, arrays, tuples), so the caller can leave
 * them alone rather than emit something the engine will reject.
 */
export function nftFieldLiteral(
  kind: string | undefined,
  value: string,
): string | null {
  const raw = value.trim();
  if (!kind || kind === 'String') return `"${escape(value)}"`;
  if ((INTEGER_KINDS as readonly string[]).includes(kind)) {
    return `${raw || '0'}${kind.toLowerCase()}`;
  }
  switch (kind) {
    case 'Bool':
      return raw === 'true' ? 'true' : 'false';
    case 'Decimal':
      return `Decimal("${escape(raw || '0')}")`;
    case 'PreciseDecimal':
      return `PreciseDecimal("${escape(raw || '0')}")`;
    case 'NonFungibleLocalId':
      return `NonFungibleLocalId("${escape(raw)}")`;
    case 'Reference':
    case 'Own':
      return `Address("${escape(raw)}")`;
    default:
      return null;
  }
}

export interface MintNftData {
  /** Full local id INCLUDING its delimiters. Ignored for RUID resources. */
  id: string;
  name: string;
  description: string;
  keyImageUrl: string;
  /**
   * Every field beyond the three standard ones, in the SAME order the schema
   * declared them. A mint must carry the resource's complete field set, so
   * these are not optional: a Radix Seal collection adds nine, and sending
   * only the three standard ones is refused outright.
   */
  customValues?: Array<{ value: string; kind?: string }>;
}

/** The (name, description, key_image_url [, custom…]) data tuple of one NFT. */
const nftDataTuple = (nft: MintNftData) => {
  const extra = (nft.customValues ?? [])
    .map((field) => `,\n                ${nftFieldLiteral(field.kind, field.value) ?? '""'}`)
    .join('');
  return `Tuple(
            Tuple(
                "${escape(nft.name)}",
                "${escape(nft.description)}",
                "${escape(nft.keyImageUrl)}"${extra}
            )
        )`;
};

/**
 * Mints an NFT into an existing resource. Emits the standard
 * (name, description, key_image_url) tuple plus any `customValues` appended in
 * schema order, so it works for both plain and custom-schema resources.
 *
 * `nft.id` must already carry the delimiters of the resource's own id type
 * (see formatNonFungibleLocalId); minting `#1#` into, say, a RUID collection is
 * what the engine rejects as InvalidNonFungibleIdType.
 */
export const mintNonFungibleManifest = (resource: string, nft: MintNftData) => `
MINT_NON_FUNGIBLE
    Address("${resource}")
    Map<NonFungibleLocalId, Tuple>(
        NonFungibleLocalId("${nft.id}") => ${nftDataTuple(nft)}
    )
;
`;

/**
 * Mints into a RUID collection — the Radix Seal brand is one. Such resources
 * take NO id: the ledger derives it from the transaction hash, and any attempt
 * to name one is refused outright, so they need their own instruction.
 */
export const mintRuidNonFungibleManifest = (resource: string, nft: MintNftData) => `
MINT_RUID_NON_FUNGIBLE
    Address("${resource}")
    Array<Tuple>(
        ${nftDataTuple(nft)}
    )
;
`;

/** Picks the right mint instruction for the resource's declared id type. */
export const mintNonFungibleForIdType = (
  resource: string,
  kind: NonFungibleIdKind,
  nft: MintNftData,
) =>
  kind === 'Ruid'
    ? mintRuidNonFungibleManifest(resource, nft)
    : mintNonFungibleManifest(resource, nft);

/**
 * Rewrites ONE data field of ONE existing NFT.
 *
 * Different thing from editing the resource's metadata: that describes the
 * collection, this reaches inside a single token. Only fields the schema left
 * mutable can be written (a Radix Seal collection leaves `key_image_url` open
 * and seals every evidence field shut), and the caller must satisfy the
 * resource's `non_fungible_data_updater` role.
 *
 * The value is emitted as a plain string, which is what the base fields
 * (name, description, key_image_url) are declared as.
 */
export const updateNonFungibleDataManifest = (
  resource: string,
  localId: string,
  field: string,
  value: string,
  kind?: string,
) => `
UPDATE_NON_FUNGIBLE_DATA
    Address("${resource}")
    NonFungibleLocalId("${escape(localId)}")
    "${escape(field)}"
    ${nftFieldLiteral(kind, value) ?? `"${escape(value)}"`}
;
`;

export const burnManifest = (account: string, resource: string, amount: string) => `
CALL_METHOD
    Address("${account}")
    "withdraw"
    Address("${resource}")
    Decimal("${amount}")
;
TAKE_ALL_FROM_WORKTOP
    Address("${resource}")
    Bucket("bucket1")
;
BURN_RESOURCE
    Bucket("bucket1")
;
`;

export const burnNonFungibleManifest = (account: string, resource: string, nftIds: string[]) => {
  const idsArray = nftIds
    .map((id) => `        NonFungibleLocalId("${escape(id)}")`)
    .join(',\n');
  return `
CALL_METHOD
    Address("${account}")
    "withdraw_non_fungibles"
    Address("${resource}")
    Array<NonFungibleLocalId>(
${idsArray}
    )
;
TAKE_ALL_FROM_WORKTOP
    Address("${resource}")
    Bucket("bucket1")
;
BURN_RESOURCE
    Bucket("bucket1")
;
`;
};

export const lockMetadataManifest = (entity: string, key: string) => `
LOCK_METADATA
    Address("${entity}")
    "${escape(key)}"
;
`;

/* ─── Owner role ──────────────────────────────────────────────────────────── */

export type SimpleAccessRule =
  | { kind: 'allowAll' }
  | { kind: 'denyAll' }
  | { kind: 'badge'; resourceAddress: string };

export const accessRuleSyntax = (rule: SimpleAccessRule): string => {
  switch (rule.kind) {
    case 'allowAll':
      return 'Enum<AccessRule::AllowAll>()';
    case 'denyAll':
      return 'Enum<AccessRule::DenyAll>()';
    case 'badge':
      return `Enum<AccessRule::Protected>(
        Enum<AccessRuleNode::ProofRule>(
            Enum<ProofRule::Require>(
                Enum<ResourceOrNonFungible::Resource>(
                    Address("${rule.resourceAddress}")
                )
            )
        )
    )`;
  }
};

export const setOwnerRoleManifest = (entity: string, rule: SimpleAccessRule) => `
SET_OWNER_ROLE
    Address("${entity}")
    ${accessRuleSyntax(rule)}
;
`;

/* ─── Vault-level actions (recall / freeze) ───────────────────────────────── */

export const recallManifest = (vaultAddress: string, amount: string, nonFungibleIds?: string[]) => {
  if (nonFungibleIds && nonFungibleIds.length > 0) {
    const idsString = nonFungibleIds.map(id => `NonFungibleLocalId("${id}")`).join(', ');
    return `
RECALL_NON_FUNGIBLES_FROM_VAULT
    Address("${vaultAddress}")
    Array<NonFungibleLocalId>(${idsString})
;
`;
  }
  return `
RECALL_FROM_VAULT
    Address("${vaultAddress}")
    Decimal("${amount}")
;
`;
};

export type FreezeFlag = 'withdraw' | 'deposit' | 'burn' | 'all';

const FREEZE_FLAG_BITS: Record<FreezeFlag, number> = {
  withdraw: 1,
  deposit: 2,
  burn: 4,
  all: 7,
};

export const freezeVaultManifest = (vaultAddress: string, flag: FreezeFlag, freeze: boolean) => `
${freeze ? 'FREEZE_VAULT' : 'UNFREEZE_VAULT'}
    Address("${vaultAddress}")
    Tuple(${FREEZE_FLAG_BITS[flag]}u32)
;
`;
