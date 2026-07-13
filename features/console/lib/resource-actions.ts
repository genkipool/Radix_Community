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

export interface MintNftData {
  id: string;
  name: string;
  description: string;
  keyImageUrl: string;
  /**
   * Extra string field values, in the SAME order the resource's NF-data schema
   * declared its custom fields at creation. Required when minting into a
   * resource that has custom fields (e.g. a Radix Seal attestation collection).
   */
  customValues?: string[];
}

/**
 * Mints an NFT into an existing resource. Emits the standard
 * (name, description, key_image_url) tuple plus any `customValues` appended in
 * schema order, so it works for both plain and custom-schema resources.
 */
export const mintNonFungibleManifest = (resource: string, nft: MintNftData) => {
  const extra = (nft.customValues ?? [])
    .map((value) => `,\n                "${escape(value)}"`)
    .join('');
  return `
MINT_NON_FUNGIBLE
    Address("${resource}")
    Map<NonFungibleLocalId, Tuple>(
        NonFungibleLocalId("${nft.id}") => Tuple(
            Tuple(
                "${escape(nft.name)}",
                "${escape(nft.description)}",
                "${escape(nft.keyImageUrl)}"${extra}
            )
        )
    )
;
`;
};

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
