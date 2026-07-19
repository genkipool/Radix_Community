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
 * Resource symbol normaliser: uppercase alphanumerics, hard-capped at 5 chars.
 * Enforced HERE, in the shared manifest builder (the single source of truth for
 * what gets signed), so the 5-char limit holds even if a browser input's
 * maxLength is tampered with. These are self-custody transactions signed with
 * the user's own wallet, so this builder is the app's real enforcement point;
 * there is no server in the signing path to gate the manifest.
 */
export const MAX_SYMBOL_LENGTH = 5;
export const sanitizeSymbol = (symbol: string | undefined): string =>
  (symbol ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, MAX_SYMBOL_LENGTH);

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
 * Metadata role map where the OWNER may set (and lock) metadata, but the rules
 * themselves can never be changed. Combined with an owner role that requires an
 * admin badge, this makes the resource's brand metadata editable ONLY by the
 * admin-badge holder, forever.
 */
export const ownerEditableMetadataRoles = () =>
  [
    metadataAuthRoleSyntax('metadata_setter', 'owner'),
    metadataAuthRoleSyntax('metadata_setter_updater', 'denyAll'),
    metadataAuthRoleSyntax('metadata_locker', 'owner'),
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
