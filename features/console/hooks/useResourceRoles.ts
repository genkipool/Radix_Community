'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { extractRuleAddress } from '@/features/dashboard/utils/resourceUtils';

export function useResourceRoles(resourceAddress: string | null) {
  const { activeNetwork } = useRadixWallet();

  return useQuery({
    queryKey: ['console-resource-roles', activeNetwork, resourceAddress],
    queryFn: async () => {
      const details = await apiFetchEntityDetails(resourceAddress!, activeNetwork);
      const roleAssignments = details.details?.role_assignments;
      
      const badgeAddresses = new Set<string>();

      if (roleAssignments) {
        // Check owner role
        if (roleAssignments.owner?.rule) {
          const addr = extractRuleAddress(roleAssignments.owner.rule);
          if (addr) badgeAddresses.add(addr);
        }

        // Check other roles
        if (Array.isArray(roleAssignments.entries)) {
          for (const entry of roleAssignments.entries) {
            if (entry.assignment?.explicit_rule) {
              const addr = extractRuleAddress(entry.assignment.explicit_rule);
              if (addr) badgeAddresses.add(addr);
            }
          }
        }
      }

      return {
        roleAssignments,
        badgeAddresses: Array.from(badgeAddresses),
      };
    },
    enabled: !!resourceAddress,
    staleTime: 60_000,
  });
}
