import { truncateAddress } from '@/utils/formatters';
import type { BulkIssue } from '../../lib/bulk-send';
import type { ConsoleDictionary } from '../../types/i18n.types';

/**
 * A recipient-list problem in words, numbered by the row on screen (not the
 * line of the file, where the header counts), with the token's name rather
 * than its address. Shared by the bulk sender and the locker airdrop.
 */
export function bulkIssueText(issue: BulkIssue, labels: ConsoleDictionary['bulkSend']['issues'], names: Record<string, string>): string {
  const resource = issue.resource ? names[issue.resource] ?? truncateAddress(issue.resource, 10, 6) : '';
  return labels[issue.code]
    .replace('{row}', String(issue.row))
    .replace('{detail}', issue.detail ?? '')
    .replace('{resource}', resource);
}
