import { describe, it, expect } from 'vitest';
import { dashboardRoutes } from '@/features/dashboard/lib/routes';

const VALIDATOR = 'validator_tdx_2_1s0wluv529800cm8unpesrpnm8rtmppux7tnd20krx3ezpgetzhndwt';
const ACCOUNT = 'account_rdx12xt7t4kxhujrp0pjw828v30ejhkxux8zpfesxz6tu6h9vdw9fzc78r';
const TX = 'txid_rdx1r70f8clcn49xkazavuarfyshtyujffq3vhv2nwp5s73ph9hgarjsun0ecp';

/**
 * Typing a complete address into the search box focuses it. Which URL that
 * lands on decides whether the user stays where they were.
 */
describe('dashboardRoutes.entityFocus', () => {
    // The regression this guards: a validator's own page opens the staking
    // view, so sending the explorer's search there swapped the view out from
    // under someone who only wanted to see that validator's card.
    it('keeps a validator search inside the explorer', () => {
        expect(dashboardRoutes.entityFocus('es', 'transactions', VALIDATOR)).toBe(
            `/es/dashboard/explorer?entity=${VALIDATOR}`,
        );
    });

    it('keeps a validator search inside staking', () => {
        expect(dashboardRoutes.entityFocus('es', 'staking', VALIDATOR)).toBe(
            `/es/dashboard/staking?entity=${VALIDATOR}`,
        );
    });

    it('never leaves the view it was called from', () => {
        for (const view of ['staking', 'transactions'] as const) {
            const href = dashboardRoutes.entityFocus('en', view, VALIDATOR);
            expect(href).toContain(view === 'staking' ? '/staking' : '/explorer');
        }
    });

    // Other kinds have no staking page, so their dedicated route already lands
    // on the explorer and there is no view to lose.
    it('sends other entity kinds to their own page', () => {
        expect(dashboardRoutes.entityFocus('en', 'transactions', ACCOUNT)).toBe(
            `/en/dashboard/account/${ACCOUNT}`,
        );
        expect(dashboardRoutes.entityFocus('en', 'transactions', TX)).toBe(
            `/en/dashboard/tx/${TX}`,
        );
    });

    it('carries the network through so a focused link stays on its ledger', () => {
        expect(
            dashboardRoutes.entityFocus('en', 'transactions', VALIDATOR, { network: 'stokenet' }),
        ).toContain('network=stokenet');
    });
});
