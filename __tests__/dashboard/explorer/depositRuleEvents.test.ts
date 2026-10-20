import { describe, it, expect } from 'vitest';
import { depositRuleResources, extractDepositRuleChanges } from '@/features/dashboard/explorador/utils/depositRuleEvents';
import type { GatewayEvent } from '@/features/dashboard/types';

const ACCOUNT = 'account_rdx1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const BADGE = 'resource_rdx1nbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const TOKEN = 'resource_rdx1tcccccccccccccccccccccccccccccccccccccccccccccccccccc';

const event = (name: string, fields: unknown[], emitter = ACCOUNT) =>
    ({ name, emitter: { entity: { entity_address: emitter } }, data: { kind: 'Tuple', fields } }) as unknown as GatewayEvent;

describe('extractDepositRuleChanges', () => {
    it('reads every kind of change, per account, in order', () => {
        const changes = extractDepositRuleChanges([
            event('SetDefaultDepositRuleEvent', [{ kind: 'Enum', variant_name: 'Reject', field_name: 'default_deposit_rule', fields: [] }]),
            event('SetResourcePreferenceEvent', [
                { kind: 'Reference', field_name: 'resource_address', value: TOKEN },
                { kind: 'Enum', field_name: 'preference', variant_name: 'Allowed', fields: [] },
            ]),
            event('RemoveResourcePreferenceEvent', [{ kind: 'Reference', field_name: 'resource_address', value: TOKEN }]),
            event('AddAuthorizedDepositorEvent', [{
                kind: 'Enum', variant_name: 'NonFungible', field_name: 'authorized_depositor_badge',
                fields: [{ kind: 'Tuple', fields: [{ kind: 'Reference', value: BADGE }, { kind: 'NonFungibleLocalId', value: '#1#' }] }],
            }]),
            event('RemoveAuthorizedDepositorEvent', [{ kind: 'Enum', variant_name: 'Resource', field_name: 'authorized_depositor_badge', fields: [{ kind: 'Reference', value: BADGE }] }]),
        ]);
        expect(changes).toEqual({
            [ACCOUNT]: [
                { kind: 'default', rule: 'Reject' },
                { kind: 'preference', resource: TOKEN, preference: 'Allowed' },
                { kind: 'preference_removed', resource: TOKEN },
                { kind: 'depositor_added', resource: BADGE, localId: '#1#' },
                { kind: 'depositor_removed', resource: BADGE, localId: null },
            ],
        });
        expect(depositRuleResources(changes)).toEqual([TOKEN, TOKEN, BADGE, BADGE]);
    });

    it('reads a badge given as one global id string', () => {
        const changes = extractDepositRuleChanges([
            event('AddAuthorizedDepositorEvent', [{ kind: 'Enum', variant_name: 'NonFungible', fields: [{ kind: 'NonFungibleGlobalId', value: `${BADGE}:#7#` }] }]),
        ]);
        expect(changes[ACCOUNT]).toEqual([{ kind: 'depositor_added', resource: BADGE, localId: '#7#' }]);
    });

    it('ignores other events and events not emitted by accounts', () => {
        expect(extractDepositRuleChanges([
            event('DepositEvent', [{ kind: 'Decimal', field_name: 'amount', value: '1' }]),
            event('SetDefaultDepositRuleEvent', [{ kind: 'Enum', variant_name: 'Accept', fields: [] }], 'component_rdx1xyz'),
        ])).toEqual({});
    });
});
