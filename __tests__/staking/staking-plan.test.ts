import { describe, it, expect } from 'vitest';
import {
    buildDistributedPlan,
    buildMixedPlan,
    type StakingPlanLabels,
    type ValidatorMeta,
} from '@/features/dashboard/staking/lib/stakingPlan';
import type { StakingEntry, ParsedResource } from '@/features/dashboard/explorador/types/models.types';

const ACCOUNT = 'account_rdx128testaccount';
const XRD = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';
const OWNER_BADGE = 'resource_rdx1nfxxxxxxxxxxvdrwerxxxxxxxxx004365253834xxxxxxxxxvdrwer';

const VAL_A: ValidatorMeta = {
    address: 'validator_rdx1a',
    name: 'Validator A',
    lsu2xrdFactor: 1.25,
    lsuResource: 'resource_rdx1lsu_a',
    claimTokenResourceAddress: 'resource_rdx1claim_a',
    ownerBadge: '[badge_a]',
};

const VAL_B: ValidatorMeta = {
    address: 'validator_rdx1b',
    name: 'Validator B',
    lsu2xrdFactor: 1.0,
    lsuResource: 'resource_rdx1lsu_b',
    claimTokenResourceAddress: 'resource_rdx1claim_b',
};

const ROWS: StakingEntry[] = [
    {
        validatorAddress: VAL_A.address,
        validatorName: 'Validator A',
        validatorIcon: '',
        xrdInStake: 500,
        xrdInUnstake: 0,
        xrdInClaim: 50,
        unstakes: [],
    },
    {
        validatorAddress: VAL_B.address,
        validatorName: 'Validator B',
        validatorIcon: '',
        xrdInStake: 100,
        xrdInUnstake: 0,
        xrdInClaim: 0,
        unstakes: [],
    },
];

const LSUS: ParsedResource[] = [
    {
        address: VAL_A.lsuResource,
        name: 'LSU A',
        symbol: 'LSU',
        iconUrl: '',
        amount: '400',
        isPoolUnit: false,
        isLsu: true,
        validatorAddress: VAL_A.address,
        isClaim: false,
        isNft: false,
    },
    {
        address: VAL_B.lsuResource,
        name: 'LSU B',
        symbol: 'LSU',
        iconUrl: '',
        amount: '100',
        isPoolUnit: false,
        isLsu: true,
        validatorAddress: VAL_B.address,
        isClaim: false,
        isNft: false,
    },
];

const LABELS: StakingPlanLabels = {
    stakeLockedBadge: 'locks LSU',
    stakeUnlockedBadge: 'unlocked',
    lockLsu: 'Lock LSU',
    ownerUnstake: 'Owner Unstake',
    ownerClaim: 'Owner Claim',
    unlocked: 'Unlocked',
    insufficientStake: 'Insufficient stake',
    insufficientLsu: 'Insufficient LSU',
    insufficientBalanceValidator: 'Insufficient balance in {address}',
    insufficientBalanceValidatorUnstake: 'Insufficient balance in {address} for Unstake',
};

describe('buildDistributedPlan', () => {
    it('splits Stake equally across selected validators and builds a valid manifest', () => {
        const plan = buildDistributedPlan({
            accountAddress: ACCOUNT,
            action: 'Stake',
            globalAmountStr: '100',
            targetAddresses: [VAL_A.address, VAL_B.address],
            displayRows: ROWS,
            validators: [VAL_A, VAL_B],
            lsuTokens: LSUS,
            claimableNfts: {},
            xrdAmount: '500',
            xrdResourceAddress: XRD,
            locale: 'en',
            labels: LABELS,
        });

        expect(plan.canSend).toBe(true);
        expect(plan.stakeItems).toHaveLength(2);
        expect(plan.stakeItems[0].amountXrd).toBe('50');
        expect(plan.stakeItems[1].amountXrd).toBe('50');
        expect(plan.manifest).toContain('"stake"');
        expect(plan.groups).toHaveLength(2);
    });

    it('disables sending when distributed Stake exceeds available XRD balance', () => {
        const plan = buildDistributedPlan({
            accountAddress: ACCOUNT,
            action: 'Stake',
            globalAmountStr: '600',
            targetAddresses: [VAL_A.address, VAL_B.address],
            displayRows: ROWS,
            validators: [VAL_A, VAL_B],
            lsuTokens: LSUS,
            claimableNfts: {},
            xrdAmount: '500',
            xrdResourceAddress: XRD,
            locale: 'en',
            labels: LABELS,
        });

        expect(plan.canSend).toBe(false);
        expect(plan.groups).toHaveLength(2);
    });

    it('flags Unstake when per-validator share exceeds one validator stake', () => {
        const plan = buildDistributedPlan({
            accountAddress: ACCOUNT,
            action: 'Unstake',
            globalAmountStr: '300', // 150 each -> exceeds VAL_B's 100 XRD
            targetAddresses: [VAL_A.address, VAL_B.address],
            displayRows: ROWS,
            validators: [VAL_A, VAL_B],
            lsuTokens: LSUS,
            claimableNfts: {},
            xrdAmount: '500',
            xrdResourceAddress: XRD,
            locale: 'en',
            labels: LABELS,
        });

        expect(plan.canSend).toBe(false);
        expect(plan.error).toBeTruthy();
        expect(plan.groups[1].actions[0].error).toBe(LABELS.insufficientStake);
    });

    it('builds Claim only for validators with matured claim NFTs', () => {
        const plan = buildDistributedPlan({
            accountAddress: ACCOUNT,
            action: 'Claim',
            globalAmountStr: '',
            targetAddresses: [VAL_A.address, VAL_B.address],
            displayRows: ROWS,
            validators: [VAL_A, VAL_B],
            lsuTokens: LSUS,
            claimableNfts: {
                [VAL_A.address]: { ids: ['#1#'], resource: VAL_A.claimTokenResourceAddress },
            },
            xrdAmount: '500',
            xrdResourceAddress: XRD,
            locale: 'en',
            labels: LABELS,
        });

        expect(plan.canSend).toBe(true);
        expect(plan.claimItems).toHaveLength(1);
        expect(plan.claimItems[0].validatorAddress).toBe(VAL_A.address);
        expect(plan.manifest).toContain('"claim_xrd"');
    });
});

