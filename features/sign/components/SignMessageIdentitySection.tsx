'use client';

import { OptionButtons } from '@/features/console/components/shared/OptionButtons';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import {
  identitySelection,
  nextIdentityChoice,
  type IdentityOption,
} from '../lib/identity-options';
import type { SignDictionary } from '../types/dictionary';
import type { DisclosurePolicy } from '../types/sign.types';

/**
 * Signing message textarea and optional Persona identity disclosure selector.
 */
export function SignMessageIdentitySection({
  t,
  message,
  onMessageChange,
  disclosure,
  includeEmail,
  onDisclosureChange,
  busy,
}: {
  t: SignDictionary;
  message: string;
  onMessageChange: (next: string) => void;
  disclosure: DisclosurePolicy;
  includeEmail: boolean;
  onDisclosureChange: (next: {
    disclosure: DisclosurePolicy;
    includeEmail: boolean;
  }) => void;
  busy: boolean;
}) {
  const identityValue = identitySelection({ disclosure, includeEmail });
  const onIdentityChange = (next: IdentityOption[]) => {
    onDisclosureChange(nextIdentityChoice({ disclosure, includeEmail }, next));
  };

  return (
    <>
      <ToolSection title={t.options.messageTitle} hint={t.options.messageHint}>
        <textarea
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          maxLength={2000}
          rows={2}
          disabled={busy}
          placeholder={t.options.messagePlaceholder}
          className="w-full rounded-xl border px-3.5 py-2.5 text-sm resize-none outline-none disabled:opacity-50"
          style={{
            background: 'var(--color-input-bg, var(--color-card-bg))',
            borderColor: 'var(--color-card-border)',
            color: 'var(--color-text-main)',
          }}
        />
      </ToolSection>

      <ToolSection title={t.options.identityTitle} hint={t.options.identityHint}>
        <OptionButtons<IdentityOption>
          multiple
          layout="grid"
          className="grid-cols-2 sm:grid-cols-3"
          value={identityValue}
          onChange={onIdentityChange}
          disabled={busy}
          options={[
            {
              value: 'none',
              label: t.options.identityNone,
              description: t.options.identityNoneDesc,
            },
            {
              value: 'full_name',
              label: t.options.identityFull,
              description: t.options.identityFullDesc,
            },
            {
              value: 'email',
              label: t.options.identityEmail,
              description: t.options.identityEmailDesc,
            },
          ]}
        />
      </ToolSection>
    </>
  );
}
