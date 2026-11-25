/**
 * On-ledger collection role & metadata integrity inspection against the
 * Radix Seal v1 standard.
 */
import { entityRoles } from '@/features/console/lib/role-lookup';
import {
  RADIX_SEAL_STANDARD_KEY,
  SIGN_COLLECTION_MARKER_KEY,
  SIGN_COLLECTION_MARKER_VALUE,
} from '../../constants/seal';
import { metadataString, type EntityDetailsItem } from '../gateway-seal';
import {
  RESERVED_COLLECTION_METADATA_KEYS,
  SIGN_NFT_FIELDS,
} from '../sign-request';

export interface CollectionCustomMeta {
  key: string;
  value: string;
  locked: boolean;
}

export interface CollectionIntegrity {
  hasMarker: boolean;
  officialBrand: boolean;
  ownerLocked: boolean;
  burnDenied: boolean;
  dataImmutable: boolean;
  issuerVerified: boolean;
  totalBurned: number;
  customMetadata: CollectionCustomMeta[];
}

/**
 * Inspects a signing collection's locked roles and metadata against the Radix
 * Seal standard (`radix_sign_collection = v1`, official brand, fixed
 * non-fungible owner rule, burn denied, immutable NFT data).
 */
export function inspectCollectionIntegrity(
  item: EntityDetailsItem | undefined,
  officialSeal: string,
  issuerAccount: string | null,
): CollectionIntegrity {
  const hasMarker =
    metadataString(item, SIGN_COLLECTION_MARKER_KEY) ===
    SIGN_COLLECTION_MARKER_VALUE;
  const officialBrand =
    !officialSeal ||
    metadataString(item, RADIX_SEAL_STANDARD_KEY) === officialSeal;

  const roles = entityRoles(item);
  const ownerRole = roles.find((r) => r.module === 'Owner' && r.name === 'owner');
  const burnerRole = roles.find((r) => r.name === 'burner');
  const dataUpdaterRole = roles.find(
    (r) => r.name === 'non_fungible_data_updater',
  );

  const ownerLocked =
    !!ownerRole && ownerRole.rule.type === 'nonFungible' && ownerRole.fixed;
  const burnDenied =
    !!burnerRole && burnerRole.rule.type === 'denyAll' && burnerRole.fixed;
  const mutableFields = item?.details?.non_fungible_data_mutable_fields;
  const evidentiaryKeys = new Set<string>(SIGN_NFT_FIELDS.map((f) => f.key));
  const evidentiaryFieldsLocked =
    Array.isArray(mutableFields) &&
    !mutableFields.some((f) => evidentiaryKeys.has(f));
  const dataImmutable =
    (!!dataUpdaterRole &&
      dataUpdaterRole.rule.type === 'denyAll' &&
      dataUpdaterRole.fixed) ||
    evidentiaryFieldsLocked;

  const totalBurned =
    Number.parseInt(item?.details?.total_burned ?? '0', 10) || 0;

  const customMetadata: CollectionCustomMeta[] = [];
  for (const meta of item?.metadata?.items ?? []) {
    const key = meta.key ?? '';
    if (!key || RESERVED_COLLECTION_METADATA_KEYS.has(key.toLowerCase())) {
      continue;
    }
    const typed = meta.value?.typed;
    const value =
      typeof typed?.value === 'string'
        ? typed.value
        : Array.isArray(typed?.values)
          ? typed.values.join(', ')
          : '';
    customMetadata.push({
      key,
      value,
      locked: meta.is_locked === true,
    });
  }

  return {
    hasMarker,
    officialBrand,
    ownerLocked,
    burnDenied,
    dataImmutable,
    issuerVerified: !!issuerAccount,
    totalBurned,
    customMetadata,
  };
}
