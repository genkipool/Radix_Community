/**
 * CREATE_FUNGIBLE / CREATE_NON_FUNGIBLE resource manifest builders.
 * Ported from the official Radix Console (dapps-monorepo).
 */

import {
  type AccessRule,
  type AuthRoleValue,
  type OwnerRoleUpdatable,
  accessRuleToManifestSyntax,
  authRolePairSyntax,
  metadataAuthRoleSyntax,
} from './access-rules';

/* ─── Auth role form state ────────────────────────────────────────────────── */

export interface ResourceAuthRoles {
  minter: AuthRoleValue;
  minter_updater: AuthRoleValue;
  burner: AuthRoleValue;
  burner_updater: AuthRoleValue;
  freezer: AuthRoleValue;
  freezer_updater: AuthRoleValue;
  recaller: AuthRoleValue;
  recaller_updater: AuthRoleValue;
  withdrawer: AuthRoleValue;
  withdrawer_updater: AuthRoleValue;
  depositer: AuthRoleValue;
  depositer_updater: AuthRoleValue;
  metadata_setter: AuthRoleValue;
  metadata_setter_updater: AuthRoleValue;
  metadata_locker: AuthRoleValue;
  metadata_locker_updater: AuthRoleValue;
  nft_data_setter: AuthRoleValue;
  nft_data_setter_updater: AuthRoleValue;
}

export const DEFAULT_AUTH_ROLES: ResourceAuthRoles = {
  minter: 'denyAll',
  minter_updater: 'denyAll',
  burner: 'denyAll',
  burner_updater: 'denyAll',
  freezer: 'denyAll',
  freezer_updater: 'denyAll',
  recaller: 'denyAll',
  recaller_updater: 'denyAll',
  withdrawer: 'allowAll',
  withdrawer_updater: 'denyAll',
  depositer: 'allowAll',
  depositer_updater: 'denyAll',
  metadata_setter: 'owner',
  metadata_setter_updater: 'owner',
  metadata_locker: 'owner',
  metadata_locker_updater: 'owner',
  nft_data_setter: 'owner',
  nft_data_setter_updater: 'denyAll',
};

const buildAuthRolesTuple = (roles: ResourceAuthRoles, includeNftDataSetter: boolean) => {
  const pairs: Array<[AuthRoleValue, AuthRoleValue]> = [
    [roles.minter, roles.minter_updater],
    [roles.burner, roles.burner_updater],
    [roles.freezer, roles.freezer_updater],
    [roles.recaller, roles.recaller_updater],
    [roles.withdrawer, roles.withdrawer_updater],
    [roles.depositer, roles.depositer_updater],
  ];
  if (includeNftDataSetter) {
    pairs.push([roles.nft_data_setter, roles.nft_data_setter_updater]);
  }
  return pairs.map(([setter, updater]) => authRolePairSyntax(setter, updater)).join(`,
        `);
};

const buildMetadataAuthRoles = (roles: ResourceAuthRoles) =>
  [
    metadataAuthRoleSyntax('metadata_setter', roles.metadata_setter),
    metadataAuthRoleSyntax('metadata_setter_updater', roles.metadata_setter_updater),
    metadataAuthRoleSyntax('metadata_locker', roles.metadata_locker),
    metadataAuthRoleSyntax('metadata_locker_updater', roles.metadata_locker_updater),
  ].join(`,
            `);

/* ─── Fungible ────────────────────────────────────────────────────────────── */

export interface CreateFungibleTokenInput {
  ownerAccessRule: AccessRule;
  ownerRoleUpdatable: OwnerRoleUpdatable;
  accountAddress: string;
  trackSupply: boolean;
  divisibility: string;
  initialSupply: string;
  /** Pre-built `"key" => Tuple(...)` entries, comma separated */
  metadata: string;
  authRoles: ResourceAuthRoles;
}

export const createFungibleTokenManifest = ({
  ownerAccessRule,
  ownerRoleUpdatable,
  accountAddress,
  trackSupply,
  divisibility,
  initialSupply,
  metadata,
  authRoles,
}: CreateFungibleTokenInput) => `CREATE_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY
    ${accessRuleToManifestSyntax(ownerAccessRule, ownerRoleUpdatable)}
    ${trackSupply}
    ${divisibility}u8
    Decimal("${initialSupply}")
    Tuple(
        ${buildAuthRolesTuple(authRoles, false)}
    )
    Tuple(
        Map<String, Tuple>(
          ${metadata}
        ),
        Map<String, Enum>(
          ${buildMetadataAuthRoles(authRoles)}
        )
    )
    None
;

CALL_METHOD
    Address("${accountAddress}")
    "try_deposit_batch_or_abort"
    Expression("ENTIRE_WORKTOP")
    Enum<0u8>()
;
`;

/* ─── Non-fungible ────────────────────────────────────────────────────────── */

export interface NftItemData {
  name: string;
  description: string;
  key_image_url: string;
}

const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/** `NonFungibleLocalId("#i#") => Tuple(...)` entries for the initial supply map. */
export const nftItemsToManifestSyntax = (items: NftItemData[]) =>
  items
    .map(
      ({ name, description, key_image_url }, index) => `NonFungibleLocalId("#${index}#") => Tuple(
        Tuple(
          "${escape(name)}",
          "${escape(description)}",
          "${escape(key_image_url)}"
        )
      )`,
    )
    .join(',');

export interface CreateNonFungibleTokenInput {
  ownerAccessRule: AccessRule;
  ownerRoleUpdatable: OwnerRoleUpdatable;
  accountAddress: string;
  trackSupply: boolean;
  /** Pre-built `"key" => Tuple(...)` entries, comma separated */
  metadata: string;
  authRoles: ResourceAuthRoles;
  nfts: NftItemData[];
}

export const createNonFungibleTokenManifest = ({
  ownerAccessRule,
  ownerRoleUpdatable,
  accountAddress,
  trackSupply,
  metadata,
  authRoles,
  nfts,
}: CreateNonFungibleTokenInput) => `CREATE_NON_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY
    ${accessRuleToManifestSyntax(ownerAccessRule, ownerRoleUpdatable)}
    Enum<1u8>()
    ${trackSupply}
    Enum<0u8>(
      Enum<0u8>(
          Tuple(
              Array<Enum>(
                  Enum<14u8>(
                      Array<Enum>(
                          Enum<0u8>(
                              12u8
                          ),
                          Enum<0u8>(
                              12u8
                          ),
                          Enum<0u8>(
                              198u8
                          )
                      )
                  )
              ),
              Array<Tuple>(
                  Tuple(
                      Enum<1u8>(
                          "DataSchema"
                      ),
                      Enum<1u8>(
                          Enum<0u8>(
                              Array<String>(
                                  "name",
                                  "description",
                                  "key_image_url"
                              )
                          )
                      )
                  )
              ),
              Array<Enum>(
                  Enum<0u8>()
              )
          )
      ),
      Enum<1u8>(
          0u64
      ),
      Array<String>()
    )
    Map<NonFungibleLocalId, Tuple>(
      ${nftItemsToManifestSyntax(nfts)}
    )
    Tuple(
      ${buildAuthRolesTuple(authRoles, true)}
    )
    Tuple(
      Map<String, Tuple>(
        ${metadata}
      ),
      Map<String, Enum>(
        ${buildMetadataAuthRoles(authRoles)}
      )
    )
    Enum<0u8>()
;

CALL_METHOD
    Address("${accountAddress}")
    "try_deposit_batch_or_abort"
    Expression("ENTIRE_WORKTOP")
    Enum<0u8>()
;
`;
