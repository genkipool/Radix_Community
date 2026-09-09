'use client';

import { useState } from 'react';

import {
  PROTOCOL_UPDATE_NAME,
  PROTOCOL_UPDATE_SIGNAL,
  PROTOCOL_UPDATE_TARGET_ENABLED,
  PROTOCOL_VERSION_NAME_LEN,
} from '@/features/dashboard/staking/constants/protocolUpdate';
import { useValidatorFormContext } from '../../hooks/useValidatorFormContext';
import { createValidatorOperation, type ValidatorOperation } from '../../lib/validator-operations';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { OptionButtons } from '../shared/OptionButtons';
import { TextField } from '../shared/fields';
import { FormBlock } from '../validator/FormBlock';
import { ValidatorFormShell } from '../validator/ValidatorFormShell';

type RegistrationChoice = 'register' | 'unregister';
type DelegationChoice = 'true' | 'false';

interface FormState {
  registration: { on: boolean; choice: RegistrationChoice };
  fee: { on: boolean; value: string };
  key: { on: boolean; value: string };
  delegation: { on: boolean; choice: DelegationChoice };
  vote: { on: boolean; value: string };
}

const INITIAL: FormState = {
  registration: { on: false, choice: 'register' },
  fee: { on: false, value: '' },
  key: { on: false, value: '' },
  delegation: { on: false, choice: 'true' },
  // The identifier is a network-wide constant announced with each protocol
  // update, not something an operator composes. It comes from
  // NEXT_PUBLIC_PROTOCOL_UPDATE_SIGNAL, so the field starts filled in whenever
  // an update is on the table and empty when none is.
  vote: { on: false, value: PROTOCOL_UPDATE_SIGNAL },
};

/** Wording for a control whose two positions are a boolean on-ledger state. */
interface StateControlCopy {
  /** Reads as the state, for the position the validator is already in. */
  stateOn: string;
  stateOff: string;
  /** Reads as the change, for the position that would flip it. */
  actionOn: string;
  actionOff: string;
  titleCurrent: string;
  titleChange: string;
}

/**
 * Registration and configuration: every owner setting that is not the public
 * profile, in one form and therefore one transaction.
 *
 * The contradictions the engine would accept silently — register together with
 * unregister, two different fee changes — cannot be expressed here: each
 * setting is a single control, so the form can only describe one outcome per
 * setting. That is why this tool needs no conflict warnings.
 */
