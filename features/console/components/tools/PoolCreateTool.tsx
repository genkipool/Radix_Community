'use client';

import { useState } from 'react';
import { BadgePlus, KeyRound, Plus, Sparkles, Tags, X } from 'lucide-react';

import { useLanguage } from '@/context/LanguageContext';
import { truncateAddress } from '@/utils/formatters';
import { ConsoleToolLink } from '../../ConsoleNav';
import { toolQuery } from '../../lib/console-query';
import { useKnownAddresses } from '../../hooks/useKnownAddresses';
import { usePoolFormContext } from '../../hooks/usePoolFormContext';
import {
  POOL_KINDS,
  createPoolManifest,
  poolResourceCount,
  type PoolKind,
} from '../../lib/pool-manifests';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { OptionButtons } from '../shared/OptionButtons';
import { ResourceCard } from '../shared/ResourceCard';
import { AddressField, SearchField, TextField } from '../shared/fields';
import { PoolFormShell } from '../pool/PoolFormShell';

type ManagerMode = 'newBadge' | 'existingBadge';

const SLOTS: Record<PoolKind, number> = { one: 1, two: 2, multi: 3 };

/**
 * Creates a native pool that nobody but its manager can drain.
 *
 * The manager rule is the pool's whole security (contribute, protected deposit
 * and protected withdraw), so there is no AllowAll option: either a badge is
 * minted in the same transaction, or the pool is tied to a badge the account
 * already holds. The owner role (metadata of the pool and its pool unit) goes
 * to the same badge.
 */
