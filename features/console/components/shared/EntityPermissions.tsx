'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

import { isGlobalCallerBadge, isPackageCallerBadge, type EntityRole, type RuleView } from '../../lib/role-lookup';
import type { ConsoleDictionary } from '../../types/i18n.types';
import { AuthRoleRow } from './AuthRoleRow';
import { Heading, Sub } from './InfoParts';

type PermissionValue = 'owner' | 'allowAll' | 'denyAll' | 'badge' | 'component' | 'package' | 'other';

const valueOf = (role: EntityRole): PermissionValue => {
  if (role.viaOwner) return 'owner';
  const { rule } = role;
  if (rule.type === 'allowAll' || rule.type === 'denyAll') return rule.type;
  if (rule.type === 'resource' || rule.type === 'nonFungible') {
    return isGlobalCallerBadge(rule.resource) ? 'component' : isPackageCallerBadge(rule.resource) ? 'package' : 'badge';
  }
  return 'other';
};

/**
 * The usual choices (the same three as My Resources), with the one the role
 * actually has in front when it is none of them: a badge, a component… Three
 * buttons always fit on one row.
 */
const optionsFor = (role: EntityRole, value: PermissionValue): PermissionValue[] => {
  const usual: PermissionValue[] = role.module === 'Owner' ? ['denyAll', 'allowAll'] : ['owner', 'denyAll', 'allowAll'];
  return usual.includes(value) ? usual : [value, 'denyAll', 'allowAll'];
};

interface EntityPermissionsProps {
  t: ConsoleDictionary;
  roles: EntityRole[];
  /** Who a badge or caller rule names (address lines), rendered by the caller of this view. */
  describe: (rule: RuleView) => ReactNode;
}

/**
 * Every role of an entity in the read-only layout of the authorization roles
 * in My Resources, grouped by module: what each role resolves to, who that is
 * (a badge, a component) and whether it can still change. Folded by default:
 * the summary above it already says who manages the entity.
 */
export function EntityPermissions({ t, roles, describe }: EntityPermissionsProps) {
  const labels = t.permissions;
  const [open, setOpen] = useState(false);
  if (roles.length === 0) return null;
  const modules = [...new Set(roles.map((r) => r.module))];

  return (
    <div className="space-y-2">
      <Heading>{labels.title}</Heading>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors hover:text-[var(--color-accent)] cursor-pointer"
        style={{ color: 'var(--color-primary)' }}
      >
        <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        {(open ? labels.hide : labels.show).replace('{count}', String(roles.length))}
      </button>
      {open && (
        <div className="space-y-4">
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {labels.hint}
          </p>
          {modules.map((module) => (
            <div key={module} className="space-y-1">
              <Heading>{(labels.modules as Record<string, string>)[module] ?? module}</Heading>
              <div className="divide-y divide-[var(--color-card-border)]">
                {roles
                  .filter((role) => role.module === module)
                  .map((role) => {
                    const value = valueOf(role);
                    const who = role.viaOwner ? null : describe(role.rule);
                    const detail =
                      who || role.fixed ? (
                        <>
                          {who}
                          {role.fixed && <Sub>{labels.fixed}</Sub>}
                        </>
                      ) : undefined;
                    return (
                      <AuthRoleRow<PermissionValue>
                        key={`${module}-${role.name}`}
                        roleKey={role.name}
                        roleHint={(labels.roleHints as Record<string, string>)[role.name]}
                        value={value}
                        options={optionsFor(role, value)}
                        labels={labels.options}
                        optionHints={labels.optionHints}
                        readOnly
                        detail={detail}
                      />
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
