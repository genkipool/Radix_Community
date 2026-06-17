/**
 * Owner-role / access-rule manifest syntax builders.
 * Ported from the official Radix Console (dapps-monorepo).
 */

export type AccessRule =
  | { type: 'none' }
  | { type: 'allowAll' }
  | { type: 'fungible'; address: string }
  | { type: 'nonFungible'; address: string };

export type OwnerRoleUpdatable = 'None' | 'Fixed' | 'Updatable';

const OWNER_ROLE_UPDATABLE_DISCRIMINATOR: Record<OwnerRoleUpdatable, number> = {
  None: 0,
  Fixed: 1,
  Updatable: 2,
};

export const accessRuleToManifestSyntax = (
  rule: AccessRule,
  updatable: OwnerRoleUpdatable,
): string => {
  const discriminator = OWNER_ROLE_UPDATABLE_DISCRIMINATOR[updatable];
  switch (rule.type) {
    case 'none':
      return 'None';
    case 'allowAll':
      return `Enum<${discriminator}u8>(
        Enum<0u8>()
      )`;
    case 'fungible':
      return `Enum<${discriminator}u8>(
        Enum<2u8>(
            Enum<0u8>(
                Enum<0u8>(
                    Enum<1u8>(
                        Address("${rule.address}")
                    )
                )
            )
        )
      )`;
    case 'nonFungible':
      return `Enum<${discriminator}u8>(
        Enum<2u8>(
            Enum<0u8>(
                Enum<0u8>(
                    Enum<0u8>(
                        NonFungibleGlobalId("${rule.address}")
                    )
                )
            )
        )
      )`;
  }
};

/* ─── Resource auth roles (minter, burner, …) ─────────────────────────────── */

export type AuthRoleValue = 'owner' | 'allowAll' | 'denyAll';

const authRoleValueToSyntax = (value: AuthRoleValue): string => {
  switch (value) {
    case 'owner':
      return 'None';
    case 'allowAll':
      return 'Some(Enum<AccessRule::AllowAll>())';
    case 'denyAll':
      return 'Some(Enum<AccessRule::DenyAll>())';
  }
};

/** `Some(Tuple(rule, updaterRule))` pair used inside resource role tuples. */
export const authRolePairSyntax = (
  setter: AuthRoleValue,
  updater: AuthRoleValue,
): string => `Some(
          Tuple(
            ${authRoleValueToSyntax(setter)},
            ${authRoleValueToSyntax(updater)}
          )
        )`;

/** `"key" => rule` entries for the metadata roles map. */
export const metadataAuthRoleSyntax = (
  key: string,
  value: AuthRoleValue,
): string => `"${key}" => ${authRoleValueToSyntax(value)}`;
