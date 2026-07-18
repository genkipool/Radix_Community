'use client';

import { useState } from 'react';
import { ArrowRight, Info, Smartphone } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { QrCode } from '@/features/p2p/components/QrCode';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { convertOlympiaAddress, olympiaAddressFromBabylon } from '../../services/retClient';
import {
  buildOlympiaExportPayloads,
  MNEMONIC_WORD_COUNTS,
  type MnemonicWordCount,
  type OlympiaAccountType,
} from '../../lib/olympia-export';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { SelectField, TextField } from '../shared/fields';
import { OptionButtons } from '../shared/OptionButtons';

interface ConversionResult {
  /** Address shown as the conversion output. */
  address: string;
  /** Which address is being shown as result. */
  resultKind: 'babylon' | 'olympia';
  /** Present for account conversions in either direction — enables the wallet import QR. */
  publicKeyHex?: string;
  /** Whether the result was recovered from an on-ledger signature (reverse mode). */
  recoveredFromLedger: boolean;
}

export default function ConvertOlympiaTool({ t }: ConsoleToolProps) {
  const labels = t.olympia;
  const { activeNetwork } = useRadixWallet();

  const [inputAddress, setInputAddress] = useState('');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Wallet-import QR options (must mirror the original Olympia wallet setup)
  const [accountType, setAccountType] = useState<OlympiaAccountType>('S');
  const [addressIndex, setAddressIndex] = useState('0');
  const [accountName, setAccountName] = useState('');
  const [wordCount, setWordCount] = useState('12');

  const handleConvert = async () => {
    const address = inputAddress.trim();
    setResult(null);
    setErrorMessage(null);
    setIsConverting(true);
    try {
      if (address.startsWith('account_')) {
        const reverse = await olympiaAddressFromBabylon(address, activeNetwork);
        if (reverse.ok) {
          setResult({
            address: reverse.olympiaAddress,
            resultKind: 'olympia',
            publicKeyHex: reverse.publicKeyHex,
            recoveredFromLedger: true,
          });
        } else {
          setErrorMessage(
            reverse.reason === 'no-transactions'
              ? labels.reverseErrorNoTx
              : reverse.reason === 'not-found'
                ? labels.reverseErrorNotFound
                : labels.error,
          );
        }
      } else {
        const conversion = await convertOlympiaAddress(address, activeNetwork);
        setResult({
          address: conversion.babylonAddress,
          resultKind: 'babylon',
          publicKeyHex: conversion.publicKeyHex,
          recoveredFromLedger: false,
        });
      }
    } catch {
      setErrorMessage(labels.error);
    }
    setIsConverting(false);
  };

  const parsedIndex = /^\d{1,9}$/.test(addressIndex.trim()) ? Number(addressIndex.trim()) : null;

  let qrPayload: string | null = null;
  if (result?.publicKeyHex && parsedIndex !== null) {
    try {
      qrPayload =
        buildOlympiaExportPayloads(
          [
            {
              accountType,
              publicKeyHex: result.publicKeyHex,
              addressIndex: parsedIndex,
              name: accountName,
            },
          ],
          Number(wordCount) as MnemonicWordCount,
        )[0] ?? null;
    } catch {
      qrPayload = null;
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <TextField
          label={labels.inputLabel}
          value={inputAddress}
          onChange={setInputAddress}
          placeholder={labels.placeholder}
          hint={labels.hint}
          error={errorMessage ?? undefined}
          disabled={isConverting}
        />

        <button
          type="button"
          onClick={handleConvert}
          disabled={!inputAddress.trim() || isConverting}
          className="flex w-full items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          {isConverting ? (
            <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          ) : (
            <ArrowRight className="size-4" />
          )}
          {labels.convert}
        </button>
      </div>

      {result && (
        <div className="space-y-4 pt-6 border-t" style={{ borderColor: 'var(--color-card-border)' }}>
          <header className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-main)' }}>
                {result.resultKind === 'babylon' ? labels.result : labels.olympiaResult}
              </h3>
              <CopyButton value={result.address} size="xs" variant="ghost" label={t.common.copy} />
            </div>
          </header>
          <code className="block p-4 rounded-xl text-xs break-all font-mono" style={{ background: 'var(--color-surface)', color: 'var(--color-text-main)' }}>
            {result.address}
          </code>
          {result.recoveredFromLedger && (
            <p className="flex items-start gap-2 text-[11px] leading-tight" style={{ color: 'var(--color-text-muted)' }}>
              <Info className="size-3.5 shrink-0 mt-0.5" />
              {labels.reverseNote}
            </p>
          )}
        </div>
      )}

      {result?.publicKeyHex && (
        <div className="space-y-5 pt-6 border-t" style={{ borderColor: 'var(--color-card-border)' }}>
          <header className="space-y-1">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-main)' }}>
              <Smartphone className="size-4" />
              {labels.qrTitle}
            </h3>
            <p className="text-[11px] leading-tight" style={{ color: 'var(--color-text-muted)' }}>
              {labels.qrDescription}
            </p>
          </header>

          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                {labels.accountType}
              </span>
              <OptionButtons<OlympiaAccountType>
                value={accountType}
                onChange={setAccountType}
                size="sm"
                options={[
                  { value: 'S', label: labels.accountTypeSoftware, title: labels.accountTypeSoftwareDesc },
                  { value: 'H', label: labels.accountTypeHardware, title: labels.accountTypeHardwareDesc },
                ]}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                label={labels.addressIndex}
                value={addressIndex}
                onChange={setAddressIndex}
                type="number"
                hint={labels.addressIndexHint}
                error={parsedIndex === null ? labels.addressIndexHint : undefined}
              />
              <TextField
                label={labels.accountName}
                value={accountName}
                onChange={setAccountName}
                maxLength={30}
                hint={labels.accountNameHint}
              />
              <SelectField
                label={labels.wordCount}
                value={wordCount}
                onChange={setWordCount}
                options={MNEMONIC_WORD_COUNTS.map((count) => ({ value: String(count), label: String(count) }))}
                hint={labels.wordCountHint}
              />
            </div>
          </div>

          {qrPayload && (
            <div className="flex justify-center py-2">
              <QrCode
                value={qrPayload}
                alt={labels.qrTitle}
                size={240}
                downloadName={`radix-olympia-import${parsedIndex !== null ? `-${parsedIndex}` : ''}.png`}
                downloadLabel={labels.qrDownload}
              />
            </div>
          )}

          <div className="space-y-3 rounded-xl p-4" style={{ background: 'var(--color-surface)' }}>
            <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-main)' }}>
              {labels.stepsTitle}
            </h4>
            <ol className="space-y-2">
              {labels.steps.map((step, index) => (
                <li key={index} className="flex items-start gap-3 text-xs leading-relaxed" style={{ color: 'var(--color-text-main)' }}>
                  <span
                    className="flex items-center justify-center size-5 shrink-0 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)]"
                  >
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="flex items-start gap-2 text-[11px] leading-tight pt-1" style={{ color: 'var(--color-text-muted)' }}>
              <Info className="size-3.5 shrink-0 mt-0.5" />
              {labels.stepsNote}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
