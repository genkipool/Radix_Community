'use client';

import { useState } from 'react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { securityInputState, useAccountSecurity } from '../../hooks/useAccountSecurity';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { ToolSection } from '../shared/ToolSection';
import { AddressField } from '../shared/fields';
import { AccountSecurityReportView } from '../shared/AccountSecurityReportView';

type Labels = ConsoleToolProps['t']['accountSecurity'];

/* ─── Tool ───────────────────────────────────────────────────────────────── */

export default function AccountSecurityTool({ t }: ConsoleToolProps) {
  const labels = t.accountSecurity;
  const { activeNetwork } = useRadixWallet();
  const [address, setAddress] = useState('');

  const inputState = securityInputState(address, activeNetwork);
  const { data: report, isFetching, error } = useAccountSecurity(address);

  const hint =
    inputState === 'malformed'
      ? labels.states.malformed
      : inputState === 'notAccount'
        ? labels.states.notAccount
        : inputState === 'wrongNetwork'
          ? labels.states.wrongNetwork.replace('{network}', activeNetwork)
          : undefined;

  return (
    <div className="space-y-5">
      <ToolSection title={labels.checkTitle} hint={labels.checkHint}>
        <AddressField
          value={address}
          onChange={setAddress}
          placeholder={labels.placeholder}
          categories={['account']}
          error={hint}
        />
        {isFetching && (
          <p className="text-xs flex items-center gap-2 text-[var(--color-text-muted)]">
            <span className="size-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
            {labels.checking}
          </p>
        )}
        {error && !isFetching && (
          <p className="text-xs font-semibold text-[var(--color-danger)]">{labels.error}</p>
        )}
      </ToolSection>

      {report && !isFetching && <AccountSecurityReportView report={report} labels={labels} />}

      <MultiSignerPanel labels={labels} />
    </div>
  );
}

/**
 * Why the console does not set up multi-signature accounts, and what the
 * wallet's own security shields can do instead. Shown always: the question
 * comes up before anyone has an address to check.
 */
function MultiSignerPanel({ labels }: { labels: Labels }) {
  const panel = labels.multiSigner;
  return (
    <ToolSection title={panel.title} hint={panel.hint}>
      <ul className="space-y-3">
        {panel.points.map((point) => (
          <li key={point.title} className="space-y-0.5">
            <p className="text-sm font-semibold text-[var(--color-text-main)]">{point.title}</p>
            <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">{point.detail}</p>
          </li>
        ))}
      </ul>
    </ToolSection>
  );
}
