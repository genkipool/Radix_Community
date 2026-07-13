/**
 * Shared raw-manifest building blocks for the sign feature's non-fungible
 * resources (Seal v2 brand, per-user signing collections).
 */
import {
  authRolePairSyntax,
  metadataAuthRoleSyntax,
} from '@/features/console/lib/access-rules';
import {
  initialMetadataArrayEntry,
  initialMetadataEntry,
  MetadataType,
} from '@/features/console/lib/metadata-manifests';
import type { IssuerMeta } from '../types/sign.types';

export const escapeManifestString = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/**
 * Non-fungible data schema: (name, description, key_image_url, ...custom),
 * all fields String and ALL locked (empty mutable-field list).
 */
export const nfSchema = (customKeys: string[]) => {
  const fieldCount = 3 + customKeys.length;
  const kinds = Array.from(
    { length: fieldCount },
    () => `Enum<0u8>(12u8)`,
  ).join(',\n                          ');
  const names = ['name', 'description', 'key_image_url', ...customKeys]
    .map((k) => `"${escapeManifestString(k)}"`)
    .join(',\n                                  ');
  return `Enum<0u8>(
      Enum<0u8>(
          Tuple(
              Array<Enum>(
                  Enum<14u8>(
                      Array<Enum>(
                          ${kinds}
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
                                  ${names}
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
      Enum<1u8>(0u64),
      Array<String>()
    )`;
};

/**
 * Role tuple (order: minter, burner, freezer, recaller, withdrawer,
 * depositer, nft_data_setter) for an immutable resource. Every pair defaults
 * to DenyAll/DenyAll except deposits; `minter` accepts 'allowAll' for the
 * open-mint Seal brand.
 */
export const sealBrandRoles = () => {
  const deny = authRolePairSyntax('denyAll', 'denyAll');
  return [
    authRolePairSyntax('allowAll', 'denyAll'), // minter: anyone, forever
    deny, // burner
    deny, // freezer
    deny, // recaller
    deny, // withdrawer → soulbound
    authRolePairSyntax('allowAll', 'denyAll'), // depositer
    deny, // nft_data_setter
  ].join(`,
        `);
};

/** Fully locked metadata role map (nobody can ever edit metadata). */
export const lockedMetadataRoles = () =>
  [
    metadataAuthRoleSyntax('metadata_setter', 'denyAll'),
    metadataAuthRoleSyntax('metadata_setter_updater', 'denyAll'),
    metadataAuthRoleSyntax('metadata_locker', 'denyAll'),
    metadataAuthRoleSyntax('metadata_locker_updater', 'denyAll'),
  ].join(`,
            `);

/**
 * Optional issuer-identity metadata entries: the issuer account and org name
 * are locked (anti-spoofing); the website stays updatable by the owner so a
 * company can move domains. The logo is NOT emitted here — callers publish
 * it as the collection's own (updatable) `icon_url`.
 */
export const issuerMetadataEntries = (
  issuer: IssuerMeta | undefined,
  issuerAccount: string,
): string[] => {
  const entries = [
    `"issuer" => Tuple(
      Some(Enum<${MetadataType.Address}>(Address("${issuerAccount}"))),
      true
  )`,
  ];
  if (issuer?.orgName) {
    entries.push(initialMetadataEntry('org_name', issuer.orgName, true));
  }
  if (issuer?.orgWebsite) {
    entries.push(
      initialMetadataEntry('org_url', issuer.orgWebsite, false, MetadataType.Url),
    );
  }
  return entries;
};

export { initialMetadataEntry, initialMetadataArrayEntry, MetadataType };