export default function PoolCreateTool({ t }: ConsoleToolProps) {
  const labels = t.pool;
  const form = labels.forms.create;
  const ctx = usePoolFormContext();
  const { data: known } = useKnownAddresses();
  const { language } = useLanguage();

  const [kind, setKind] = useState<PoolKind>('two');
  const [resources, setResources] = useState<string[]>(['', '', '']);
  const [mode, setMode] = useState<ManagerMode>('newBadge');
  const [badgeName, setBadgeName] = useState(form.badgeNameDefault);
  const [badgeResource, setBadgeResource] = useState('');
  const [badgeQuery, setBadgeQuery] = useState('');
  const [badgeSymbol, setBadgeSymbol] = useState('');
  const [badgeDescription, setBadgeDescription] = useState('');
  const [badgeIconUrl, setBadgeIconUrl] = useState('');
  const [profile, setProfile] = useState({ name: '', description: '', iconUrl: '', infoUrl: '' });
  const setProfileField = (key: keyof typeof profile) => (value: string) => setProfile((p) => ({ ...p, [key]: value }));
  const profileFields = labels.forms.profile.fields;

  /** Fills every profile and badge field with sample values, a random number keeping them apart. */
  const fillExample = () => {
    const n = String(Math.floor(10 + Math.random() * 90));
    const icon = 'https://assets.radixdlt.com/icons/icon-xrd-32x32.png';
    setProfile({
      name: form.example.poolName.replace('{n}', n),
      description: form.example.poolDescription,
      iconUrl: icon,
      infoUrl: 'https://www.radixdlt.com',
    });
    setBadgeName(form.example.badgeName.replace('{n}', n));
    setBadgeSymbol(`GPP${n}`);
    setBadgeDescription(form.example.badgeDescription);
    setBadgeIconUrl(icon);
  };
  const badUrl = [profile.iconUrl, profile.infoUrl, mode === 'newBadge' ? badgeIconUrl : ''].some(
    (u) => u.trim() && !/^https?:\/\//.test(u.trim()),
  );

  // Multi pools grow past three on demand; one/two pools show exactly their slots.
  const slots = kind === 'multi' ? Math.max(SLOTS.multi, resources.length) : SLOTS[kind];
  const chosen = resources.slice(0, slots).map((r) => r.trim()).filter(Boolean);
  const duplicated = new Set(chosen).size !== chosen.length;
  const malformed = chosen.some((r) => !r.startsWith('resource_'));

  // Nothing typed yet is a prompt, not an error: the send button just stays off.
  const blockedReason = chosen.length === 0
    ? undefined
    : !poolResourceCount(kind, chosen.length)
    ? form.countError
    : duplicated
      ? form.duplicateError
      : malformed
        ? form.resourceError
        : mode === 'existingBadge' && !badgeResource.trim().startsWith('resource_')
          ? form.badgeError
          : mode === 'newBadge' && !badgeName.trim()
            ? form.badgeNameError
            : badUrl
              ? labels.forms.profile.urlError
              : undefined;

  const packages = { pool: known?.pool_package ?? '', resource: known?.resource_package ?? '' };
  const manifest =
    ctx.account && chosen.length > 0 && !blockedReason && packages.pool && packages.resource
      ? createPoolManifest({
          account: ctx.account,
          kind,
          resources: chosen,
          manager:
            mode === 'newBadge'
              ? { mode: 'newBadge', badgeName: badgeName.trim(), badgeSymbol, badgeDescription, badgeIconUrl }
              : { mode: 'existingBadge', resource: badgeResource.trim() },
          packages,
          profile,
        })
      : '';

  const setResource = (index: number, value: string) =>
    setResources((prev) => {
      const next = [...prev];
      while (next.length <= index) next.push('');
      next[index] = value;
      return next;
    });

  // Anything the account holds can serve as the badge; the rule asks for the resource.
  const holdingsBadges = [
    ...(ctx.holdings?.nonFungibles ?? []).map((nf) => ({
      resourceAddress: nf.resourceAddress,
      name: nf.name || truncateAddress(nf.resourceAddress, 8, 6),
      iconUrl: nf.iconUrl,
    })),
    ...(ctx.holdings?.fungibles ?? [])
      .filter((f) => Number(f.amount) > 0)
      .map((f) => ({
        resourceAddress: f.resourceAddress,
        name: f.name || f.symbol || truncateAddress(f.resourceAddress, 8, 6),
        iconUrl: f.iconUrl,
      })),
  ];
  const query = badgeQuery.trim().toLowerCase();
  const shownBadges = holdingsBadges.filter(
    (b) => !query || b.name.toLowerCase().includes(query) || b.resourceAddress.toLowerCase().includes(query),
  );

  return (
    <PoolFormShell
      t={t}
      ctx={ctx}
      manifest={manifest}
      title={form.title}
      sendLabel={form.sendButton}
      hint={form.hint}
      withoutPool
      blockedReason={ctx.account ? blockedReason : undefined}
      createdEntityLabel={form.created}
      afterResult={(result) => {
        const pool = result.createdEntities.find((a) => a.startsWith('pool_'));
        if (!pool) return null;
        const query = toolQuery({ pool, account: ctx.account });
        return (
          // The pool unit's address only exists now: its name and symbol are the next step.
          <ConsoleToolLink
            slug="pool-profile"
            query={query}
            href={`/${language}/console/pool-profile?${query}`}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition-opacity hover:opacity-80"
            style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-main)', background: 'var(--color-surface)' }}
          >
            <Tags className="size-4" />
            {form.unitNext}
          </ConsoleToolLink>
        );
      }}
    >
      <div className="space-y-6">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={fillExample}
            className="inline-flex items-center gap-1.5 text-xs font-bold transition-opacity hover:opacity-70"
            style={{ color: 'var(--color-primary)' }}
          >
            <Sparkles className="size-3.5" />
            {form.exampleButton}
          </button>
        </div>
        <div className="space-y-2">
          <span className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            {form.kindLabel}
          </span>
          <OptionButtons<PoolKind>
            layout="grid"
            className="sm:grid-cols-3"
            size="sm"
            options={POOL_KINDS.map((k) => ({ value: k, label: labels.kinds[k], description: form.kindHints[k] }))}
            value={kind}
            onChange={setKind}
          />
        </div>

        <div className="space-y-3">
          <span className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            {form.resourcesLabel}
          </span>
          {Array.from({ length: slots }, (_, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <AddressField
                  categories={['resource']}
                  label={form.resourceN.replace('{n}', String(i + 1))}
                  value={resources[i] ?? ''}
                  onChange={(value) => setResource(i, value)}
                  placeholder={t.buildManifest.fieldPlaceholders.resource}
                />
              </div>
              {kind === 'multi' && slots > 2 && i >= 2 && (
                <button
                  type="button"
                  onClick={() => setResources((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={form.removeResource}
                  title={form.removeResource}
                  className="mt-8 size-7 grid place-items-center rounded-lg cursor-pointer hover:opacity-70"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
          {kind === 'multi' && (
            <button
              type="button"
              onClick={() => setResources((prev) => [...prev.slice(0, slots), ''])}
              className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer hover:opacity-70"
              style={{ color: 'var(--color-primary)' }}
            >
              <Plus className="size-3.5" />
              {form.addResource}
            </button>
          )}
        </div>

        <div className="space-y-3">
          <span className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            {form.managerLabel}
          </span>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {form.managerHint}
          </p>
          <OptionButtons<ManagerMode>
            layout="grid"
            className="sm:grid-cols-2"
            size="sm"
            options={[
              { value: 'newBadge', label: form.managerNew, description: form.managerNewHint, icon: <BadgePlus className="size-4" /> },
              { value: 'existingBadge', label: form.managerExisting, description: form.managerExistingHint, icon: <KeyRound className="size-4" /> },
            ]}
            value={mode}
            onChange={setMode}
          />
          {mode === 'newBadge' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label={form.badgeNameLabel} value={badgeName} onChange={setBadgeName} maxLength={60} />
              <TextField label={form.badgeSymbolLabel} value={badgeSymbol} onChange={setBadgeSymbol} maxLength={12} placeholder="GPOOL" />
              <TextField label={form.badgeDescriptionLabel} value={badgeDescription} onChange={setBadgeDescription} maxLength={200} />
              <TextField label={form.badgeIconLabel} value={badgeIconUrl} onChange={setBadgeIconUrl} placeholder={profileFields.iconUrl.placeholder} />
            </div>
          ) : (
            <div className="space-y-3">
              {holdingsBadges.length > 0 && (
                <>
                  <SearchField value={badgeQuery} onChange={setBadgeQuery} placeholder={form.badgeSearch} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                    {shownBadges.map((b) => {
                      const active = b.resourceAddress === badgeResource.trim();
                      return (
                        <ResourceCard
                          key={b.resourceAddress}
                          isActive={active}
                          onClick={() => setBadgeResource(active ? '' : b.resourceAddress)}
                          name={b.name}
                          address={truncateAddress(b.resourceAddress, 8, 6)}
                          fullAddress={b.resourceAddress}
                          iconUrl={b.iconUrl}
                          title={b.resourceAddress}
                        />
                      );
                    })}
                  </div>
                </>
              )}
              <AddressField
                categories={['resource']}
                label={form.badgeResourceLabel}
                value={badgeResource}
                onChange={setBadgeResource}
                placeholder={t.buildManifest.fieldPlaceholders.resource}
              />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <span className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            {form.profileSection}
          </span>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {form.profileHint}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label={profileFields.name.label} value={profile.name} onChange={setProfileField('name')} placeholder={profileFields.name.placeholder} maxLength={60} />
            <TextField label={profileFields.description.label} value={profile.description} onChange={setProfileField('description')} placeholder={profileFields.description.placeholder} maxLength={200} />
            <TextField label={profileFields.iconUrl.label} value={profile.iconUrl} onChange={setProfileField('iconUrl')} placeholder={profileFields.iconUrl.placeholder} />
            <TextField label={profileFields.infoUrl.label} value={profile.infoUrl} onChange={setProfileField('infoUrl')} placeholder={profileFields.infoUrl.placeholder} />
          </div>
        </div>
      </div>
    </PoolFormShell>
  );
}
