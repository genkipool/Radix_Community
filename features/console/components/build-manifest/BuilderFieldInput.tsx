'use client';

import type { ConsoleDictionary } from '../../types/i18n.types';
import { AccountPicker } from '../shared/AccountPicker';
import { OptionButtons } from '../shared/OptionButtons';
import { SelectField, TextAreaField, TextField } from '../shared/fields';

export type BuilderFieldKind =
  | 'account'
  | 'address'
  | 'resource'
  | 'decimal'
  | 'text'
  | 'nonFungibleId'
  | 'bucket'
  | 'proofRef'
  | 'multiline'
  | 'choice';

interface BuilderFieldInputProps {
  t: ConsoleDictionary;
  kind: BuilderFieldKind;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Options for the 'bucket' kind */
  bucketOptions?: string[];
  /** Options for the 'proofRef' kind */
  proofOptions?: string[];
  /** Options for the 'choice' kind (rendered as selectable buttons) */
  choiceOptions?: string[];
  optional?: boolean;
  disabled?: boolean;
}

const EMPTY_ARRAY: string[] = [];

/** Renders the right input control for a template/block field kind. */
export function BuilderFieldInput({
  t,
  kind,
  label,
  value,
  onChange,
  bucketOptions = EMPTY_ARRAY,
  proofOptions = EMPTY_ARRAY,
  choiceOptions = EMPTY_ARRAY,
  optional,
  disabled,
}: BuilderFieldInputProps) {
  const placeholders = t.buildManifest.fieldPlaceholders as Record<string, string>;
  const displayLabel = optional ? `${label} (${t.buildManifest.optional})` : label;

  if (kind === 'choice') {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          {displayLabel}
        </span>
        <OptionButtons
          options={choiceOptions.map((option) => ({ value: option, label: option }))}
          value={value}
          onChange={onChange}
          size="sm"
          disabled={disabled}
        />
      </div>
    );
  }

  if (kind === 'account') {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          {displayLabel}
        </span>
        <AccountPicker value={value || null} onChange={onChange} disabled={disabled} />
      </div>
    );
  }

  if (kind === 'bucket') {
    return (
      <SelectField
        label={displayLabel}
        value={value}
        onChange={onChange}
        options={bucketOptions.map((bucket) => ({ value: bucket, label: bucket }))}
        placeholder={placeholders.bucket}
        disabled={disabled}
      />
    );
  }

  if (kind === 'proofRef') {
    return (
      <SelectField
        label={displayLabel}
        value={value}
        onChange={onChange}
        options={proofOptions.map((proof) => ({ value: proof, label: proof }))}
        placeholder={placeholders.proofRef}
        disabled={disabled}
      />
    );
  }

  if (kind === 'multiline') {
    return (
      <TextAreaField
        label={displayLabel}
        value={value}
        onChange={onChange}
        placeholder={placeholders.multiline}
        rows={3}
        mono
        disabled={disabled}
      />
    );
  }

  return (
    <TextField
      label={displayLabel}
      value={value}
      onChange={onChange}
      placeholder={placeholders[kind]}
      type={kind === 'decimal' ? 'number' : 'text'}
      disabled={disabled}
    />
  );
}
