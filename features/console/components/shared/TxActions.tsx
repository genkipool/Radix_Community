'use client';

import type { ReactNode } from 'react';

import type { ConsoleDictionary } from '../../types/i18n.types';
import { MessageLine } from './MessageLine';
import { SendToWalletButton } from './SendToWalletButton';
import { SimulateButton } from './SimulatePanel';

interface TxActionsProps {
  t: ConsoleDictionary;
  onSend: () => void;
  onSimulate: () => void;
  /** No transaction yet, or one that must not be sent: both buttons stay visible but off. */
  sendDisabled: boolean;
  simulateDisabled: boolean;
  sending?: boolean;
  simulating?: boolean;
  sendLabel: string;
  sendingLabel: string;
  /** Why the buttons are off, on a line of its own that keeps its height. */
  blockedReason?: string;
  /** `error` for a rule the form cannot prevent; `muted` for a step still to do. */
  reasonTone?: 'muted' | 'error';
  /** A third action, first in the row (e.g. "Create an empty locker"). */
  leading?: ReactNode;
}

/**
 * The send / simulate pair every console transaction ends with. It sits
 * under the form's box, not inside it, and is always shown: when something is
 * missing the buttons stay disabled and the line below says what.
 */
export function TxActions({
  t,
  onSend,
  onSimulate,
  sendDisabled,
  simulateDisabled,
  sending,
  simulating,
  sendLabel,
  sendingLabel,
  blockedReason,
  reasonTone = 'muted',
  leading,
}: TxActionsProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        {leading && <div className="flex-1 w-full">{leading}</div>}
        <div className="flex-1 w-full">
          <SendToWalletButton onClick={onSend} disabled={sendDisabled} loading={sending} label={sendLabel} loadingLabel={sendingLabel} />
        </div>
        <div className="flex-1 w-full">
          <SimulateButton t={t.simulate} onClick={onSimulate} disabled={simulateDisabled} loading={simulating} />
        </div>
      </div>
      <MessageLine tone={reasonTone}>{blockedReason}</MessageLine>
    </div>
  );
}
