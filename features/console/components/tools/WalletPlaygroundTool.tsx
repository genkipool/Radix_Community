'use client';

import { useState } from 'react';
import { CheckCircle2, Send, ShieldQuestion, XCircle } from 'lucide-react';
import { OneTimeDataRequestBuilder, type WalletDataStateAccount } from '@radixdlt/radix-dapp-toolkit';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { getOrCreateToolkit } from '@/features/wallet/lib/radix-toolkit';
import { CopyButton } from '@/components/ui/CopyButton';
import { truncateAddress } from '@/utils/formatters';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { ToolSection } from '../shared/ToolSection';
import { OptionButtons } from '../shared/OptionButtons';

interface ProofItem {
  type: 'account' | 'persona';
  address: string;
  proof: { publicKey: string; signature: string; curve: 'curve25519' | 'secp256k1' };
}

interface PlaygroundResponse {
  accounts: WalletDataStateAccount[];
  personaLabel: string | null;
  proofs: ProofItem[];
  challenge: string | null;
  raw: string;
}

type RolaStatus = Record<string, boolean>;

export default function WalletPlaygroundTool({ t }: ConsoleToolProps) {
  const labels = t.walletPlayground;
  const { activeNetworkId } = useRadixWallet();

  const [accountCount, setAccountCount] = useState('1');
  const [quantifier, setQuantifier] = useState<'atLeast' | 'exactly'>('atLeast');
  const [withProof, setWithProof] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [response, setResponse] = useState<PlaygroundResponse | null>(null);
  const [rolaStatus, setRolaStatus] = useState<RolaStatus | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleRequest = async () => {
    if (!activeNetworkId) return;
    const rdt = getOrCreateToolkit(activeNetworkId);
    if (!rdt) return;

    setIsRequesting(true);
    setRequestError(null);
    setResponse(null);
    setRolaStatus(null);

    let challenge: string | null = null;
    if (withProof) {
      // Same generator the connect flow uses; capture the challenge for ROLA
      rdt.walletApi.provideChallengeGenerator(async () => {
        const res = await fetch('/api/auth/radix/challenge', { method: 'POST' });
        const data = (await res.json()) as { challenge: string };
        challenge = data.challenge;
        return data.challenge;
      });
    }

    const accountsRequest = withProof
      ? OneTimeDataRequestBuilder.accounts()[quantifier](Number(accountCount)).withProof()
      : OneTimeDataRequestBuilder.accounts()[quantifier](Number(accountCount));

    const result = await rdt.walletApi.sendOneTimeRequest(accountsRequest);

    if (result.isErr()) {
      setRequestError(result.error.message || result.error.error || 'rejected');
      setIsRequesting(false);
      return;
    }

    const data = result.value;
    setResponse({
      accounts: data.accounts ?? [],
      personaLabel: data.persona?.label ?? null,
      proofs: (data.proofs ?? []) as ProofItem[],
      challenge,
      raw: JSON.stringify(data, null, 2),
    });
    setIsRequesting(false);
  };

  const handleVerifyRola = async () => {
    if (!response || !response.challenge || response.proofs.length === 0) return;
    setIsVerifying(true);
    try {
      const res = await fetch('/api/auth/radix/rola-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          networkId: activeNetworkId,
          challenge: response.challenge,
          items: response.proofs,
        }),
      });
      const data = (await res.json()) as { results?: Array<{ address: string; verified: boolean }> };
      setRolaStatus(Object.fromEntries((data.results ?? []).map((r) => [r.address, r.verified])));
    } catch {
      setRolaStatus({});
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-5">
      <ToolSection title={labels.configTitle} hint={labels.configHint}>
        <div className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            {labels.accountsLabel}
          </span>
          <div className="flex flex-wrap gap-3">
            <OptionButtons
              options={['1', '2', '3'].map((n) => ({ value: n, label: n }))}
              value={accountCount}
              onChange={setAccountCount}
              size="sm"
              disabled={isRequesting}
            />
            <OptionButtons<'atLeast' | 'exactly'>
              options={[
                { value: 'atLeast', label: labels.atLeast, title: labels.atLeastHint },
                { value: 'exactly', label: labels.exactly, title: labels.exactlyHint },
              ]}
              value={quantifier}
              onChange={setQuantifier}
              size="sm"
              disabled={isRequesting}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            {labels.proofLabel}
          </span>
          <OptionButtons
            options={[
              { value: 'no', label: labels.proofOff, title: labels.proofOffHint },
              { value: 'yes', label: labels.proofOn, title: labels.proofOnHint },
            ]}
            value={withProof ? 'yes' : 'no'}
            onChange={(value) => setWithProof(value === 'yes')}
            size="sm"
            disabled={isRequesting}
          />
        </div>

        <button
          type="button"
          onClick={handleRequest}
          disabled={isRequesting}
          title={labels.requestHint}
          className="inline-flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          {isRequesting ? (
            <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {labels.requestButton}
        </button>
        {requestError && <p className="text-xs font-medium text-red-500">{requestError}</p>}
      </ToolSection>

      {response && (
        <ToolSection title={labels.responseTitle}>
          {response.accounts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                {labels.accountsReceived}
              </p>
              {response.accounts.map((account) => {
                const verified = rolaStatus?.[account.address];
                return (
                  <div key={account.address} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold" style={{ color: 'var(--color-text-main)' }}>{account.label}</span>
                    <code title={account.address} style={{ color: 'var(--color-text-muted)' }}>
                      {truncateAddress(account.address, 10, 6)}
                    </code>
                    <CopyButton value={account.address} size="xs" variant="minimal" />
                    {rolaStatus && verified !== undefined && (
                      verified ? (
                        <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold" title={labels.rolaOkHint}>
                          <CheckCircle2 className="size-3.5" /> ROLA
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-500 font-semibold" title={labels.rolaFailHint}>
                          <XCircle className="size-3.5" /> ROLA
                        </span>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {response.proofs.length > 0 && (
            <button
              type="button"
              onClick={handleVerifyRola}
              disabled={isVerifying}
              title={labels.rolaHint}
              className="inline-flex items-center gap-2 px-4 h-9 rounded-full text-xs font-bold border transition-all hover:-translate-y-px active:scale-95 disabled:opacity-40 cursor-pointer"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-card-border)',
                color: 'var(--color-text-main)',
              }}
            >
              {isVerifying ? (
                <span className="size-3.5 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
              ) : (
                <ShieldQuestion className="size-3.5" style={{ color: 'var(--color-primary)' }} />
              )}
              {labels.rolaButton}
            </button>
          )}

          <details>
            <summary
              className="text-xs font-semibold cursor-pointer transition-colors hover:text-[var(--color-accent)]"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {labels.rawResponse}
            </summary>
            <pre
              className="mt-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words max-h-[50vh] overflow-y-auto rounded-xl border p-4"
              style={{
                background: 'var(--code-bg)',
                borderColor: 'var(--color-card-border)',
                color: 'var(--color-text-main)',
              }}
            >
              {response.raw}
            </pre>
          </details>
        </ToolSection>
      )}
    </div>
  );
}
