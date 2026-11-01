/**
 * Security findings in words, from the locale templates: the console cards
 * render them with the reader's dictionary, the MCP server with the English
 * one, so both say exactly the same thing.
 */

import type { ComponentFinding } from './component-security';
import type { PoolFinding } from './pool-security';

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');

/** How a resource, a number and a date are written where the text is shown. */
export interface TextFormat {
  name: (resource: string) => string;
  number: (value: number, digits: number) => string;
  date: (iso: string) => string;
  /** "a dApp", for a verified dApp without a name. */
  unnamedDapp: string;
}

export function poolFindingText(templates: Record<PoolFinding['id'], string>, f: PoolFinding, format: TextFormat): string {
  return fill(templates[f.id], {
    token: 'resource' in f ? format.name(f.resource) : '',
    symbol: 'symbol' in f ? f.symbol : '',
    supply: 'supply' in f ? format.number(f.supply, 6) : '',
    count: 'count' in f ? String(f.count) : '',
    date: 'lastAt' in f && f.lastAt ? format.date(f.lastAt) : '',
    share: 'share' in f ? format.number(f.share * 100, 1) : '',
    name: 'name' in f ? f.name || format.unnamedDapp : '',
  });
}

/** The addresses a pool finding points at, shown under its text. */
export function poolFindingAddresses(f: PoolFinding): string[] {
  const a =
    f.id === 'impersonation'
      ? f.genuine
      : f.id === 'controllerBadge'
        ? f.badge
        : f.id === 'controllerComponent'
          ? f.controller
          : f.id === 'managerVerified'
            ? f.dapp
            : null;
  return a ? [a] : [];
}

type ComponentTemplates = Record<string, string>;

export function componentFindingText(templates: ComponentTemplates, f: ComponentFinding, format: TextFormat): string {
  // One of a counted thing (1 method, 1 day) has its own sentence, and so does today.
  const count = 'methods' in f ? f.methods : 'blueprints' in f ? f.blueprints : 'days' in f ? f.days : null;
  const variant = f.id === 'young' && count === 0 ? 'Today' : count === 1 ? 'One' : '';
  const template = (variant && templates[`${f.id}${variant}`]) || templates[f.id];
  return fill(template, {
    supply: 'supply' in f ? format.number(f.supply, 6) : '',
    role: 'role' in f ? f.role : '',
    token: 'resource' in f ? format.name(f.resource) : '',
    methods: 'methods' in f ? String(f.methods) : '',
    blueprints: 'blueprints' in f ? String(f.blueprints) : '',
    name: 'name' in f ? f.name || format.unnamedDapp : '',
    days: 'days' in f ? String(f.days) : '',
  });
}

/** The addresses a component finding points at, shown under its text. */
export function componentFindingAddresses(f: ComponentFinding): string[] {
  switch (f.id) {
    case 'ownerBadge':
      return [f.badge];
    case 'ownerComponent':
      return f.controller ? [f.controller] : [];
    case 'verified':
      return [f.dapp];
    case 'controls':
      return f.entities;
    case 'packageImmutable':
      return [f.pkg];
    default:
      return [];
  }
}
