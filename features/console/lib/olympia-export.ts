/**
 * Builds the "Export for Babylon migration" QR payload used by the Radix
 * Olympia Desktop Wallet, which the Radix Wallet mobile apps (Android & iOS)
 * scan via Settings → Troubleshooting → "Import from a Legacy Wallet".
 *
 * Format (see olympia-wallet `helpers/exportAsCode.ts` and
 * babylon-wallet-android `OlympiaWalletDataParser.kt`):
 *
 *   {payloadTotal}^{payloadIndex}^{mnemonicWordCount}]{accounts}
 *
 * where `{accounts}` is `~`-joined entries of:
 *
 *   {S|H}^{base64(compressed secp256k1 public key)}^{bip44 address index}^{name}}
 *
 * The payload contains only public data — no seed phrase or private keys.
 */

const END_OF_HEADER = ']';
const INTRA_SEPARATOR = '^';
const INTER_SEPARATOR = '~';
const END_OF_ACCOUNT_NAME = '}';

const FORBIDDEN_CHARACTERS = [END_OF_HEADER, INTRA_SEPARATOR, INTER_SEPARATOR, END_OF_ACCOUNT_NAME];
const ACCOUNT_NAME_REPLACEMENT = '_';

/** Max characters of account data per QR chunk (mirrors the desktop wallet). */
const PAYLOAD_SIZE = 1800;

/** 'S' = software (seed phrase in the desktop wallet), 'H' = hardware (Ledger). */
export type OlympiaAccountType = 'S' | 'H';

export type MnemonicWordCount = 12 | 15 | 18 | 21 | 24;
export const MNEMONIC_WORD_COUNTS: MnemonicWordCount[] = [12, 15, 18, 21, 24];

export interface OlympiaExportAccount {
  accountType: OlympiaAccountType;
  /** Compressed secp256k1 public key, hex encoded (33 bytes / 66 chars). */
  publicKeyHex: string;
  /** BIP44 address index the account was derived with (0 for the first account). */
  addressIndex: number;
  /** Display name shown in the mobile wallet during import (max 30 chars). */
  name: string;
}

const emojiRegex = /\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu;
const unicodeRegex = /[^\u0000-\u007F]/gu;

/** Mirrors the desktop wallet's name sanitizer (ASCII, 30 chars, `}` terminator). */
export function sanitizeAccountName(name: string): string {
  const asciiOnly = name.replace(emojiRegex, ACCOUNT_NAME_REPLACEMENT).replace(unicodeRegex, ACCOUNT_NAME_REPLACEMENT);
  const limited = [...asciiOnly].slice(0, 30).join('');
  const replaced = FORBIDDEN_CHARACTERS.reduce(
    (acc, forbidden) => acc.replaceAll(forbidden, ACCOUNT_NAME_REPLACEMENT),
    limited,
  );
  return `${replaced}${END_OF_ACCOUNT_NAME}`;
}

function publicKeyHexToBase64(publicKeyHex: string): string {
  const clean = publicKeyHex.trim().toLowerCase();
  if (!/^[0-9a-f]{66}$/.test(clean)) {
    throw new Error('Expected a 33-byte compressed secp256k1 public key in hex');
  }
  const bytes = clean.match(/.{2}/g)!.map((pair) => parseInt(pair, 16));
  return btoa(String.fromCharCode(...bytes));
}

function accountToPayload(account: OlympiaExportAccount): string {
  return [
    account.accountType,
    publicKeyHexToBase64(account.publicKeyHex),
    account.addressIndex,
    sanitizeAccountName(account.name),
  ].join(INTRA_SEPARATOR);
}

/**
 * Builds the QR chunk strings for a legacy-wallet import. A single account
 * always fits in one QR code; the chunking logic is kept identical to the
 * desktop wallet for fidelity.
 */
export function buildOlympiaExportPayloads(
  accounts: OlympiaExportAccount[],
  mnemonicWordCount: MnemonicWordCount,
): string[] {
  const joined = accounts.map(accountToPayload).join(INTER_SEPARATOR);
  const chunks = joined.match(new RegExp(`.{1,${PAYLOAD_SIZE}}`, 'g')) ?? [];
  return chunks.map(
    (chunk, index) =>
      `${chunks.length}${INTRA_SEPARATOR}${index}${INTRA_SEPARATOR}${mnemonicWordCount}${END_OF_HEADER}${chunk}`,
  );
}
