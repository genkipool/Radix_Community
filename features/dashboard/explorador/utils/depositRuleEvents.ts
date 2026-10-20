/**
 * features/dashboard/explorador/utils/depositRuleEvents.ts
 *
 * What a transaction changed in accounts' deposit rules, read from the events
 * native accounts emit for it. Pure: no React, no requests.
 */

import type { DefaultDepositRule } from '@/features/console/lib/account-deposits';
import type { GatewayEvent } from '@/features/dashboard/types';

export type DepositRuleChange =
  | { kind: 'default'; rule: DefaultDepositRule }
  | { kind: 'preference'; resource: string; preference: 'Allowed' | 'Disallowed' }
  | { kind: 'preference_removed'; resource: string }
  | { kind: 'depositor_added' | 'depositor_removed'; resource: string; localId: string | null };

/** The changes made to each account, in the order they happened. */
export type DepositRuleChanges = Record<string, DepositRuleChange[]>;

interface Field {
  field_name?: string;
  kind?: string;
  value?: unknown;
  variant_name?: string;
  fields?: Field[];
}

const RULES: DefaultDepositRule[] = ['Accept', 'AllowExisting', 'Reject'];

/** Every string value in a field, however deep it is nested. */
const strings = (field: Field | undefined): string[] =>
  !field ? [] : [...(typeof field.value === 'string' ? [field.value] : []), ...(field.fields ?? []).flatMap(strings)];

/** A badge named by a resource, or by one of its NFTs (`resource:localId`). */
function badgeOf(field: Field | undefined): { resource: string; localId: string | null } | null {
  for (const value of strings(field)) {
    if (!value.startsWith('resource_')) continue;
    const colon = value.indexOf(':');
    if (colon < 0) {
      const localId = strings(field).find((v) => v !== value && !v.startsWith('resource_')) ?? null;
      return { resource: value, localId };
    }
    return { resource: value.slice(0, colon), localId: value.slice(colon + 1) };
  }
  return null;
}

export function extractDepositRuleChanges(events: GatewayEvent[]): DepositRuleChanges {
  const changes: DepositRuleChanges = {};
  for (const event of events) {
    const account = event.emitter?.entity?.entity_address;
    if (!account?.startsWith('account_')) continue;
    const fields = ((event.data as { fields?: Field[] } | undefined)?.fields ?? []) as Field[];
    const resource = strings(fields.find((f) => f.field_name === 'resource_address'))[0] ?? '';
    let change: DepositRuleChange | null = null;

    switch (event.name) {
      case 'SetDefaultDepositRuleEvent': {
        const rule = fields.find((f) => f.kind === 'Enum')?.variant_name as DefaultDepositRule | undefined;
        if (rule && RULES.includes(rule)) change = { kind: 'default', rule };
        break;
      }
      case 'SetResourcePreferenceEvent': {
        const preference = fields.find((f) => f.field_name === 'preference')?.variant_name;
        if (resource && (preference === 'Allowed' || preference === 'Disallowed')) change = { kind: 'preference', resource, preference };
        break;
      }
      case 'RemoveResourcePreferenceEvent':
        if (resource) change = { kind: 'preference_removed', resource };
        break;
      case 'AddAuthorizedDepositorEvent':
      case 'RemoveAuthorizedDepositorEvent': {
        const badge = badgeOf({ fields });
        if (badge) change = { kind: event.name === 'AddAuthorizedDepositorEvent' ? 'depositor_added' : 'depositor_removed', ...badge };
        break;
      }
    }
    if (change) (changes[account] ??= []).push(change);
  }
  return changes;
}

/** The resources the changes name, to load their names and icons in one go. */
export const depositRuleResources = (changes: DepositRuleChanges) =>
  Object.values(changes).flat().flatMap((c) => ('resource' in c ? [c.resource] : []));
