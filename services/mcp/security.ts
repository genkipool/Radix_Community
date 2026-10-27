/**
 * Security findings and permissions as the MCP tools print them. The sentences
 * are the console's English locale texts, so an agent reads exactly what the
 * console's info cards say.
 */

import en from '@/features/console/locales/en.json';
import { packageOfCallerRule } from '@/features/console/lib/caller-badge';
import type { ComponentFinding } from '@/features/console/lib/component-security';
import {
  componentFindingAddresses,
  componentFindingText,
  poolFindingAddresses,
  poolFindingText,
  type TextFormat,
} from '@/features/console/lib/finding-text';
import type { PoolFinding } from '@/features/console/lib/pool-security';
import type { EntityRole, RuleView } from '@/features/console/lib/role-lookup';

const MARK = { danger: '⛔', warning: '⚠', info: '·', ok: '✓' } as const;

const format = (unnamedDapp: string): TextFormat => ({
  name: (resource) => resource,
  number: (value, digits) => value.toLocaleString('en-US', { maximumFractionDigits: digits }),
  date: (iso) => iso,
  unnamedDapp,
});

/** A finding as structured output: its fields, its sentence and the addresses it points at. */
export interface FindingOut {
  id: string;
  severity: string;
  text: string;
  addresses: string[];
}

export function poolFindingsOut(findings: PoolFinding[]): FindingOut[] {
  const labels = en.console.pool.security;
  return findings.map((f) => ({ ...f, text: poolFindingText(labels.findings, f, format(labels.unnamedDapp)), addresses: poolFindingAddresses(f) }));
}

export function componentFindingsOut(findings: ComponentFinding[]): FindingOut[] {
  const labels = en.console.componentInfo.security;
  return findings.map((f) => ({
    ...f,
    text: componentFindingText(labels.findings, f, format(labels.unnamedDapp)),
    addresses: componentFindingAddresses(f),
  }));
}

/** One line per finding, worst first, with its addresses. */
export const findingLines = (findings: FindingOut[]) =>
  findings.map((f) => `${MARK[f.severity as keyof typeof MARK] ?? '·'} ${f.text}${f.addresses.length ? ` ${f.addresses.join(', ')}` : ''}`).join('\n');

/** The component or package a caller rule names, when known. */
export const callerOf = (rule: RuleView, callers: Record<string, string>) =>
  rule.type === 'nonFungible' ? (packageOfCallerRule(rule) ?? callers[rule.localId] ?? null) : null;

const plainRuleText = (rule: RuleView) =>
  rule.type === 'allowAll'
    ? 'AllowAll (ANYONE)'
    : rule.type === 'denyAll'
      ? 'DenyAll (nobody)'
      : rule.type === 'resource'
        ? `badge ${rule.resource}`
        : rule.type === 'nonFungible'
          ? `NFT ${rule.resource}:${rule.localId}`
          : 'composite rule (not a plain badge)';

/** Who a rule lets in, naming the component behind a caller badge when it is known. */
export const ruleText = (rule: RuleView, callers: Record<string, string> = {}) => {
  const caller = callerOf(rule, callers);
  return caller ? `only ${caller} (${caller.startsWith('package_') ? 'package' : 'component'} caller badge)` : plainRuleText(rule);
};

/** Every role as a row: module and name, who holds it, and whether it can change. */
export const permissionRows = (roles: EntityRole[], callers: Record<string, string>): Array<[string, string]> =>
  roles.map((r) => [`${r.module} · ${r.name}`, `${r.viaOwner ? 'owner' : ruleText(r.rule, callers)}${r.fixed ? ' (fixed)' : ''}`]);

/** The roles as structured output. */
export const permissionsOut = (roles: EntityRole[], callers: Record<string, string>) =>
  roles.map((r) => ({ module: r.module, name: r.name, viaOwner: r.viaOwner, fixed: r.fixed, rule: r.rule, caller: callerOf(r.rule, callers) }));
