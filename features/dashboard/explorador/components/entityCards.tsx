'use client';
import type { ComponentType } from 'react';

import { entityKindOf, type ExplorerEntityKind } from '@/features/dashboard/lib/entityKinds';
import type { AccountCardProps } from '../types/components.types';
import { AccountCard } from './AccountCard';
import { ComponentCard } from './ComponentCard';
import { LockerCard } from './LockerCard';
import { PackageCard } from './PackageCard';
import { PoolCard } from './PoolCard';
import { ResourceCard } from './ResourceCard';
import { SystemCard } from './SystemCard';

/**
 * The card the explorer shows for each kind of entity. Kinds without a card
 * (an identity) are left out: `entityKinds.ts` says which ones have one.
 */
const ENTITY_CARDS: Partial<Record<ExplorerEntityKind, ComponentType<AccountCardProps>>> = {
    account: AccountCard,
    package: PackageCard,
    component: ComponentCard,
    pool: PoolCard,
    locker: LockerCard,
    resource: ResourceCard,
    validator: SystemCard,
    system: SystemCard,
};

/** The card for any entity address, picked by its prefix; nothing for an unknown one. */
export function EntityCard(props: AccountCardProps) {
    const kind = entityKindOf(props.address);
    const Card = kind ? ENTITY_CARDS[kind] : undefined;
    return Card ? <Card {...props} /> : null;
}