describe('buildMixedPlan', () => {
    it('supports OwnerStake with lock (default) and without lock', () => {
        const locked = buildMixedPlan({
            accountAddress: ACCOUNT,
            validatorSelections: { [VAL_A.address]: { stake: '100', ownerLockOnStake: true } },
            ownerModeAddresses: new Set([VAL_A.address]),
            displayRows: ROWS,
            validators: [VAL_A, VAL_B],
            lsuTokens: LSUS,
            claimableNfts: {},
            xrdAmount: '500',
            xrdResourceAddress: XRD,
            ownerBadgeResourceAddress: OWNER_BADGE,
            locale: 'en',
            labels: LABELS,
        });

        expect(locked.canSend).toBe(true);
        expect(locked.manifest).toContain('"stake_as_owner"');
        expect(locked.manifest).toContain('"lock_owner_stake_units"');
        expect(locked.groups[0].actions[0].badge).toBe('locks LSU');

        const unlocked = buildMixedPlan({
            accountAddress: ACCOUNT,
            validatorSelections: { [VAL_A.address]: { stake: '100', ownerLockOnStake: false } },
            ownerModeAddresses: new Set([VAL_A.address]),
            displayRows: ROWS,
            validators: [VAL_A, VAL_B],
            lsuTokens: LSUS,
            claimableNfts: {},
            xrdAmount: '500',
            xrdResourceAddress: XRD,
            ownerBadgeResourceAddress: OWNER_BADGE,
            locale: 'en',
            labels: LABELS,
        });

        expect(unlocked.canSend).toBe(true);
        expect(unlocked.manifest).toContain('"stake_as_owner"');
        expect(unlocked.manifest).not.toContain('"lock_owner_stake_units"');
        expect(unlocked.groups[0].actions[0].badge).toBe('unlocked');
    });

    it('supports OwnerLock on existing liquid LSUs and rejects overflow', () => {
        const valid = buildMixedPlan({
            accountAddress: ACCOUNT,
            validatorSelections: { [VAL_A.address]: { ownerLock: '150' } },
            ownerModeAddresses: new Set([VAL_A.address]),
            displayRows: ROWS,
            validators: [VAL_A, VAL_B],
            lsuTokens: LSUS,
            claimableNfts: {},
            xrdAmount: '500',
            xrdResourceAddress: XRD,
            ownerBadgeResourceAddress: OWNER_BADGE,
            locale: 'en',
            labels: LABELS,
        });

        expect(valid.canSend).toBe(true);
        expect(valid.manifest).toContain('"lock_owner_stake_units"');
        expect(valid.manifest).toContain('Decimal("150")');

        const overflow = buildMixedPlan({
            accountAddress: ACCOUNT,
            validatorSelections: { [VAL_A.address]: { ownerLock: '999' } },
            ownerModeAddresses: new Set([VAL_A.address]),
            displayRows: ROWS,
            validators: [VAL_A, VAL_B],
            lsuTokens: LSUS,
            claimableNfts: {},
            xrdAmount: '500',
            xrdResourceAddress: XRD,
            ownerBadgeResourceAddress: OWNER_BADGE,
            locale: 'en',
            labels: LABELS,
        });

        expect(overflow.canSend).toBe(false);
        expect(overflow.error).toBe(LABELS.insufficientLsu);
    });

    it('disables sending when combined stakes across validators exceed XRD balance', () => {
        const plan = buildMixedPlan({
            accountAddress: ACCOUNT,
            validatorSelections: {
                [VAL_A.address]: { stake: '300' },
                [VAL_B.address]: { stake: '300' },
            },
            ownerModeAddresses: new Set(),
            displayRows: ROWS,
            validators: [VAL_A, VAL_B],
            lsuTokens: LSUS,
            claimableNfts: {},
            xrdAmount: '500',
            xrdResourceAddress: XRD,
            ownerBadgeResourceAddress: OWNER_BADGE,
            locale: 'en',
            labels: LABELS,
        });

        expect(plan.canSend).toBe(false);
        expect(plan.groups).toHaveLength(2);
    });
});
