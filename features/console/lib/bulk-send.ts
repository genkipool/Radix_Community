/**
 * Bulk transfers from a CSV: parsing, validation and batching into wallet
 * transactions.
 *
 * Every recipient is paid with `try_deposit_or_refund`: if their account
 * refuses the deposit (third-party deposits off, or the resource on their deny
 * list) the bucket comes back to the worktop instead of aborting the whole
 * batch, and the sender's final deposit takes it home. One bad recipient
 * never blocks the other ninety-nine. The refunds return with `deposit_batch`,
 * which the sender's own signature authorises whatever their deposit rules.
 *
 * Shared by the console's bulk sender, the holders tool, and the MCP server.
 */

import { isPositiveDecimal, normalizeDecimal, sumDecimals, lteDecimal } from './decimal';

export interface BulkRow {
  /** 1-based line in the input text (the header counts), for pasted lists. */
  line: number;
  /** 1-based recipient number: the row as a list of recipients numbers it (no header, comments or blanks). */
  row: number;
  account: string;
  resource: string;
  /** Fungible amount, or empty for a non-fungible row. */
  amount: string;
  /** Non-fungible local id (`#1#`, `<name>`, `{…}`, `[…]`) for NFT rows. */
  nftId?: string;
}

export type BulkIssueCode =
  | 'columns'
  | 'account'
  | 'network'
  | 'resource'
  | 'resourceNetwork'
  | 'noResource'
  | 'amount'
  | 'nftAmount'
  | 'fungibleId'
  | 'nftId'
  | 'duplicateNft'
  | 'nftNotHeld'
  | 'balance'
  | 'locked';

export interface BulkIssue {
  /** Line in the input text. */
  line: number;
  /** Recipient number, as the rows on screen number it. */
  row: number;
  code: BulkIssueCode;
  detail?: string;
  /** The resource the issue is about (a balance that falls short). */
  resource?: string;
}

const NFT_ID_RE = /^(#\d+#|<[A-Za-z0-9_]{1,64}>|\{[0-9a-fA-F-]{16,}\}|\[[0-9a-fA-F]{2,128}\])$/;

/**
 * A non-fungible resource, read from its address: bech32 encodes the entity
 * type in the first data character, `n` for non-fungible resources.
 */
export const isNonFungibleResource = (address: string) => /^resource_(rdx|tdx_2_)1n/.test(address.trim());

/** Network marker inside a bech32 address: `_rdx1` (mainnet) or `_tdx_2_1` (stokenet). */
export const networkMarker = (network: 'mainnet' | 'stokenet') => (network === 'mainnet' ? '_rdx1' : '_tdx_2_1');

/**
 * One separator per line: tab or semicolon when present (spreadsheets in
 * comma-decimal locales export those), comma otherwise. That leaves "2,5"
 * intact as a decimal on a semicolon or tab line.
 */
const splitLine = (line: string) => {
  const separator = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
  return line.split(separator).map((cell) => cell.trim().replace(/^"(.*)"$/, '$1').trim());
};

/**
 * Parses recipient lines. Accepted shapes, one per line:
 *   account,resource,amount     fungible
 *   account,resource,#id#       non-fungible (any local id form)
 *   account,amount              fungible of `defaultResource`
 * Separators: comma, semicolon or tab. A header line, blank lines and lines
 * starting with # are ignored.
 */
export function parseBulkCsv(text: string, defaultResource = ''): { rows: BulkRow[]; issues: BulkIssue[] } {
  const rows: BulkRow[] = [];
  const issues: BulkIssue[] = [];
  let row = 0;
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('//') || (trimmed.startsWith('#') && !trimmed.includes(','))) return;
    const cells = splitLine(trimmed);
    if (line === 1 && !cells[0].includes('_')) return; // header
    row += 1;
    let account = '';
    let resource = defaultResource;
    let value = '';
    if (cells.length >= 3) [account, resource, value] = cells;
    else if (cells.length === 2) [account, value] = cells;
    else {
      issues.push({ line, row, code: 'columns' });
      return;
    }
    const isNft = NFT_ID_RE.test(value);
    rows.push({
      line,
      row,
      account,
      resource,
      amount: isNft ? '' : normalizeDecimal(value),
      ...(isNft ? { nftId: value } : {}),
    });
  });
  return { rows, issues };
}

/** Balances the sender holds: fungible amount per resource, NFT ids per resource. */
export interface SenderHoldings {
  fungibles: Record<string, string>;
  nonFungibles: Record<string, string[]>;
}

