'use client';

import { FileDropzone } from '@/features/console/components/shared/FileDropzone';
import { OptionButtons } from '@/features/console/components/shared/OptionButtons';
import { StringListField } from '@/features/console/components/shared/StringListField';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import type { WatermarkKind } from '../lib/pdf-watermark';
import type { SignDictionary } from '../types/dictionary';
import type { OutputFormat } from '../types/sign.types';

export function OutputFormatSection({
  t,
  outputs,
  pdfOk,
  busy,
  onChange,
}: {
  t: SignDictionary;
  outputs: OutputFormat[];
  pdfOk: boolean;
  busy: boolean;
  onChange: (next: OutputFormat[]) => void;
}) {
  return (
    <ToolSection title={t.options.outputTitle} hint={t.options.outputHint}>
      <OptionButtons<OutputFormat>
        multiple
        layout="grid"
        className="grid-cols-1 sm:grid-cols-2"
        value={outputs}
        onChange={onChange}
        disabled={busy}
        options={[
          {
            value: 'detached',
            label: t.options.outputDetached,
            description: t.options.outputDetachedDesc,
          },
          {
            value: 'embedded',
            label: t.options.outputEmbedded,
            description: t.options.outputEmbeddedDesc,
            disabled: !pdfOk,
            title: pdfOk ? undefined : t.options.embeddedPdfOnly,
          },
        ]}
      />
    </ToolSection>
  );
}

export function WatermarkSection({
  t,
  watermark,
  onWatermarkChange,
  watermarkText,
  onWatermarkTextChange,
  watermarkImageFile,
  onWatermarkImage,
  busy,
}: {
  t: SignDictionary;
  watermark: WatermarkKind;
  onWatermarkChange: (next: WatermarkKind) => void;
  watermarkText: string;
  onWatermarkTextChange: (next: string) => void;
  watermarkImageFile: File | null;
  onWatermarkImage: (file: File | null) => void;
  busy: boolean;
}) {
  return (
    <ToolSection title={t.seal.watermarkTitle} hint={t.seal.watermarkHint}>
      <OptionButtons<WatermarkKind>
        value={watermark}
        onChange={onWatermarkChange}
        disabled={busy}
        options={[
          {
            value: 'none',
            label: t.seal.watermarkNone,
            description: t.seal.watermarkNoneDesc,
          },
          {
            value: 'seal',
            label: t.seal.watermarkSeal,
            description: t.seal.watermarkSealDesc,
          },
          {
            value: 'own',
            label: t.seal.watermarkOwn,
            description: t.seal.watermarkOwnDesc,
          },
        ]}
      />
      {watermark === 'own' && (
        <div className="space-y-2">
          <input
            value={watermarkText}
            onChange={(e) => onWatermarkTextChange(e.target.value)}
            maxLength={60}
            disabled={busy}
            placeholder={t.seal.watermarkTextPlaceholder}
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none disabled:opacity-50"
            style={{
              background: 'var(--color-input-bg, var(--color-card-bg))',
              borderColor: 'var(--color-card-border)',
              color: 'var(--color-text-main)',
            }}
          />
          <FileDropzone
            extension=""
            accept="image/png,image/jpeg"
            label=""
            prompt={t.seal.watermarkImagePrompt}
            file={watermarkImageFile}
            onFile={onWatermarkImage}
            disabled={busy}
          />
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {t.seal.watermarkImageHint}
          </p>
        </div>
      )}
    </ToolSection>
  );
}

export function MultiModeSection({
  t,
  multi,
  onMultiChange,
  onchainMode,
  onOnchainChange,
  coSigners,
  onCoSignersChange,
  multiLedger,
  inviteMode,
  onInviteModeChange,
  busy,
}: {
  t: SignDictionary;
  multi: boolean;
  onMultiChange: (next: boolean) => void;
  onchainMode: boolean;
  onOnchainChange: (next: boolean) => void;
  coSigners: string[];
  onCoSignersChange: (next: string[]) => void;
  multiLedger: boolean;
  inviteMode: 'sign' | 'send';
  onInviteModeChange: (next: 'sign' | 'send') => void;
  busy: boolean;
}) {
  return (
    <ToolSection title={t.options.multiTitle} hint={t.options.multiHint}>
      <OptionButtons<'single' | 'multiple'>
        layout="grid"
        className="grid-cols-1 sm:grid-cols-2"
        value={multi ? 'multiple' : 'single'}
        onChange={(v) => onMultiChange(v === 'multiple')}
        disabled={busy}
        options={[
          {
            value: 'single',
            label: t.options.multiSingle,
            description: t.options.multiSingleDesc,
          },
          {
            value: 'multiple',
            label: t.options.multiMultiple,
            description: t.options.multiMultipleDesc,
          },
        ]}
      />
      <div className="space-y-1.5">
        <p
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {t.onchain.modeTitle}
        </p>
        <OptionButtons<'off' | 'on'>
          layout="grid"
          className="grid-cols-1 sm:grid-cols-2"
          value={onchainMode ? 'on' : 'off'}
          onChange={(v) => onOnchainChange(v === 'on')}
          disabled={busy}
          options={[
            {
              value: 'off',
              label: t.onchain.off,
              description: t.onchain.offDesc,
            },
            {
              value: 'on',
              label: t.onchain.on,
              description: t.onchain.onDesc,
            },
          ]}
        />
      </div>
      {multi && (
        <>
          <StringListField
            label={t.options.coSignersLabel}
            values={coSigners}
            onChange={onCoSignersChange}
            addLabel={t.options.addSigner}
            placeholder={t.options.signerPlaceholder}
            disabled={busy}
            categories={['account']}
          />
          <p
            className="text-xs leading-relaxed"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {onchainMode ? t.options.onchainSignersHint : t.options.coSignersHint}
          </p>
          {multiLedger && (
            <OptionButtons<'sign' | 'send'>
              layout="grid"
              className="grid-cols-1 sm:grid-cols-2"
              value={inviteMode}
              onChange={onInviteModeChange}
              disabled={busy}
              options={[
                {
                  value: 'sign',
                  label: t.onchain.inviteSign,
                  description: t.onchain.inviteSignDesc,
                },
                {
                  value: 'send',
                  label: t.onchain.inviteSend,
                  description: t.onchain.inviteSendDesc,
                },
              ]}
            />
          )}
        </>
      )}
      {multi && (
        <div
          className="rounded-xl border p-3.5 space-y-1.5"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-card-border)',
          }}
        >
          <p
            className="text-xs font-bold"
            style={{ color: 'var(--color-text-main)' }}
          >
            {onchainMode ? t.ledgerSteps.title : t.steps.title}
          </p>
          <ol
            className="text-xs leading-relaxed list-decimal pl-4 space-y-0.5"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {onchainMode ? (
              <>
                <li>{t.ledgerSteps.s1}</li>
                <li>{t.ledgerSteps.s2}</li>
                <li>{t.ledgerSteps.s3}</li>
                <li>{t.ledgerSteps.s4}</li>
              </>
            ) : (
              <>
                <li>{t.steps.s1}</li>
                <li>{t.steps.s2}</li>
                <li>{t.steps.s3}</li>
                <li>{t.steps.s4}</li>
                <li>{t.steps.s5}</li>
              </>
            )}
          </ol>
        </div>
      )}
    </ToolSection>
  );
}
