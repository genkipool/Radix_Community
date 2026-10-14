'use client';

import type { ReactNode } from 'react';
import { BadgeCheck, CheckCircle2, XCircle } from 'lucide-react';
import type { WalletData } from '@radixdlt/radix-dapp-toolkit';
import { CopyButton } from '@/components/ui/CopyButton';
import { truncateAddress } from '@/utils/formatters';
import type { RolaProofResult } from '@/services/rola/verify';
import type { ConsoleDictionary } from '../../../types/i18n.types';

type Labels = ConsoleDictionary['walletPlayground'];

interface ResponseViewProps {
  labels: Labels;
  walletData: WalletData;
  challenge: string | null;
  rola: RolaProofResult[] | null;
  rolaError: string | null;
  isVerifying: boolean;
}

interface Row {
  key: string;
  kind: string;
  name?: string;
  /** Shown truncated with a copy button. */
  address?: string;
  text?: string;
  result?: RolaProofResult;
  /** Free content for the verdict column (overall verification row). */
  verdict?: ReactNode;
}

const OK = 'rgb(5, 150, 105)';
const FAIL = 'rgb(220, 38, 38)';
const BORDER = { borderColor: 'var(--color-card-border)' };

function Address({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <code className="text-[11px]" title={value} style={{ color: 'var(--color-text-muted)' }}>
        {truncateAddress(value, 10, 6)}
      </code>
      <CopyButton value={value} size="xs" variant="minimal" />
    </span>
  );
}

function Verdict({ result, labels }: { result?: RolaProofResult; labels: Labels }) {
  if (!result) return null;
  const why = result.verified
    ? (labels.rolaMethods as Record<string, string>)[result.method ?? '']
    : (labels.rolaReasons as Record<string, string>)[result.reason ?? ''] ?? labels.rolaFail;
  return (
    <span className="inline-flex flex-col items-end gap-0.5 text-right">
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: result.verified ? OK : FAIL }}>
        {result.verified ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
        {result.verified ? labels.rolaOk : labels.rolaFail}
      </span>
      {why && (
        <span className="text-[10.5px]" style={{ color: 'var(--color-text-muted)' }}>
          {why}
        </span>
      )}
    </span>
  );
}

/** What the wallet returned, as a plain table with bottom borders only. */
export function ResponseView({ labels, walletData, challenge, rola, rolaError, isVerifying }: ResponseViewProps) {
  const proofs = walletData.proofs ?? [];
  const resultFor = (address: string) => rola?.find((r) => r.address === address);
  const allOk = rola && rola.length > 0 && rola.every((r) => r.verified);
  const type = labels.proofType as Record<string, string>;

  const rows: Row[] = [];
  if (walletData.persona) {
    const { identityAddress, label } = walletData.persona;
    rows.push({ key: identityAddress, kind: type.persona, name: label, address: identityAddress, result: resultFor(identityAddress) });
  }
  for (const account of walletData.accounts) {
    rows.push({ key: account.address, kind: type.account, name: account.label, address: account.address, result: resultFor(account.address) });
  }
  // Accounts proven without being shared (proof of ownership) still get a row.
  for (const proof of proofs) {
    if (proof.type === 'account' && !walletData.accounts.some((a) => a.address === proof.address)) {
      rows.push({ key: proof.address, kind: type.account, address: proof.address, result: resultFor(proof.address) });
    }
  }
  for (const entry of walletData.personaData ?? []) {
    if (entry.entry === 'fullName') {
      const { givenNames, familyName, nickname, variant } = entry.fields;
      const name = (variant === 'eastern' ? `${familyName} ${givenNames}` : `${givenNames} ${familyName}`).trim();
      rows.push({ key: 'name', kind: labels.personaDataName, text: nickname ? `${name} (${nickname})` : name });
    } else {
      const kind = entry.entry === 'emailAddresses' ? labels.personaDataEmail : labels.personaDataPhone;
      entry.fields.forEach((value) => rows.push({ key: `${entry.entry}-${value}`, kind, text: value }));
    }
  }
  if (challenge && proofs.length > 0) {
    rows.push({ key: 'challenge', kind: labels.challengeLabel, address: challenge });
    // Verification runs on its own as soon as the answer arrives: one more row.
    const count = proofs.length === 1 ? labels.proofsCountOne : labels.proofsCount.replace('{count}', String(proofs.length));
    rows.push({
      key: 'rola',
      kind: labels.rolaRow,
      text: count,
      verdict: isVerifying ? (
        <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          <span className="size-3 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          {labels.rolaVerifying}
        </span>
      ) : rolaError ? (
        <span className="text-[11px] font-semibold" style={{ color: FAIL }}>{rolaError}</span>
      ) : rola && rola.length > 0 ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: allOk ? OK : FAIL }}>
          {allOk ? <BadgeCheck className="size-3.5" /> : <XCircle className="size-3.5" />}
          {allOk ? labels.rolaAllOk : labels.rolaSomeFail}
        </span>
      ) : null,
    });
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
        {labels.nothingShared}
      </p>
    );
  }

  return (
    <div>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b text-left" style={BORDER}>
            {[labels.colType, labels.colValue, labels.colRola].map((head, i) => (
              <th
                key={head}
                scope="col"
                className={`pb-2 text-[10px] font-bold uppercase tracking-widest ${i === 2 ? 'text-right' : ''}`}
                style={{ color: 'var(--color-text-muted)' }}
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b align-middle" style={BORDER}>
              <th scope="row" className="py-2.5 pr-3 text-left font-semibold whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
                {row.kind}
              </th>
              <td className="py-2.5 pr-3" style={{ color: 'var(--color-text-main)' }}>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {row.name && <span className="font-semibold">{row.name}</span>}
                  {row.address && <Address value={row.address} />}
                  {row.text && <span className="break-all">{row.text}</span>}
                </span>
              </td>
              <td className="py-2.5 text-right">
                {row.verdict ?? <Verdict result={row.result} labels={labels} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
