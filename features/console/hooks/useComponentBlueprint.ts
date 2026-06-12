'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import type { BlueprintFunction } from '../lib/blueprint-schema';

export interface ComponentStateField {
  name: string;
  typeName: string;
  value: string;
}

export interface ComponentRoleEntry {
  module: string;
  name: string;
  rule: string;
}

export interface ComponentRoles {
  owner: string;
  entries: ComponentRoleEntry[];
}

export interface ComponentBlueprint {
  componentAddress: string;
  packageAddress: string;
  blueprintName: string;
  version: string | null;
  functions: BlueprintFunction[];
  stateFields: ComponentStateField[];
  roles: ComponentRoles | null;
}

interface GatewayStateField {
  kind?: string;
  type_name?: string;
  field_name?: string;
  value?: unknown;
}

interface GatewayRoleAssignments {
  owner?: { rule?: { type?: string } };
  entries?: Array<{
    role_key?: { module?: string; name?: string };
    assignment?: { resolution?: string; explicit_rule?: { type?: string } };
  }>;
}

function mapStateFields(state: { fields?: GatewayStateField[] } | undefined): ComponentStateField[] {
  return (state?.fields ?? []).map((field) => ({
    name: field.field_name ?? '?',
    typeName: field.type_name ?? field.kind ?? '?',
    value:
      typeof field.value === 'string' || typeof field.value === 'number' || typeof field.value === 'boolean'
        ? String(field.value)
        : field.value !== undefined
          ? JSON.stringify(field.value)
          : '',
  }));
}

function mapRoles(assignments: GatewayRoleAssignments | undefined): ComponentRoles | null {
  if (!assignments) return null;
  return {
    owner: assignments.owner?.rule?.type ?? '?',
    entries: (assignments.entries ?? []).map((entry) => ({
      module: entry.role_key?.module ?? '?',
      name: entry.role_key?.name ?? '?',
      rule:
        entry.assignment?.resolution === 'Owner'
          ? 'Owner'
          : entry.assignment?.explicit_rule?.type ?? entry.assignment?.resolution ?? '?',
    })),
  };
}

/**
 * Reads a component's blueprint live from the network: entity details for the
 * package reference, state and roles, then the resolved function signatures
 * (names, receivers and argument types) via the blueprint-functions API.
 */
export function useComponentBlueprint(componentAddress: string | null) {
  const { activeNetwork } = useRadixWallet();

  return useQuery({
    queryKey: ['console-component-blueprint', activeNetwork, componentAddress],
    queryFn: async (): Promise<ComponentBlueprint> => {
      const details = (await apiFetchEntityDetails(componentAddress!, activeNetwork)) as unknown as {
        address: string;
        details?: {
          package_address?: string;
          blueprint_name?: string;
          state?: { fields?: GatewayStateField[] };
          role_assignments?: GatewayRoleAssignments;
        };
      };
      const packageAddress = details.details?.package_address;
      const blueprintName = details.details?.blueprint_name;
      if (!packageAddress || !blueprintName) {
        throw new Error('not_a_component');
      }

      const res = await fetch('/api/ret/blueprint-functions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageAddress, blueprintName, network: activeNetwork }),
      });
      if (!res.ok) throw new Error('blueprint_load_failed');
      const data = (await res.json()) as {
        blueprintName: string;
        version: string | null;
        functions: BlueprintFunction[];
      };

      return {
        componentAddress: details.address,
        packageAddress,
        blueprintName: data.blueprintName,
        version: data.version,
        functions: data.functions,
        stateFields: mapStateFields(details.details?.state),
        roles: mapRoles(details.details?.role_assignments),
      };
    },
    enabled: !!componentAddress,
    staleTime: 60_000,
    retry: false,
  });
}