export default function ValidatorRegistrationTool({ t }: ConsoleToolProps) {
  const labels = t.validator;
  const form = labels.forms.registration;
  const ctx = useValidatorFormContext();
  const [state, setState] = useState<FormState>(INITIAL);

  /*
   * With several validators switched on, a two-position control can only speak
   * for them when they agree. Where they differ the labels stay neutral rather
   * than claiming a state half of them are not in.
   */
  const agreedState = <K extends 'isRegistered' | 'acceptsDelegatedStake'>(key: K) => {
    const values = ctx.validators.map((address) => ctx.states[address]?.[key]);
    if (!values.length || values.some((value) => value === undefined)) return undefined;
    return values.every((value) => value === values[0]) ? values[0] : undefined;
  };
  const isRegistered = agreedState('isRegistered');
  const acceptsDelegated = agreedState('acceptsDelegatedStake');

  /** The current fee, shown only when every selected validator shares it. */
  const fees = [...new Set(ctx.validators.map((address) => ctx.states[address]?.feeFactor))];
  const currentFee = fees.length === 1 && fees[0] ? fees[0] : undefined;

  /*
   * A two-position control names a STATE, and the position the validator is
   * NOT currently in is phrased as the action that would take it there. Two
   * buttons reading "Registered / Unregistered" force the operator to work out
   * which one is already true; "Registered / Unregister it" does not. Until the
   * lookup answers, both stay neutral rather than guessing.
   */
  const stateOption = (copy: StateControlCopy, current: boolean | undefined, isOn: boolean) => {
    const known = current !== undefined;
    const isCurrent = known && isOn === current;
    return {
      label: !known || isCurrent ? (isOn ? copy.stateOn : copy.stateOff) : isOn ? copy.actionOn : copy.actionOff,
      title: !known ? undefined : isCurrent ? copy.titleCurrent : copy.titleChange,
    };
  };

  const patch = <K extends keyof FormState>(key: K, value: Partial<FormState[K]>) =>
    setState((prev) => ({ ...prev, [key]: { ...prev[key], ...value } }));

  const voteLength = state.vote.value.length;
  const voteInvalid = state.vote.on && voteLength > 0 && voteLength !== PROTOCOL_VERSION_NAME_LEN;

  const operations: ValidatorOperation[] = [];
  for (const validator of ctx.validators) {
    const target = { validator };
    if (state.registration.on) operations.push(createValidatorOperation(state.registration.choice, target));
    if (state.fee.on) {
      operations.push(createValidatorOperation('update-fee', { ...target, feeFactor: state.fee.value }));
    }
    if (state.key.on) {
      operations.push(createValidatorOperation('update-key', { ...target, publicKey: state.key.value }));
    }
    if (state.delegation.on) {
      operations.push(
        createValidatorOperation('accept-delegated-stake', {
          ...target,
          accept: state.delegation.choice,
        }),
      );
    }
    if (state.vote.on && !voteInvalid) {
      operations.push(
        createValidatorOperation('signal-protocol-update', { ...target, version: state.vote.value }),
      );
    }
  }

  return (
    <ValidatorFormShell
      t={t}
      ctx={ctx}
      operations={operations}
      title={form.title}
      hint={form.hint}
      blockedReason={
        voteInvalid
          ? form.voteLengthError.replace('{length}', String(PROTOCOL_VERSION_NAME_LEN))
          : undefined
      }
    >
      <div className="space-y-3">
        <FormBlock
          title={form.registration.title}
          description={form.registration.description}
          enabled={state.registration.on}
          onToggle={(on) => patch('registration', { on })}
        >
          <div className="sm:col-span-2">
            <OptionButtons<RegistrationChoice>
              size="sm"
              value={state.registration.choice}
              onChange={(choice) => patch('registration', { choice, on: true })}
              options={[
                { value: 'register', ...stateOption(form.registration, isRegistered, true) },
                { value: 'unregister', ...stateOption(form.registration, isRegistered, false) },
              ]}
            />
          </div>
        </FormBlock>

        <FormBlock
          title={form.fee.title}
          description={form.fee.description}
          enabled={state.fee.on}
          onToggle={(on) => patch('fee', { on })}
        >
          <TextField
            label={form.fee.label}
            value={state.fee.value}
            onChange={(value) => patch('fee', { value, on: true })}
            placeholder="0.05"
            type="number"
            hint={currentFee ? form.fee.current.replace('{value}', currentFee) : undefined}
          />
        </FormBlock>

        <FormBlock
          title={form.key.title}
          description={form.key.description}
          enabled={state.key.on}
          onToggle={(on) => patch('key', { on })}
        >
          <div className="sm:col-span-2">
            <TextField
              label={form.key.label}
              value={state.key.value}
              onChange={(value) => patch('key', { value, on: true })}
              placeholder="03…"
              hint={form.key.hint}
            />
          </div>
        </FormBlock>

        <FormBlock
          title={form.delegation.title}
          description={form.delegation.description}
          enabled={state.delegation.on}
          onToggle={(on) => patch('delegation', { on })}
        >
          <div className="sm:col-span-2">
            <OptionButtons<DelegationChoice>
              size="sm"
              value={state.delegation.choice}
              onChange={(choice) => patch('delegation', { choice, on: true })}
              options={[
                { value: 'true', ...stateOption(form.delegation, acceptsDelegated, true) },
                { value: 'false', ...stateOption(form.delegation, acceptsDelegated, false) },
              ]}
            />
          </div>
        </FormBlock>

        <FormBlock
          title={form.vote.title}
          description={form.vote.description}
          enabled={state.vote.on}
          onToggle={(on) => patch('vote', { on })}
        >
          <div className="sm:col-span-2">
            <TextField
              label={form.vote.label}
              value={state.vote.value}
              onChange={(value) => patch('vote', { value, on: true })}
              maxLength={PROTOCOL_VERSION_NAME_LEN}
              hint={
                PROTOCOL_UPDATE_TARGET_ENABLED
                  ? form.vote.hintTarget.replace(
                      '{name}',
                      PROTOCOL_UPDATE_NAME || PROTOCOL_UPDATE_SIGNAL,
                    )
                  : form.vote.hintNone
              }
              error={
                voteInvalid
                  ? form.voteLengthError.replace('{length}', String(PROTOCOL_VERSION_NAME_LEN))
                  : undefined
              }
            />
          </div>
        </FormBlock>
      </div>
    </ValidatorFormShell>
  );
}
