'use client';

import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { FileDropzone } from '@/features/console/components/shared/FileDropzone';
import { OptionButtons } from '@/features/console/components/shared/OptionButtons';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import type { SignDictionary } from '../types/dictionary';

/** Live validation state of the supplied certificate + password. */
export type PadesStatus = 'idle' | 'checking' | 'valid' | 'invalid';

/** Immutable view of the PAdES/X.509 signing choices, owned by the parent. */
export interface PadesConfig {
  enabled: boolean;
  file: File | null;
  password: string;
  reason: string;
  location: string;
}

export const emptyPadesConfig: PadesConfig = {
  enabled: false,
  file: null,
  password: '',
  reason: '',
  location: '',
};

/**
 * Optional "sign this PDF with your own X.509 certificate" panel. Presentation
 * only: it collects the certificate + password + display fields; the actual
 * PAdES signing happens at delivery time (see `signPdfWithP12`). The private
 * key never leaves the browser.
 */
export function PadesSignSection({
  t,
  config,
  onChange,
  disabled,
  status = 'idle',
  checking = false,
  error,
}: {
  t: SignDictionary;
  config: PadesConfig;
  onChange: (next: PadesConfig) => void;
  disabled?: boolean;
  /** Last completed validation verdict. */
  status?: PadesStatus;
  /** A re-check is in flight; the previous verdict stays visible meanwhile. */
  checking?: boolean;
  /** Error code (mapped to a message) when the certificate can't be used. */
  error?: string;
}) {
  const p = t.pades;
  const set = (patch: Partial<PadesConfig>) => onChange({ ...config, ...patch });

  const errorMsg =
    status === 'invalid' && error
      ? (p.errors as Record<string, string>)[error] ?? p.errors.generic
      : '';

  const inputStyle = {
    background: 'var(--color-input-bg, var(--color-card-bg))',
    borderColor: 'var(--color-card-border)',
    color: 'var(--color-text-main)',
  } as const;

  return (
    <ToolSection title={p.title} hint={p.hint}>
      <OptionButtons<'off' | 'on'>
        value={config.enabled ? 'on' : 'off'}
        onChange={(v) => set({ enabled: v === 'on' })}
        disabled={disabled}
        options={[
          { value: 'off', label: p.off, description: p.offDesc },
          { value: 'on', label: p.on, description: p.onDesc },
        ]}
      />

      {config.enabled && (
        <div className="space-y-3">
          <FileDropzone
            extension=""
            accept=".p12,.pfx,application/x-pkcs12"
            label={p.certLabel}
            prompt={p.certPrompt}
            file={config.file}
            onFile={(file) => set({ file })}
            disabled={disabled}
          />

          <div className="space-y-1.5">
            <label
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {p.passwordLabel}
            </label>
            <input
              type="password"
              autoComplete="off"
              value={config.password}
              onChange={(e) => set({ password: e.target.value })}
              disabled={disabled}
              placeholder={p.passwordPlaceholder}
              className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none disabled:opacity-50"
              style={inputStyle}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {p.reasonLabel}
              </label>
              <input
                value={config.reason}
                onChange={(e) => set({ reason: e.target.value })}
                maxLength={200}
                disabled={disabled}
                placeholder={p.reasonPlaceholder}
                className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none disabled:opacity-50"
                style={inputStyle}
              />
            </div>
            <div className="space-y-1.5">
              <label
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {p.locationLabel}
              </label>
              <input
                value={config.location}
                onChange={(e) => set({ location: e.target.value })}
                maxLength={120}
                disabled={disabled}
                placeholder={p.locationPlaceholder}
                className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none disabled:opacity-50"
                style={inputStyle}
              />
            </div>
          </div>

          <p
            className="flex items-start gap-2 text-xs leading-relaxed"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <ShieldCheck className="size-4 shrink-0 mt-0.5" />
            {p.note}
          </p>

          {/* Live validation feedback in a FIXED-HEIGHT slot that is always
              rendered: idle, checking, valid and invalid all occupy exactly the
              same space, so nothing on the page ever moves. The spinner only
              overlays the current verdict, which stays put while re-checking. */}
          <div
            className="flex items-center gap-2 h-11 px-3.5 rounded-xl border text-sm"
            aria-live="polite"
            style={{
              background: 'var(--color-surface)',
              borderColor: errorMsg
                ? 'var(--color-danger, #dc2626)'
                : 'var(--color-card-border)',
              color: errorMsg
                ? 'var(--color-danger, #dc2626)'
                : status === 'valid'
                  ? 'var(--color-success, #16a34a)'
                  : 'var(--color-text-muted)',
            }}
          >
            {checking ? (
              <Loader2 className="size-4 shrink-0 animate-spin" />
            ) : errorMsg ? (
              <AlertCircle className="size-4 shrink-0" />
            ) : status === 'valid' ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : (
              <ShieldCheck className="size-4 shrink-0 opacity-40" />
            )}
            <span className="truncate font-semibold">
              {errorMsg || (status === 'valid' ? p.valid : checking ? p.checking : '')}
            </span>
          </div>
        </div>
      )}
    </ToolSection>
  );
}
