'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { gatewayPost } from '@/services/gateway/bases';
import { usePoolFormContext } from '../../hooks/usePoolFormContext';
import { poolProfileManifest, type PoolProfileUnitFields } from '../../lib/pool-manifests';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { TextField } from '../shared/fields';
import { PoolFormShell } from '../pool/PoolFormShell';

type Field = keyof PoolProfileUnitFields;
type Section = 'pool' | 'unit';

const POOL_FIELDS: Field[] = ['name', 'description', 'iconUrl', 'infoUrl'];
const UNIT_FIELDS: Field[] = ['name', 'symbol', 'description', 'iconUrl'];
const URL_FIELDS: Field[] = ['iconUrl', 'infoUrl'];

/** Metadata key behind each field. */
const METADATA_KEY: Record<Field, string> = {
  name: 'name',
  symbol: 'symbol',
  description: 'description',
  iconUrl: 'icon_url',
  infoUrl: 'info_url',
};

const isUrl = (value: string) => /^https?:\/\/\S+$/.test(value.trim());

type MetadataList = { items?: { key: string; value?: { typed?: { value?: unknown } } }[] };

/** The profile fields an entity already has, read from its metadata. */
const profileOf = (list: MetadataList | undefined): PoolProfileUnitFields =>
  Object.fromEntries(
    (Object.keys(METADATA_KEY) as Field[]).map((field) => {
      const value = list?.items?.find((m) => m.key === METADATA_KEY[field])?.value?.typed?.value;
      return [field, typeof value === 'string' ? value : ''];
    }),
  );

/**
 * The public identity of a pool and of its pool unit, which wallets show when
 * someone holds the units. Both are metadata gated by the owner role (the
 * engine gives the pool unit the pool's owner), so the form is one
 * transaction. The fields open with what the pool and its unit already have,
 * and only the ones changed are written.
 */
export default function PoolProfileTool({ t }: ConsoleToolProps) {
  const labels = t.pool;
  const form = labels.forms.profile;
  const ctx = usePoolFormContext();
  const { state } = ctx;
  const { activeNetwork } = useRadixWallet();
  // Edits per pool, so switching pools never carries one pool's text to another.
  const [edits, setEdits] = useState<Record<string, Record<Section, PoolProfileUnitFields>>>({});

  const { data: current } = useQuery({
    queryKey: ['console-pool-profile-current', activeNetwork, state?.address, state?.poolUnit],
    enabled: !!state,
    staleTime: 15_000,
    retry: false,
    queryFn: async (): Promise<Record<Section, PoolProfileUnitFields>> => {
      const data = await gatewayPost<{ items: { address: string; explicit_metadata?: MetadataList }[] }>(
        activeNetwork,
        '/state/entity/details',
        { addresses: [state!.address, state!.poolUnit], opt_ins: { explicit_metadata: Object.values(METADATA_KEY) } },
      );
      const of = (address: string) => profileOf(data.items.find((i) => i.address === address)?.explicit_metadata);
      return { pool: of(state!.address), unit: of(state!.poolUnit) };
    },
  });

  const mine = state ? edits[state.address] : undefined;
  const valueOf = (section: Section, field: Field) => mine?.[section]?.[field] ?? current?.[section]?.[field] ?? '';
  const edit = (section: Section, field: Field, value: string) => {
    if (!state) return;
    setEdits((all) => {
      const previous = all[state.address] ?? { pool: {}, unit: {} };
      return { ...all, [state.address]: { ...previous, [section]: { ...previous[section], [field]: value } } };
    });
  };
  // Only what differs from the ledger goes into the transaction.
  const changed = (section: Section, fields: Field[]): PoolProfileUnitFields =>
    Object.fromEntries(
      fields
        .map((field) => [field, valueOf(section, field)] as const)
        .filter(([field, value]) => value.trim() && value.trim() !== (current?.[section]?.[field] ?? '').trim()),
    );

  const badUrl = (['pool', 'unit'] as Section[]).some((section) =>
    URL_FIELDS.some((field) => {
      const value = valueOf(section, field);
      return value.trim() && !isUrl(value);
    }),
  );
  const canOwn = !!ctx.ownerProof || state?.owner.type === 'allowAll';

  const body = state
    ? poolProfileManifest({
        owner: ctx.ownerProof,
        pool: state.address,
        poolUnit: state.poolUnit,
        poolFields: changed('pool', POOL_FIELDS),
        unitFields: changed('unit', UNIT_FIELDS),
      })
    : '';

  const blockedReason = !state ? undefined : !canOwn ? form.needsOwner : undefined;

  const fieldsOf = (section: Section, keys: Field[]) =>
    keys.map((key) => {
      const value = valueOf(section, key);
      return (
        <TextField
          key={key}
          label={form.fields[key].label}
          hint={form.fields[key].hint}
          placeholder={form.fields[key].placeholder}
          value={value}
          onChange={(next) => edit(section, key, next)}
          error={URL_FIELDS.includes(key) && value.trim() && !isUrl(value) ? form.urlError : undefined}
        />
      );
    });

  return (
    <PoolFormShell
      t={t}
      ctx={ctx}
      manifest={blockedReason || badUrl ? '' : body}
      title={form.title}
      sendLabel={form.sendButton}
      hint={form.hint}
      blockedReason={blockedReason}
    >
      <div className="space-y-6">
        <div className="space-y-4">
          <span className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            {form.poolSection}
          </span>
          {fieldsOf('pool', POOL_FIELDS)}
        </div>
        <div className="space-y-4 pt-5 border-t" style={{ borderColor: 'var(--color-card-border)' }}>
          <span className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            {form.unitSection}
          </span>
          {fieldsOf('unit', UNIT_FIELDS)}
        </div>
      </div>
    </PoolFormShell>
  );
}
