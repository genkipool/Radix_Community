/**
 * services/mcp/tools/docs.ts
 *
 * Knowledge tools: search and read the curated documentation of the site
 * (whitepapers, developer guides, node-operator guides, …) in EN or ES.
 */

import { z } from 'zod';
import { DOCS_MAP } from '@/features/docs/data/docsData';
import { curatedDocToMarkdown } from '@/features/docs/utils/markdownRender';
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { defineMcpTool } from '../registry';
import { cliBanner, cliKeyValues, cliList, cliRender, cliSection } from '../cli';

const localeSchema = z
  .enum(['en', 'es'])
  .default('en')
  .describe('Language of the returned content: "en" (English) or "es" (Spanish)');

interface DocsDictionary {
  documents: Record<string, string>;
  topics: Record<string, string>;
  content: Record<string, string>;
}

async function loadDocsDictionary(locale: Locale): Promise<DocsDictionary> {
  const t = await getFeatureDictionary(locale, ['docs']);
  return t.docs as unknown as DocsDictionary;
}

const docUrl = (origin: string, locale: string, docId: string) =>
  `${origin}/${locale}/docs?view=${docId}`;

interface DocSearchHit {
  docId: string;
  title: string;
  topic: string;
  score: number;
  snippet?: string;
}

/** Scores one doc against a lower-cased query; 0 = no match. */
function scoreDoc(
  docId: string,
  query: string,
  dict: DocsDictionary,
): DocSearchHit | null {
  const doc = DOCS_MAP[docId];
  const title = dict.documents[doc.titleKey] ?? doc.titleKey;
  const topic = dict.topics[doc.topicKey] ?? doc.topicKey;
  let score = 0;
  let snippet: string | undefined;

  const terms = query.split(/\s+/).filter(Boolean);
  const matches = (text: string) => terms.some((term) => text.toLowerCase().includes(term));

  if (matches(title)) score += 10;
  if (matches(topic)) score += 3;

  for (const entry of doc.toc) {
    const sectionTitle = dict.content[entry.titleKey] ?? '';
    const sectionBody = dict.content[entry.bodyKey] ?? '';
    if (matches(sectionTitle)) score += 5;
    if (matches(sectionBody)) {
      score += 2;
      if (!snippet) {
        const lower = sectionBody.toLowerCase();
        const index = Math.max(0, lower.indexOf(terms.find((t) => lower.includes(t)) ?? ''));
        snippet = `${sectionBody.slice(Math.max(0, index - 60), index + 160).trim()}…`;
      }
    }
  }

  return score > 0 ? { docId, title, topic, score, snippet } : null;
}

export const searchRadixDocsTool = defineMcpTool({
  name: 'search_radix_docs',
  title: 'Search Radix docs',
  description:
    'Searches the curated documentation of the site (whitepapers, Scrypto/developer guides, node & validator guides, DeFi concepts). Returns matching documents with their URL. Call without "query" to list every available document. Use read_radix_doc to fetch the full content.',
  category: 'knowledge',
  inputSchema: z.object({
    query: z
      .string()
      .max(200)
      .optional()
      .describe('Free-text search, e.g. "install validator" or "NFT". Omit to list all docs.'),
    locale: localeSchema,
  }),
  handler: async ({ query, locale }, ctx) => {
    const dict = await loadDocsDictionary(locale);
    const ids = Object.keys(DOCS_MAP);

    if (!query?.trim()) {
      const byTopic = new Map<string, string[]>();
      for (const id of ids) {
        const doc = DOCS_MAP[id];
        const topic = dict.topics[doc.topicKey] ?? doc.topicKey;
        const title = dict.documents[doc.titleKey] ?? doc.titleKey;
        byTopic.set(topic, [
          ...(byTopic.get(topic) ?? []),
          `${title} — id: ${id} — ${docUrl(ctx.origin, locale, id)}`,
        ]);
      }
      return cliRender(
        cliBanner('Radix docs · all documents'),
        ...[...byTopic.entries()].map(([topic, docs]) => `${cliSection(topic)}\n${cliList(docs)}`),
      );
    }

    const hits = ids
      .map((id) => scoreDoc(id, query.toLowerCase(), dict))
      .filter((hit): hit is DocSearchHit => hit !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    if (hits.length === 0) {
      return cliRender(
        cliBanner('Radix docs · search'),
        `No documents matched "${query}". Call search_radix_docs without a query to list all documents.`,
      );
    }

    return cliRender(
      cliBanner('Radix docs · search'),
      `${hits.length} result(s) for "${query}":`,
      ...hits.map((hit) =>
        cliKeyValues([
          ['Title', hit.title],
          ['Doc id', hit.docId],
          ['Topic', hit.topic],
          ['URL', docUrl(ctx.origin, locale, hit.docId)],
          ['Match', hit.snippet],
        ]),
      ),
      'Fetch the full text of a result with read_radix_doc { "docId": "…" }.',
    );
  },
});

export const readRadixDocTool = defineMcpTool({
  name: 'read_radix_doc',
  title: 'Read a Radix doc',
  description:
    'Returns the full content of one curated documentation page as Markdown, in English or Spanish. Get valid doc ids from search_radix_docs.',
  category: 'knowledge',
  inputSchema: z.object({
    docId: z.string().max(80).describe('Document id, e.g. "scrypto-basics" or "babylon-guide"'),
    locale: localeSchema,
  }),
  handler: async ({ docId, locale }, ctx) => {
    const doc = DOCS_MAP[docId];
    if (!doc) {
      const available = Object.keys(DOCS_MAP).join(', ');
      throw new Error(`Unknown docId "${docId}". Available ids: ${available}`);
    }
    const dict = await loadDocsDictionary(locale);
    const title = dict.documents[doc.titleKey] ?? doc.titleKey;

    return cliRender(
      cliBanner(`Radix docs · ${title}`),
      cliKeyValues([
        ['Topic', dict.topics[doc.topicKey] ?? doc.topicKey],
        ['URL', docUrl(ctx.origin, locale, docId)],
      ]),
      curatedDocToMarkdown(title, doc.toc, dict.content),
    );
  },
});
