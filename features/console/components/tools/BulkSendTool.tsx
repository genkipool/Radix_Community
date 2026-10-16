'use client';

import { useState } from 'react';

import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { truncateAddress } from '@/utils/formatters';
import { useAccountResources } from '../../hooks/useAccountResources';
import { useLockedResources } from '../../hooks/useLockedResources';
import { useResourceLabels } from '../../hooks/useResourceLabels';
import {
  DEFAULT_BATCH_SIZE,
  batchRows,
  bulkSendManifest,
  fungibleTotals,
  parseBulkCsv,
  validateBulkRows,
  type BulkIssue,
} from '../../lib/bulk-send';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { bulkIssueText } from '../distribution/bulkIssueText';
import { RecipientListInput } from '../distribution/RecipientListInput';
import { AccountPicker } from '../shared/AccountPicker';
import { BatchRunner } from '../shared/BatchRunner';
import { ToolSection } from '../shared/ToolSection';

/**
 * Pays many accounts from a CSV, in as few transactions as the engine allows.
 * Recipients who refuse the deposit are refunded instead of aborting the batch
 * (try_deposit_or_refund), and the refunds land back in the sender's account.
 */
export default function BulkSendTool({ t }: ConsoleToolProps) {
  const labels = t.bulkSend;
  const { activeNetwork } = useRadixWallet();
  const [account, setAccount] = useState<string | null>(null);
  const [csv, setCsv] = useState('');
  const [defaultResource, setDefaultResource] = useState('');
  const { data: holdings } = useAccountResources(account);

  const parsed = parseBulkCsv(csv, defaultResource.trim());
  const senderHoldings = holdings
    ? {
        fungibles: Object.fromEntries(holdings.fungibles.map((f) => [f.resourceAddress, f.amount])),
        nonFungibles: Object.fromEntries(holdings.nonFungibles.map((n) => [n.resourceAddress, n.ids])),
      }
    : undefined;
  // Resources that can never leave the account (soulbound) are flagged before the simulation fails on them.
  const locked = useLockedResources(parsed.rows.map((r) => r.resource), activeNetwork);
  const issues: BulkIssue[] = [...parsed.issues, ...validateBulkRows(parsed.rows, activeNetwork, senderHoldings, locked)];
  const totals = fungibleTotals(parsed.rows);
  const nftCount = parsed.rows.filter((r) => r.nftId).length;
  const names = useResourceLabels([...Object.keys(totals), ...issues.flatMap((i) => (i.resource ? [i.resource] : []))]);

  const ready = !!account && parsed.rows.length > 0 && issues.length === 0;
  const batches = ready
    ? batchRows(parsed.rows, DEFAULT_BATCH_SIZE).map((rows) => ({ manifest: bulkSendManifest(account!, rows), count: rows.length }))
    : [];

  const issueText = (issue: BulkIssue) => bulkIssueText(issue, labels.issues, names);

  return (
    <div className="space-y-5">
      <ToolSection title={t.common.fromAccount}>
        <AccountPicker value={account} onChange={setAccount} />
      </ToolSection>

      <RecipientListInput
        t={t}
        title={labels.listTitle}
        hint={labels.listHint}
        csv={csv}
        onCsvChange={setCsv}
        defaultResource={defaultResource}
        onDefaultResourceChange={setDefaultResource}
      />

      {parsed.rows.length > 0 && (
        <ToolSection title={labels.reviewTitle}>
          <ul className="space-y-1 text-sm" style={{ color: 'var(--color-text-main)' }}>
            <li>{labels.recipients.replace('{count}', String(parsed.rows.length))}</li>
            {Object.entries(totals).map(([resource, total]) => (
              <li key={resource} title={resource}>
                {labels.total.replace('{amount}', total).replace('{resource}', names[resource] ?? truncateAddress(resource, 10, 6))}
              </li>
            ))}
            {nftCount > 0 && <li>{labels.nfts.replace('{count}', String(nftCount))}</li>}
            <li>
              {(Math.ceil(parsed.rows.length / DEFAULT_BATCH_SIZE) === 1 ? labels.batchesInfoOne : labels.batchesInfo)
                .replace('{batches}', String(Math.ceil(parsed.rows.length / DEFAULT_BATCH_SIZE)))
                .replace('{size}', String(DEFAULT_BATCH_SIZE))}
            </li>
          </ul>
          {issues.length > 0 && (
            <ul className="space-y-1">
              {issues.slice(0, 20).map((issue, i) => (
                <li key={i} className="text-xs" style={{ color: 'var(--color-danger)' }}>
                  {issueText(issue)}
                </li>
              ))}
              {issues.length > 20 && (
                <li className="text-xs" style={{ color: 'var(--color-danger)' }}>
                  {labels.moreIssues.replace('{count}', String(issues.length - 20))}
                </li>
              )}
            </ul>
          )}
          {!account && (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {labels.pickAccount}
            </p>
          )}
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {labels.refundNote}
          </p>
        </ToolSection>
      )}

      <BatchRunner
        t={t}
        batches={batches}
        resetKey={`${account}:${csv}:${defaultResource}`}
        sendLabel={labels.sendButton}
        blockedReason={
          !account ? t.batches.pickAccount : parsed.rows.length === 0 ? t.batches.noRecipients : issues.length > 0 ? t.batches.fixIssues : undefined
        }
      />
    </div>
  );
}
