/**
 * Metadata manifest helpers — both initial-supply metadata tuples (used by
 * CREATE_*_RESOURCE) and SET_METADATA / REMOVE_METADATA instructions (used by
 * the configure-metadata tool).
 * Ported from the official Radix Console (dapps-monorepo).
 */

export const MetadataType = {
  String: 'Metadata::String',
  StringArray: 'Metadata::StringArray',
  Address: 'Metadata::Address',
  AddressArray: 'Metadata::AddressArray',
  Url: 'Metadata::Url',
  OriginArray: 'Metadata::OriginArray',
} as const;

export type MetadataTypeValue = (typeof MetadataType)[keyof typeof MetadataType];

const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/* ─── Initial metadata entries (`"key" => Tuple(Some(...), locked)`) ──────── */

export const initialMetadataEntry = (
  key: string,
  value: string,
  locked: boolean,
  type: MetadataTypeValue = MetadataType.String,
) => `"${key}" => Tuple(
      Some(Enum<${type}>("${escape(value)}")),
      ${locked}
  )`;

export const initialMetadataArrayEntry = (
  key: string,
  values: string[],
  locked: boolean,
) => `"${key}" => Tuple(
      Some(Enum<${MetadataType.StringArray}>(Array<String>(${values
        .map((v) => `"${escape(v)}"`)
        .join(', ')}))),
      ${locked}
  )`;

/* ─── SET_METADATA / REMOVE_METADATA instructions ─────────────────────────── */

export const setStringMetadata = (address: string, key: string, value: string) => `
SET_METADATA
    Address("${address}")
    "${key}"
    Enum<Metadata::String>("${escape(value)}")
;
`;

export const setUrlMetadata = (address: string, key: string, value: string) => `
SET_METADATA
    Address("${address}")
    "${key}"
    Enum<Metadata::Url>("${escape(value)}")
;
`;

export const setAddressMetadata = (address: string, key: string, value: string) => `
SET_METADATA
    Address("${address}")
    "${key}"
    Enum<Metadata::Address>(Address("${value}"))
;
`;

export const setStringArrayMetadata = (address: string, key: string, values: string[]) => `
SET_METADATA
    Address("${address}")
    "${key}"
    Enum<Metadata::StringArray>(
      Array<String>(${values.map((v) => `"${escape(v)}"`).join(', ')})
    )
;
`;

export const setAddressArrayMetadata = (address: string, key: string, values: string[]) => `
SET_METADATA
    Address("${address}")
    "${key}"
    Enum<Metadata::AddressArray>(
      Array<Address>(${values.map((v) => `Address("${v}")`).join(', ')})
    )
;
`;

export const setOriginArrayMetadata = (address: string, key: string, values: string[]) => `
SET_METADATA
    Address("${address}")
    "${key}"
    Enum<Metadata::OriginArray>(
      Array<String>(${values.map((v) => `"${escape(v)}"`).join(', ')})
    )
;
`;

export const removeMetadata = (address: string, key: string) => `
REMOVE_METADATA
    Address("${address}")
    "${key}"
;
`;

/* ─── Gateway typed-metadata → display string ─────────────────────────────── */

export interface GatewayTypedMetadataValue {
  type: string;
  value?: unknown;
  values?: unknown[];
}

export interface GatewayMetadataItem {
  key: string;
  is_locked?: boolean;
  value?: { typed?: GatewayTypedMetadataValue };
}

/** Flattens a Gateway typed metadata value into an editable string. */
export const typedMetadataToString = (typed: GatewayTypedMetadataValue | undefined): string => {
  if (!typed) return '';
  if (Array.isArray(typed.values)) return typed.values.map(String).join(', ');
  if (typed.value === undefined || typed.value === null) return '';
  return String(typed.value);
};

export const getMetadataItem = (
  items: GatewayMetadataItem[] | undefined,
  key: string,
): GatewayMetadataItem | undefined => items?.find((item) => item.key === key);

export const getMetadataString = (
  items: GatewayMetadataItem[] | undefined,
  key: string,
): string => typedMetadataToString(getMetadataItem(items, key)?.value?.typed);
