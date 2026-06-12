/**
 * PUBLISH_PACKAGE_ADVANCED manifest builder.
 * Ported from the official Radix Console (dapps-monorepo).
 */

import blake from 'blakejs';
import {
  type AccessRule,
  type OwnerRoleUpdatable,
  accessRuleToManifestSyntax,
} from './access-rules';

const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

/** Blake2b-256 hash of a hex-encoded payload (the wasm blob reference). */
export const blake2bHashHex = (hex: string): string =>
  blake.blake2bHex(hexToBytes(hex), undefined, 32);

export const getDeployPackageManifest = (
  wasmHex: string,
  packageDefinition: string,
  accessRule: AccessRule,
  ownerRoleUpdatable: OwnerRoleUpdatable,
): string => `
PUBLISH_PACKAGE_ADVANCED
    ${accessRuleToManifestSyntax(accessRule, ownerRoleUpdatable)}
    ${packageDefinition}
    Blob("${blake2bHashHex(wasmHex)}")
    Map<String, Tuple>()
    None
;
`;
