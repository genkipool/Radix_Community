/**
 * services/mcp/tools/site.ts
 *
 * Site tools: overview of every section of the web so AI clients can route
 * users to the right page and know what the site offers.
 */

import { z } from 'zod';
import { defineMcpTool } from '../registry';
import { cliBanner, cliNext, cliRender, cliSection, cliTable } from '../cli';

interface SiteSection {
  path: string;
  name: { en: string; es: string };
  description: { en: string; es: string };
}

/** Public sections of the site (paths are relative to /{locale}). */
const SITE_SECTIONS: SiteSection[] = [
  {
    path: '',
    name: { en: 'Home', es: 'Inicio' },
    description: {
      en: 'Landing page: what Radix is, ecosystem highlights and wallet downloads.',
      es: 'Página principal: qué es Radix, ecosistema destacado y descargas de la wallet.',
    },
  },
  {
    path: '/docs',
    name: { en: 'Documentation', es: 'Documentación' },
    description: {
      en: 'Curated docs: whitepapers, Scrypto developer guides, node & validator guides, DeFi concepts. Searchable via the search_radix_docs tool.',
      es: 'Documentación curada: whitepapers, guías de desarrollo con Scrypto, guías de nodos y validadores, conceptos DeFi. Consultable con la herramienta search_radix_docs.',
    },
  },
  {
    path: '/dashboard',
    name: { en: 'Dashboard & Explorer', es: 'Dashboard y Explorador' },
    description: {
      en: 'Network dashboard: validator list with stake/APY/uptime, ledger explorer for any address or transaction, staking overview and rewards.',
      es: 'Dashboard de red: lista de validadores con stake/APY/uptime, explorador del ledger para cualquier dirección o transacción, resumen de staking y recompensas.',
    },
  },
  {
    path: '/console',
    name: { en: 'Developer Console', es: 'Consola de Desarrollo' },
    description: {
      en: 'Wallet-connected tools: send transactions, stake, create tokens, deploy packages, call components, edit metadata, SBOR decode, faucet, and the MCP server page. Mirrored by the console MCP tools.',
      es: 'Herramientas conectadas a la wallet: enviar transacciones, hacer staking, crear tokens, desplegar paquetes, llamar componentes, editar metadatos, decodificar SBOR, faucet y la página del servidor MCP. Replicadas por las herramientas MCP de consola.',
    },
  },
  {
    path: '/academy',
    name: { en: 'Academy', es: 'Academia' },
    description: {
      en: 'Interactive learning paths about Radix, Scrypto and DeFi.',
      es: 'Itinerarios interactivos de aprendizaje sobre Radix, Scrypto y DeFi.',
    },
  },
  {
    path: '/blog',
    name: { en: 'Blog', es: 'Blog' },
    description: {
      en: 'Articles and announcements from the community.',
      es: 'Artículos y anuncios de la comunidad.',
    },
  },
  {
    path: '/forum',
    name: { en: 'Forum', es: 'Foro' },
    description: {
      en: 'Community discussions and governance debates.',
      es: 'Discusiones de la comunidad y debates de gobernanza.',
    },
  },
  {
    path: '/community',
    name: { en: 'Community', es: 'Comunidad' },
    description: {
      en: 'Community areas and transparency reports.',
      es: 'Áreas de la comunidad e informes de transparencia.',
    },
  },
  {
    path: '/dapps',
    name: { en: 'dApps', es: 'dApps' },
    description: {
      en: 'Catalog of decentralized applications on Radix.',
      es: 'Catálogo de aplicaciones descentralizadas en Radix.',
    },
  },
  {
    path: '/games',
    name: { en: 'Games', es: 'Juegos' },
    description: {
      en: 'Games built on the Radix network.',
      es: 'Juegos construidos sobre la red Radix.',
    },
  },
  {
    path: '/infrastructure',
    name: { en: 'Infrastructure', es: 'Infraestructura' },
    description: {
      en: 'Network infrastructure: nodes, gateways and public endpoints.',
      es: 'Infraestructura de red: nodos, gateways y endpoints públicos.',
    },
  },
];

export const getSiteOverviewTool = defineMcpTool({
  name: 'get_site_overview',
  title: 'Get site overview',
  description:
    'Map of the Radix Community web: every section with its URL and what it offers. Call it first when you need to know where something lives on the site.',
  category: 'site',
  readOnly: true,
  inputSchema: z.object({
    locale: z
      .enum(['en', 'es'])
      .default('en')
      .describe('Language of the descriptions and generated URLs: "en" or "es"'),
  }),
  handler: ({ locale }, ctx) => {
    return cliRender(
      cliBanner('Radix community · site map'),
      cliTable(
        ['Section', 'URL'],
        SITE_SECTIONS.map((section) => [
          section.name[locale],
          `${ctx.origin}/${locale}${section.path}`,
        ]),
      ),
      `${cliSection(locale === 'es' ? 'Descripciones' : 'Descriptions')}\n${SITE_SECTIONS.map(
        (section) => `• ${section.name[locale]}: ${section.description[locale]}`,
      ).join('\n')}`,
      cliNext([
        'search_radix_docs → documentation questions.',
        'lookup_entity / get_account_balances / get_transaction / list_validators → on-ledger data.',
        'list_console_tools / build_manifest_from_template → prepare wallet transactions.',
      ]),
    );
  },
});

export const siteTools = [getSiteOverviewTool];