/** Checks every row; an empty issue list means the batch can be built. */
export function validateBulkRows(
  rows: BulkRow[],
  network: 'mainnet' | 'stokenet',
  holdings?: SenderHoldings,
  /** Resources that can never leave an account (withdrawer DenyAll): reported once, on their first row. */
  locked: ReadonlySet<string> = new Set(),
): BulkIssue[] {
  const marker = networkMarker(network);
  const issues: BulkIssue[] = [];
  const seenNft = new Set<string>();
  const reportedLocked = new Set<string>();

  for (const row of rows) {
    const at = { line: row.line, row: row.row };
    if (!/^account_[a-z0-9_]+$/.test(row.account)) issues.push({ ...at, code: 'account' });
    else if (!row.account.includes(marker)) issues.push({ ...at, code: 'network' });
    // A two-column line with no default resource: say what is missing, and
    // check nothing that depends on the resource.
    if (!row.resource) {
      issues.push({ ...at, code: 'noResource' });
      continue;
    }
    if (!/^resource_[a-z0-9_]+$/.test(row.resource)) {
      issues.push({ ...at, code: 'resource' });
      continue;
    }
    if (!row.resource.includes(marker)) {
      issues.push({ ...at, code: 'resourceNetwork' });
      continue;
    }
    const of = { ...at, resource: row.resource };
    if (locked.has(row.resource) && !reportedLocked.has(row.resource)) {
      reportedLocked.add(row.resource);
      issues.push({ ...of, code: 'locked' });
    }
    // The value has to match what the resource is: an id for an NFT, an amount for a token.
    const nonFungible = isNonFungibleResource(row.resource);
    if (row.nftId) {
      if (!nonFungible) {
        issues.push({ ...of, code: 'fungibleId', detail: row.nftId });
        continue;
      }
      const key = `${row.resource}:${row.nftId}`;
      if (seenNft.has(key)) issues.push({ ...of, code: 'duplicateNft', detail: row.nftId });
      seenNft.add(key);
      if (holdings && !holdings.nonFungibles[row.resource]?.includes(row.nftId)) {
        issues.push({ ...of, code: 'nftNotHeld', detail: row.nftId });
      }
    } else if (nonFungible) {
      issues.push({ ...of, code: 'nftAmount', detail: row.amount });
    } else if (!isPositiveDecimal(row.amount)) {
      issues.push({ ...of, code: 'amount' });
    }
  }

  if (holdings) {
    for (const [resource, total] of Object.entries(fungibleTotals(rows))) {
      if (!lteDecimal(total, holdings.fungibles[resource] ?? '0')) {
        const first = rows.find((r) => r.resource === resource && !r.nftId);
        issues.push({ line: first?.line ?? 0, row: first?.row ?? 0, code: 'balance', detail: total, resource });
      }
    }
  }
  return issues;
}

/** Total of each fungible resource across the rows. */
export function fungibleTotals(rows: BulkRow[]): Record<string, string> {
  const byResource: Record<string, string[]> = {};
  for (const row of rows) {
    // Rows without a resource, and NFT rows however their value is written, are reported apart.
    if (row.nftId || !row.resource || isNonFungibleResource(row.resource) || !isPositiveDecimal(row.amount)) continue;
    (byResource[row.resource] ??= []).push(row.amount);
  }
  return Object.fromEntries(Object.entries(byResource).map(([r, amounts]) => [r, sumDecimals(amounts)]));
}

/**
 * Recipients per transaction. The binding limit is not cost but the engine's
 * cap of 256 events per transaction: a deposit into an account that does not
 * exist on-ledger yet (a virtual account, as most airdrop recipients are)
 * instantiates it and emits several events. Measured on resim: 54 such
 * recipients commit and 56 fail with TooManyEvents (about 90 when the accounts
 * already exist). 40 leaves room for the wallet's fee lock and NFT deposits.
 */
export const DEFAULT_BATCH_SIZE = 40;

/** Splits rows into batches of at most `size` rows. */
export function batchRows<T>(rows: T[], size = DEFAULT_BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

/**
 * One transaction paying every row: one withdrawal per resource, one bucket
 * per recipient, `try_deposit_or_refund` for each, and whatever was refused
 * goes back to the sender at the end.
 */
export function bulkSendManifest(sender: string, rows: BulkRow[]): string {
  const totals = fungibleTotals(rows);
  const nftsByResource: Record<string, string[]> = {};
  for (const row of rows) if (row.nftId) (nftsByResource[row.resource] ??= []).push(row.nftId);

  const withdrawals = [
    ...Object.entries(totals).map(
      ([resource, total]) => `CALL_METHOD
    Address("${sender}")
    "withdraw"
    Address("${resource}")
    Decimal("${total}")
;`,
    ),
    ...Object.entries(nftsByResource).map(
      ([resource, ids]) => `CALL_METHOD
    Address("${sender}")
    "withdraw_non_fungibles"
    Address("${resource}")
    Array<NonFungibleLocalId>(${ids.map((id) => `NonFungibleLocalId("${id}")`).join(', ')})
;`,
    ),
  ];

  const deposits = rows.map((row, i) => {
    const bucket = `recipient_${i + 1}`;
    const take = row.nftId
      ? `TAKE_NON_FUNGIBLES_FROM_WORKTOP
    Address("${row.resource}")
    Array<NonFungibleLocalId>(NonFungibleLocalId("${row.nftId}"))
    Bucket("${bucket}")
;`
      : `TAKE_FROM_WORKTOP
    Address("${row.resource}")
    Decimal("${row.amount}")
    Bucket("${bucket}")
;`;
    return `${take}
CALL_METHOD
    Address("${row.account}")
    "try_deposit_or_refund"
    Bucket("${bucket}")
    None
;`;
  });

  return `${withdrawals.join('\n')}
${deposits.join('\n')}
CALL_METHOD
    Address("${sender}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
`;
}

/** Every transaction needed to pay all rows, in order. */
export function bulkSendManifests(sender: string, rows: BulkRow[], size = DEFAULT_BATCH_SIZE): string[] {
  return batchRows(rows, size).map((batch) => bulkSendManifest(sender, batch));
}
