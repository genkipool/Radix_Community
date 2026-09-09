'use client';

import { useState } from 'react';

import { useClaimableNfts } from '../../hooks/useClaimableNfts';
import { useValidatorFormContext } from '../../hooks/useValidatorFormContext';
import { useValidatorState } from '../../hooks/useValidatorState';
import { createValidatorOperation, type ValidatorOperation } from '../../lib/validator-operations';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { OptionButtons } from '../shared/OptionButtons';
import { AddressField, TextField } from '../shared/fields';
import { ClaimNftPicker, claimNftKey } from '../validator/ClaimNftPicker';
import { FormBlock } from '../validator/FormBlock';
import { ValidatorFormShell } from '../validator/ValidatorFormShell';

type StakeMode = 'stake-as-owner' | 'stake';

interface FormState {
  stake: { on: boolean; mode: StakeMode; amount: string };
  unstake: { on: boolean; resource: string; amount: string };
  claim: { on: boolean; selected: string[] };
  lock: { on: boolean; resource: string; amount: string };
  startUnlock: { on: boolean; amount: string };
  finishUnlock: { on: boolean };
}

const INITIAL: FormState = {
  stake: { on: false, mode: 'stake-as-owner', amount: '' },
  unstake: { on: false, resource: '', amount: '' },
  claim: { on: false, selected: [] },
  lock: { on: false, resource: '', amount: '' },
  startUnlock: { on: false, amount: '' },
  finishUnlock: { on: false },
};

/**
 * Staking against a validator, owner side and public side, in the order the
 * operations happen: stake, unstake, claim what has matured, then the owner
 * locked-vault cycle.
 *
 * Claiming is locked for the validator being unstaked from: the engine aborts
 * the whole transaction with EpochUnlockHasNotOccurredYet when a claim NFT
 * minted earlier in the same transaction is redeemed. Claims against *other*
 * validators are unaffected, which is why the picker locks per validator
 * rather than switching the whole block off.
 *
 * Each block spends what the account already holds — stake units produced by a
 * stake in this same transaction only land in the account at the end, so they
 * cannot be unstaked in the same breath.
 */
