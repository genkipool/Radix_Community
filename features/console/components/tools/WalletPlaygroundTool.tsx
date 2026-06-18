'use client';

import { useState } from 'react';
import { CheckCircle2, ShieldQuestion, XCircle } from 'lucide-react';
import { OneTimeDataRequestBuilder, type WalletDataStateAccount, type WalletDataStatePersonaData, type OneTimeDataRequestBuilderItem } from '@radixdlt/radix-dapp-toolkit';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { getOrCreateToolkit } from '@/features/wallet/lib/radix-toolkit';
import { CopyButton } from '@/components/ui/CopyButton';
import { truncateAddress } from '@/utils/formatters';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { OptionButtons } from '../shared/OptionButtons';
import { RadixLogo } from '@/components/shared/RadixLogo';

interface ProofItem {
  type: 'account' | 'persona';
  address: string;
  proof: { publicKey: string; signature: string; curve: 'curve25519' | 'secp256k1' };
}

interface PlaygroundResponse {
  accounts: WalletDataStateAccount[];
  personaLabel: string | null;
  personaData: WalletDataStatePersonaData[] | null;
  proofs: ProofItem[];
  challenge: string | null;
  raw: string;
}

type RolaStatus = Record<string, boolean>;

export default function WalletPlaygroundTool({ t }: ConsoleToolProps) {
  const labels = t.walletPlayground as Record<string, string>;
  const { activeNetworkId } = useRadixWallet();

  // Accounts config
  const [accountCount, setAccountCount] = useState('1');
  const [quantifier, setQuantifier] = useState<'atLeast' | 'exactly'>('atLeast');
  const [withProof, setWithProof] = useState(false);

  // Persona Data config
  const [personaFields, setPersonaFields] = useState<string[]>([]);
  const personaName = personaFields.includes('name');
  const personaEmail = personaFields.includes('email');
  const personaPhone = personaFields.includes('phone');

  const requestAccounts = true;
  const requestPersonaData = personaFields.length > 0;

  const [isRequesting, setIsRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [response, setResponse] = useState<PlaygroundResponse | null>(null);
  const [rolaStatus, setRolaStatus] = useState<RolaStatus | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleRequest = async () => {
    if (!activeNetworkId) return;
    const rdt = getOrCreateToolkit(activeNetworkId);
    if (!rdt) return;

    if (!requestAccounts && !requestPersonaData) {
      setRequestError('Please select at least one type of data to request.');
      return;
    }

    if (requestPersonaData && !personaName && !personaEmail && !personaPhone) {
      setRequestError('Please select at least one persona data field to request.');
      return;
    }

    setIsRequesting(true);
    setRequestError(null);
    setResponse(null);
    setRolaStatus(null);

    let challenge: string | null = null;
    if (requestAccounts && withProof) {
      rdt.walletApi.provideChallengeGenerator(async () => {
        const res = await fetch('/api/auth/radix/challenge', { method: 'POST' });
        const data = (await res.json()) as { challenge: string };
        challenge = data.challenge;
        return data.challenge;
      });
    }

    const requestItems: OneTimeDataRequestBuilderItem[] = [];

    if (requestAccounts) {
      const accountsReq = withProof
        ? OneTimeDataRequestBuilder.accounts()[quantifier](Number(accountCount)).withProof()
        : OneTimeDataRequestBuilder.accounts()[quantifier](Number(accountCount));
      requestItems.push(accountsReq);
    }

    if (requestPersonaData) {
      let personaReq = OneTimeDataRequestBuilder.personaData();
      if (personaName) personaReq = personaReq.fullName();
      if (personaEmail) personaReq = personaReq.emailAddresses();
      if (personaPhone) personaReq = personaReq.phoneNumbers();
      requestItems.push(personaReq);
    }

    const result = await rdt.walletApi.sendOneTimeRequest(...requestItems);

    if (result.isErr()) {
      setRequestError(result.error.message || result.error.error || 'rejected');
      setIsRequesting(false);
      return;
    }

    const data = result.value;
    setResponse({
      accounts: data.accounts ?? [],
      personaLabel: data.persona?.label ?? null,
      personaData: data.personaData ?? null,
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
    }
    setIsVerifying(false);
  };

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <header className="space-y-1">
          <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-main)' }}>
            {labels.configTitle}
          </h3>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {labels.configHint}
          </p>
        </header>
        <div className="space-y-8">
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--color-text-muted)' }}>
              {labels.dataAccounts}
            </span>
            <div className="space-y-6">
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

              <div className="space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--color-text-muted)' }}>
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
            </div>
          </div>

          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--color-text-muted)' }}>
              {labels.dataPersonaData}
            </span>
            <div>
              <OptionButtons
                multiple
                options={[
                  { value: 'name', label: labels.personaDataName },
                  { value: 'email', label: labels.personaDataEmail },
                  { value: 'phone', label: labels.personaDataPhone }
                ]}
                value={personaFields}
                onChange={setPersonaFields}
                size="sm"
                disabled={isRequesting}
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRequest}
          disabled={isRequesting}
          title={labels.requestHint}
          className="flex w-full items-center justify-center bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] h-11 rounded-full font-bold text-sm hover:opacity-90 transition-opacity px-6 shadow active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          <RadixLogo
            label={labels.requestButton as string}
            showBeta={false}
            width="180"
            height="32"
            viewBox="0 0 240 40"
            fontSize={18}
            textX={135}
            textAnchor="middle"
            logoScale={0.12}
            logoTranslateY={8}
            logoTranslateX={5}
            strokeColor="white"
            textColor="white"
            className={isRequesting ? "animate-pulse" : ""}
          />
        </button>
        {requestError && <p className="text-xs font-medium text-red-500">{requestError}</p>}
      </div>

      {response && (
        <div className="space-y-4 pt-6 border-t" style={{ borderColor: 'var(--color-card-border)' }}>
          <header className="space-y-1">
            <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-main)' }}>
              {labels.responseTitle}
            </h3>
          </header>
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

          {response.personaData && response.personaData.length > 0 && (
            <div className="space-y-1.5 mt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                {labels.dataPersonaData}
              </p>
              <div className="flex flex-col gap-1 text-xs">
                {response.personaData.map((pd: WalletDataStatePersonaData, i: number) => {
                  if (pd.entry === 'fullName') {
                    return (
                      <div key={i}>
                        <span className="font-semibold" style={{ color: 'var(--color-text-muted)' }}>{labels.personaDataName}: </span>
                        {pd.fields.givenNames} {pd.fields.familyName} {pd.fields.nickname ? `(${pd.fields.nickname})` : ''}
                      </div>
                    );
                  }
                  if (pd.entry === 'emailAddresses') {
                    return pd.fields.map((email: string) => (
                      <div key={email}>
                        <span className="font-semibold" style={{ color: 'var(--color-text-muted)' }}>{labels.personaDataEmail}: </span>
                        {email}
                      </div>
                    ));
                  }
                  if (pd.entry === 'phoneNumbers') {
                    return pd.fields.map((phone: string) => (
                      <div key={phone}>
                        <span className="font-semibold" style={{ color: 'var(--color-text-muted)' }}>{labels.personaDataPhone}: </span>
                        {phone}
                      </div>
                    ));
                  }
                  return null;
                })}
              </div>
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
        </div>
      )}
    </div>
  );
}
