'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';

import { useValidatorFormContext } from '../../hooks/useValidatorFormContext';
import { createValidatorOperation, type ValidatorOperation } from '../../lib/validator-operations';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { TextField } from '../shared/fields';
import { ValidatorFormShell } from '../validator/ValidatorFormShell';

/** Comfortably above the ~1,667 XRD that 100 USD of fee costs today. */
const DEFAULT_PAYMENT_XRD = '2000';

/** Compressed secp256k1 point: 33 bytes, so 66 hex characters. */
const PUBLIC_KEY_HEX_LENGTH = 66;

/**
 * Creating a validator is the one operation that cannot share a transaction
 * with anything else: the component address and the owner badge it mints do
 * not exist until this transaction commits, so no later instruction in the
 * same manifest could name them. It therefore gets a form of its own rather
 * than a switch inside another one, and the note below says why.
 */
export default function ValidatorCreateTool({ t }: ConsoleToolProps) {
  const labels = t.validator;
  const form = labels.forms.create;
  const ctx = useValidatorFormContext();

  const [publicKey, setPublicKey] = useState('');
  const [feeFactor, setFeeFactor] = useState('');
  /*
   * Not the price: the engine takes the creation fee out of this bucket and
   * hands the change back, so this is the ceiling the operator puts up. The
   * fee itself is protocol config (validator_creation_usd_cost × the USD
   * price) and is not exposed by the Gateway, so pinning the field to a
   * hardcoded number would silently under-fund the transaction the day that
   * config changes. Prefilled with room to spare instead, and editable.
   */
  const [payment, setPayment] = useState(DEFAULT_PAYMENT_XRD);

  const keyMalformed =
    publicKey.length > 0 &&
    (publicKey.length !== PUBLIC_KEY_HEX_LENGTH || !/^[0-9a-fA-F]+$/.test(publicKey));

  const complete = !!publicKey && !!feeFactor && !!payment && !keyMalformed;
  const operations: ValidatorOperation[] = complete
    ? [createValidatorOperation('create-validator', { publicKey, feeFactor, payment })]
    : [];

  return (
    <ValidatorFormShell
      t={t}
      ctx={ctx}
      operations={operations}
      title={form.title}
      hint={form.hint}
      withoutValidator
      blockedReason={
        keyMalformed
          ? form.keyError.replace('{length}', String(PUBLIC_KEY_HEX_LENGTH))
          : undefined
      }
    >
      <div className="space-y-4">
        <p
          className="flex items-start gap-2 text-[11px] leading-snug"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <Info
            className="size-4 shrink-0 mt-px"
            style={{ color: 'var(--color-primary)' }}
            aria-hidden
          />
          {form.standaloneNote}
        </p>

        <TextField
          label={form.keyLabel}
          hint={form.keyHint}
          value={publicKey}
          onChange={setPublicKey}
          placeholder="03…"
          error={
            keyMalformed
              ? form.keyError.replace('{length}', String(PUBLIC_KEY_HEX_LENGTH))
              : undefined
          }
        />
        <TextField
          label={form.feeLabel}
          hint={form.feeHint}
          value={feeFactor}
          onChange={setFeeFactor}
          placeholder="0.05"
          type="number"
        />
        <TextField
          label={form.paymentLabel}
          hint={form.paymentHint}
          value={payment}
          onChange={setPayment}
          placeholder="2000"
          type="number"
        />
      </div>
    </ValidatorFormShell>
  );
}
