import { describe, expect, it } from 'vitest';

import { ENTITY_KINDS, entityKindOf, isCardEntity } from '@/features/dashboard/lib/entityKinds';
import { resolveEntityKind, dashboardRoutes } from '@/features/dashboard/lib/routes';
import { getEntityType } from '@/features/dashboard/utils/entityUtils';
import { isRadixAddress } from '@/features/dashboard/utils/radixAddress';
import { validateAddress } from '@/utils/apiValidation';

const addr = (prefix: string) => `${prefix}tdx_2_1${'q'.repeat(54)}`;

describe('explorer entity kinds', () => {
  it('reads the kind from the prefix', () => {
    expect(entityKindOf(addr('pool_'))).toBe('pool');
    expect(entityKindOf(addr('locker_'))).toBe('locker');
    expect(entityKindOf(addr('consensusmanager_'))).toBe('system');
    expect(entityKindOf('txid_tdx_2_1abc')).toBeNull();
    expect(entityKindOf('')).toBeNull();
  });

  it('gives every kind a card except identities, and only for whole addresses', () => {
    for (const [kind, info] of Object.entries(ENTITY_KINDS)) {
      expect(isCardEntity(addr(info.prefixes[0])), kind).toBe(kind !== 'identity');
    }
    expect(isCardEntity('pool_tdx_2_1')).toBe(false);
  });

  it('labels a pool as a pool and a locker as a locker, never as a package', () => {
    expect(getEntityType(addr('pool_')).label).toBe('Pool');
    expect(getEntityType(addr('locker_')).label).toBe('Locker');
    expect(getEntityType(addr('package_')).label).toBe('Package');
  });

  it('lets the search, the transaction filter and the API accept pools and lockers', () => {
    for (const prefix of ['pool_', 'locker_']) {
      expect(isRadixAddress(addr(prefix)), prefix).toBe(true);
      expect(validateAddress(addr(prefix)), prefix).toBe(addr(prefix));
      expect(resolveEntityKind(addr(prefix)), prefix).toBe('component');
    }
  });

  it('opens pools and lockers in the explorer, focused on them', () => {
    expect(dashboardRoutes.entity('es', addr('locker_'))).toContain(`entity=${addr('locker_')}`);
    expect(dashboardRoutes.entity('es', addr('account_'))).toContain(`/account/${addr('account_')}`);
  });
});
