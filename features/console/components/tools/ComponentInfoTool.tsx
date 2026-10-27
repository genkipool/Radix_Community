'use client';

import type { ReactNode } from 'react';
import { ExternalLink, LayoutDashboard } from 'lucide-react';

import { useLanguage } from '@/context/LanguageContext';
import { dashboardRoutes } from '@/features/dashboard/lib/routes';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { truncateAddress } from '@/utils/formatters';
import { useComponentInfo } from '../../hooks/useComponentInfo';
import { useConsoleQueryState } from '../../hooks/useConsoleQueryState';
import { useNetworkSelection } from '../../hooks/useNetworkSelection';
import { useResourceLabels } from '../../hooks/useResourceLabels';
import { packageOfCallerRule } from '../../lib/caller-badge';
import { componentFindingAddresses, componentFindingText } from '../../lib/finding-text';
import { toolQuery } from '../../lib/console-query';
import { entityRoles, isGlobalCallerBadge, ownerRule, type RuleView } from '../../lib/role-lookup';
import type { ConsoleDictionary } from '../../types/i18n.types';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { EntityPermissions } from '../shared/EntityPermissions';
import { AddressLine, CardSkeleton, cardError, EntityCard, EntityCardMessage, Facts, RuleSummary, Sub, badgeNamer, fmtNumber } from '../shared/InfoParts';
import { MultiAddressSelect, addressesFromUrl } from '../shared/MultiAddressSelect';
import { SecurityAnalysis, type AnalysisItem } from '../shared/SecurityAnalysis';
import { ToolSection } from '../shared/ToolSection';

/**
 * Read-only view of one or several components: their profile, package and
 * blueprint, owner, royalties, a security analysis and every role, with a
 * shortcut to the component panel to call their methods. Nothing is signed.
 */
export default function ComponentInfoTool({ t }: ConsoleToolProps) {
  const labels = t.componentInfo;
  const [allComponents, setAllComponents] = useConsoleQueryState<string[]>(() => addressesFromUrl('component'), []);
  // Only the active network's components show; the others wait for their network.
  const [components, setComponents] = useNetworkSelection(allComponents, setAllComponents);

  return (
    <div className="space-y-5">
      <ToolSection title={labels.contextTitle}>
        <MultiAddressSelect
          label={labels.componentLabel}
          kind="component"
          values={components}
          onChange={setComponents}
          suggestions={[]}
          placeholder={labels.placeholder}
        />
      </ToolSection>

      {components.map((address) => (
        <ComponentInfoCard key={address} t={t} address={address} onRemove={() => setComponents((c) => c.filter((a) => a !== address))} />
      ))}
    </div>
  );
}

function ComponentInfoCard({ t, address, onRemove }: { t: ConsoleDictionary; address: string; onRemove: () => void }) {
  const labels = t.componentInfo;
  const findingsText = labels.security.findings;
  const { language } = useLanguage();
  const { activeNetwork } = useRadixWallet();
  const { info, isLoading, error, findings, origin, ownerCallers, packageDetails } = useComponentInfo(address, activeNetwork);

  const owner = info ? ownerRule(info.details) : null;
  const packageOwner = packageDetails ? ownerRule(packageDetails).rule : null;
  const holdResources = findings?.flatMap((f) => ('resource' in f ? [f.resource] : [])) ?? [];
  const badgeResources = [owner?.rule, packageOwner].flatMap((r) => (r && (r.type === 'resource' || r.type === 'nonFungible') ? [r.resource] : []));
  const names = useResourceLabels([...holdResources, ...badgeResources]);

  if (isLoading) return <CardSkeleton />;
  if (!info) {
    return <EntityCardMessage address={address} message={cardError(error, labels.notAComponent)} onRemove={onRemove} removeLabel={labels.remove} />;
  }

  const explorer = (a: string) => dashboardRoutes.entity(language, a, { network: activeNetwork });
  const addressLine = (a: string) => <AddressLine address={a} href={explorer(a)} copyLabel={t.common.copy} />;
  const date = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(language) : '—');
  const resourceName = (r: string) => names[r] ?? truncateAddress(r, 10, 6);
  /** The component or package a caller rule names, as a line under the rule. */
  const callerLine = (rule: RuleView) => {
    if (rule.type !== 'nonFungible') return undefined;
    const entity = packageOfCallerRule(rule) ?? (isGlobalCallerBadge(rule.resource) ? ownerCallers?.[rule.localId] : undefined);
    return entity ? addressLine(entity) : undefined;
  };

  const items: AnalysisItem[] | null =
    findings?.map((f) => ({
      severity: f.severity,
      text: componentFindingText(findingsText, f, { name: resourceName, date: (iso) => date(iso), number: fmtNumber, unnamedDapp: labels.security.unnamedDapp }),
      addresses: componentFindingAddresses(f),
    })) ?? null;

  const query = toolQuery({ component: address });
  const holds =
    info.fungibles + info.nonFungibles > 0
      ? labels.holds.replace('{tokens}', String(info.fungibles)).replace('{nfts}', String(info.nonFungibles))
      : labels.holdsNothing;

  return (
    <EntityCard
      address={address}
      name={info.profile.name || info.blueprint.split(' ')[0] || labels.unnamed}
      iconUrl={info.profile.iconUrl}
      meta={<Sub>{info.blueprint}</Sub>}
      description={info.profile.description}
      url={info.profile.infoUrl}
      onRemove={onRemove}
      removeLabel={labels.remove}
      copyLabel={t.common.copy}
      shortcuts={[
        {
          href: `/${language}/console/component-panel?${query}`,
          tool: { slug: 'component-panel', query },
          label: labels.goPanel,
          icon: <LayoutDashboard className="size-4" />,
        },
        { href: explorer(address), label: labels.goExplorer, icon: <ExternalLink className="size-4" /> },
      ]}
    >
      <SecurityAnalysis labels={labels.security} items={items} address={addressLine} />

      <Facts
        rows={[
          [labels.blueprintLabel, info.blueprint],
          [
            labels.packageLabel,
            <>
              {addressLine(info.packageAddress)}
              <Sub>{labels.packageNote}</Sub>
            </>,
          ],
          owner && [
            labels.ownerLabel,
            <RuleSummary
              key="o"
              t={t}
              rule={owner.rule}
              badgeName={badgeNamer(names)}
              callerHints={labels.callerHints}
              caller={callerLine(owner.rule)}
              note={owner.updatable ? labels.ownerUpdatable : labels.ownerFixed}
            />,
          ],
          packageOwner && [
            labels.packageOwnerLabel,
            <RuleSummary key="p" t={t} rule={packageOwner} badgeName={badgeNamer(names)} callerHints={labels.callerHints} caller={callerLine(packageOwner)} />,
          ],
          [labels.royaltiesLabel, info.royaltyMethods === 1 ? labels.royaltiesOnOne : info.royaltyMethods > 0 ? labels.royaltiesOn.replace('{count}', String(info.royaltyMethods)) : labels.royaltiesOff],
          [labels.holdsLabel, holds],
          [labels.createdLabel, date(origin?.createdAt)],
          [labels.lastActivityLabel, date(origin?.lastActivityAt)],
        ]}
      />

      <EntityPermissions t={t} roles={entityRoles(info.details)} describe={(rule) => callerLine(rule) ?? badgeRow(rule, addressLine)} />
    </EntityCard>
  );
}

/** The badge a rule asks for, as an address line. */
const badgeRow = (rule: RuleView, addressLine: (a: string) => ReactNode) =>
  rule.type === 'resource' || rule.type === 'nonFungible' ? addressLine(rule.resource) : null;