export default function ValidatorStakingTool({ t }: ConsoleToolProps) {
  const labels = t.validator;
  const form = labels.forms.staking;
  const ctx = useValidatorFormContext();
  const { data: onLedger } = useValidatorState(ctx.validator);
  const { data: claimable, isLoading: isLoadingClaims } = useClaimableNfts(ctx.account);
  const [state, setState] = useState<FormState>(INITIAL);

  const patch = <K extends keyof FormState>(key: K, value: Partial<FormState[K]>) =>
    setState((prev) => ({ ...prev, [key]: { ...prev[key], ...value } }));

  /* The validator mints both resources, so they are read rather than typed. */
  const stakeUnitResource = state.unstake.resource || onLedger?.stakeUnitResource || '';
  const lockResource = state.lock.resource || onLedger?.stakeUnitResource || '';

  const claimLock = state.unstake.on
    ? { address: ctx.validator, reason: form.claim.lockedByUnstake }
    : undefined;

  const nfts = claimable ?? [];
  const pickedNfts = nfts.filter((nft) => state.claim.selected.includes(claimNftKey(nft)));

  const operations: ValidatorOperation[] = [];
  if (ctx.validator) {
    const target = { validator: ctx.validator };
    if (state.stake.on) {
      operations.push(
        createValidatorOperation(state.stake.mode, { ...target, amount: state.stake.amount }),
      );
    }
    if (state.unstake.on) {
      operations.push(
        createValidatorOperation('unstake', {
          ...target,
          stakeUnitResource,
          amount: state.unstake.amount,
        }),
      );
    }
    if (state.lock.on) {
      operations.push(
        createValidatorOperation('lock-owner-stake-units', {
          ...target,
          stakeUnitResource: lockResource,
          amount: state.lock.amount,
        }),
      );
    }
    if (state.startUnlock.on) {
      operations.push(
        createValidatorOperation('start-unlock-owner-stake-units', {
          ...target,
          amount: state.startUnlock.amount,
        }),
      );
    }
    if (state.finishUnlock.on) {
      operations.push(createValidatorOperation('finish-unlock-owner-stake-units', target));
    }
  }

  /*
   * claim_xrd is a method on the validator that minted the NFT, so a selection
   * spanning several validators becomes one operation each — all legal in a
   * single transaction, since only unstake+claim on the SAME validator aborts.
   */
  if (state.claim.on) {
    const byValidator = new Map<string, { resource: string; ids: string[] }>();
    for (const nft of pickedNfts) {
      if (claimLock?.address === nft.validatorAddress) continue;
      const entry = byValidator.get(nft.validatorAddress) ?? {
        resource: nft.resourceAddress,
        ids: [],
      };
      entry.ids.push(nft.localId);
      byValidator.set(nft.validatorAddress, entry);
    }
    for (const [validator, { resource, ids }] of byValidator) {
      operations.push(
        createValidatorOperation('claim-xrd', {
          validator,
          claimNftResource: resource,
          claimNftIds: ids.join(', '),
        }),
      );
    }
  }

  return (
    <ValidatorFormShell t={t} ctx={ctx} operations={operations} title={form.title} hint={form.hint}>
      <div className="space-y-1">
        <FormBlock
          title={form.stake.title}
          description={form.stake.description}
          enabled={state.stake.on}
          onToggle={(on) => patch('stake', { on })}
        >
          <div className="sm:col-span-2">
            <OptionButtons<StakeMode>
              size="sm"
              value={state.stake.mode}
              onChange={(mode) => patch('stake', { mode, on: true })}
              options={[
                {
                  value: 'stake-as-owner',
                  label: form.stake.optionOwner,
                  title: form.stake.optionOwnerHint,
                },
                {
                  value: 'stake',
                  label: form.stake.optionPublic,
                  title: onLedger && !onLedger.acceptsDelegatedStake
                    ? form.stake.optionPublicClosed
                    : form.stake.optionPublicHint,
                },
              ]}
            />
          </div>
          <TextField
            label={form.stake.amountLabel}
            value={state.stake.amount}
            onChange={(amount) => patch('stake', { amount, on: true })}
            placeholder="1000"
            type="number"
          />
        </FormBlock>

        <FormBlock
          title={form.unstake.title}
          description={form.unstake.description}
          enabled={state.unstake.on}
          onToggle={(on) => patch('unstake', { on })}
        >
          <div className="sm:col-span-2">
            <AddressField
              categories={['resource']}
              label={form.unstake.resourceLabel}
              hint={onLedger?.stakeUnitResource ? form.resourceAutofilled : form.unstake.resourceHint}
              value={stakeUnitResource}
              onChange={(resource) => patch('unstake', { resource, on: true })}
              placeholder="resource_…"
            />
          </div>
          <TextField
            label={form.unstake.amountLabel}
            value={state.unstake.amount}
            onChange={(amount) => patch('unstake', { amount, on: true })}
            placeholder="100"
            type="number"
          />
        </FormBlock>

        <FormBlock
          title={form.claim.title}
          description={form.claim.description}
          enabled={state.claim.on}
          onToggle={(on) => patch('claim', { on })}
        >
          <div className="sm:col-span-2">
            <ClaimNftPicker
              t={t}
              nfts={nfts}
              isLoading={isLoadingClaims}
              selected={state.claim.selected}
              onToggle={(key) =>
                patch('claim', {
                  on: true,
                  selected: state.claim.selected.includes(key)
                    ? state.claim.selected.filter((entry) => entry !== key)
                    : [...state.claim.selected, key],
                })
              }
              lockedValidator={claimLock}
            />
          </div>
        </FormBlock>

        <FormBlock
          title={form.lock.title}
          description={form.lock.description}
          enabled={state.lock.on}
          onToggle={(on) => patch('lock', { on })}
        >
          <div className="sm:col-span-2">
            <AddressField
              categories={['resource']}
              label={form.lock.resourceLabel}
              hint={onLedger?.stakeUnitResource ? form.resourceAutofilled : undefined}
              value={lockResource}
              onChange={(resource) => patch('lock', { resource, on: true })}
              placeholder="resource_…"
            />
          </div>
          <TextField
            label={form.lock.amountLabel}
            value={state.lock.amount}
            onChange={(amount) => patch('lock', { amount, on: true })}
            placeholder="100"
            type="number"
          />
        </FormBlock>

        <FormBlock
          title={form.startUnlock.title}
          description={form.startUnlock.description}
          enabled={state.startUnlock.on}
          onToggle={(on) => patch('startUnlock', { on })}
        >
          <TextField
            label={form.startUnlock.amountLabel}
            value={state.startUnlock.amount}
            onChange={(amount) => patch('startUnlock', { amount, on: true })}
            placeholder="100"
            type="number"
          />
        </FormBlock>

        <FormBlock
          title={form.finishUnlock.title}
          description={form.finishUnlock.description}
          enabled={state.finishUnlock.on}
          onToggle={(on) => patch('finishUnlock', { on })}
        >
          <p
            className="sm:col-span-2 text-[11px] leading-snug"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {form.finishUnlock.note}
          </p>
        </FormBlock>
      </div>
    </ValidatorFormShell>
  );
}
