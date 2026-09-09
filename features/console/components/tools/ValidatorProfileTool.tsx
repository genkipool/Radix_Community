'use client';

import { useState } from 'react';

import { useValidatorFormContext } from '../../hooks/useValidatorFormContext';
import { createValidatorOperation, type ValidatorOperation } from '../../lib/validator-operations';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { TextField } from '../shared/fields';

import { ValidatorFormShell } from '../validator/ValidatorFormShell';

type ProfileField = 'name' | 'description' | 'iconUrl' | 'infoUrl';

const FIELDS: ProfileField[] = ['name', 'description', 'iconUrl', 'infoUrl'];

/**
 * The public identity of a validator — what wallets and explorers show in the
 * staking list. None of it is set when the validator is created, and every
 * field is plain metadata gated by the same owner badge, so the whole form is
 * one transaction and a blank field simply emits no instruction.
 */
export default function ValidatorProfileTool({ t }: ConsoleToolProps) {
  const labels = t.validator;
  const form = labels.forms.profile;
  const ctx = useValidatorFormContext();
  const [values, setValues] = useState<Record<ProfileField, string>>({
    name: '',
    description: '',
    iconUrl: '',
    infoUrl: '',
  });

  const filled = FIELDS.some((field) => values[field].trim());

  const operations: ValidatorOperation[] =
    ctx.validator && filled
      ? [createValidatorOperation('profile', { validator: ctx.validator, ...values })]
      : [];

  return (
    <ValidatorFormShell
      t={t}
      ctx={ctx}
      operations={operations}
      title={form.title}
      hint={form.hint}
    >
      <div className="space-y-4">
        {FIELDS.map((field) => (
          <TextField
            key={field}
            label={form.fields[field].label}
            hint={form.fields[field].hint}
            value={values[field]}
            onChange={(value) => setValues((prev) => ({ ...prev, [field]: value }))}
            placeholder={form.fields[field].placeholder}
          />
        ))}
      </div>
    </ValidatorFormShell>
  );
}
