/**
 * services/mcp/tools/component.ts
 *
 * Read-only view of components, the same card the console's "Component info"
 * section shows, gathered by the same function (`fetchComponentState`), so an
 * agent and the console cannot disagree.
 */
import { z } from 'zod';

import { entityRoles, ownerRule } from '@/features/console/lib/role-lookup';
import { fetchComponentState } from '@/features/console/lib/security-data';
import { gatewayPost } from '@/services/gateway/bases';
import { cliBanner, cliKeyValues, cliNext, cliRender, cliSection } from '../cli';
import { defineMcpTool } from '../registry';
import { callerOf, componentFindingsOut, findingLines, permissionRows, permissionsOut, ruleText } from '../security';
import { assertAddressOnNetwork } from './console';
import { networkSchema } from './schemas';

export const getComponentInfoTool = defineMcpTool({
  name: 'get_component_info',
  title: 'Read component info',
  description:
    'Reads one or several Radix components (component_…), the same card the console\'s "Component info" section shows: name, description and link, blueprint and package (a package\'s code can never change), who owns the component and the package, its royalties, how many tokens and NFT collections it holds, when it was created and last used, every role with whether it can change, and a security analysis (findings worst first: an owner anyone or an XRD badge can act as, an owner badge that can be minted or has several units, roles open to everyone, held tokens their issuer can recall or freeze, royalties and who can change them, whether a verified dApp claims it, whether its name can change, the entities created with it that answer to it, whether it is new). These check permissions, not code: nothing here says the code is safe.',
  category: 'console',
  inputSchema: z.object({
    component: z
      .union([z.string(), z.array(z.string()).min(1).max(10)])
      .describe('Component address (component_…), or a list of up to 10 to read them all at once'),
    network: networkSchema,
  }),
  handler: async ({ component, network }, ctx) => {
    const components = [component].flat();

    const read = async (address: string) => {
      // One bad address is reported in its own section instead of failing the rest.
      try {
        assertAddressOnNetwork('component', address, network);
      } catch (error) {
        return { address, error: error instanceof Error ? error.message : String(error) } as const;
      }
      const state = await fetchComponentState((path, body) => gatewayPost(network, path, body), address).catch(() => null);
      if (!state) return { address, error: `${address} is not a component on ${network}.` } as const;
      return { address, ...state, findingsOut: componentFindingsOut(state.findings), roles: entityRoles(state.info.details) };
    };
    const results = await Promise.all(components.map(read));

    const sections = results.map((r) => {
      if ('error' in r) return `${cliSection(r.address)}\n${r.error}`;
      const owner = ownerRule(r.info.details);
      const packageOwner = r.packageDetails ? ownerRule(r.packageDetails).rule : null;
      return cliRender(
        cliSection(r.info.profile.name || r.info.blueprint || r.address),
        `Security (permissions, not code):\n${findingLines(r.findingsOut)}`,
        cliKeyValues([
          ['Component', r.address],
          ...(r.info.profile.description ? ([['Description', r.info.profile.description]] as Array<[string, string]>) : []),
          ...(r.info.profile.infoUrl ? ([['Website', r.info.profile.infoUrl]] as Array<[string, string]>) : []),
          ['Blueprint', r.info.blueprint],
          ['Package', `${r.info.packageAddress} (its code cannot change)`],
          ['Owner', `${ruleText(owner.rule, r.ownerCallers)}${owner.updatable ? '' : ' (fixed)'}`],
          ...(packageOwner ? ([['Package owner', ruleText(packageOwner)]] as Array<[string, string]>) : []),
          ['Royalties', r.info.royaltyMethods > 0 ? `${r.info.royaltyMethods} methods charge royalties` : 'none'],
          ['Holds', `${r.info.fungibles} tokens, ${r.info.nonFungibles} NFT collections`],
          ['Created', r.origin?.createdAt ?? 'unknown'],
          ['Last activity', r.origin?.lastActivityAt ?? 'unknown'],
        ]),
        `Permissions:\n${cliKeyValues(permissionRows(r.roles, r.ownerCallers))}`,
      );
    });

    const structuredOf = (r: (typeof results)[number]) =>
      'error' in r
        ? r
        : {
            component: r.address,
            name: r.info.profile.name || null,
            description: r.info.profile.description || null,
            infoUrl: r.info.profile.infoUrl || null,
            blueprint: r.info.blueprint,
            package: r.info.packageAddress,
            owner: ownerRule(r.info.details).rule,
            ownerCaller: callerOf(ownerRule(r.info.details).rule, r.ownerCallers),
            ownerUpdatable: ownerRule(r.info.details).updatable,
            packageOwner: r.packageDetails ? ownerRule(r.packageDetails).rule : null,
            royaltyMethods: r.info.royaltyMethods,
            packageRoyaltyBlueprints: r.packageRoyaltyBlueprints,
            holds: { tokens: r.info.fungibles, nftCollections: r.info.nonFungibles },
            createdAt: r.origin?.createdAt ?? null,
            lastActivityAt: r.origin?.lastActivityAt ?? null,
            controls: r.origin?.controls ?? [],
            findings: r.findingsOut,
            permissions: permissionsOut(r.roles, r.ownerCallers),
          };

    return {
      text: cliRender(
        cliBanner(components.length > 1 ? `Radix components · ${components.length}` : 'Radix component · info'),
        ...sections,
        cliNext([
          `Same view in the console (wallet required): ${ctx.origin}/en/console/component-info?component=${components.join(',')}`,
          'get_pool_state for a pool it controls',
        ]),
      ),
      structured: typeof component === 'string' ? structuredOf(results[0]) : { components: results.map(structuredOf) },
    };
  },
});

export const componentTools = [getComponentInfoTool];
