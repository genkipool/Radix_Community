import 'server-only';
import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { getRedis } from '@/lib/redis';
import logger from '@/lib/logger';
import type { GovernanceItem } from '../lib/governanceVotes';

/**
 * Machine translation of proposal texts, the way Reddit does it: proposals
 * are written in English, readers get them in their language with a way back
 * to the original.
 *
 * Each text is translated once per language and kept in Redis for good, keyed
 * by a hash of the source, so an edited proposal gets a fresh translation and
 * an unchanged one never costs a second call. Only items read from the ledger
 * are translated; the endpoint never accepts text from the browser.
 */

/** Languages the site offers besides English, with the name the model gets. */
const LANGUAGE_NAMES: Record<string, string> = { es: 'Spanish (Spain)' };

export const isTranslatable = (lang: string) => Object.hasOwn(LANGUAGE_NAMES, lang);

const TranslationSchema = z.object({
    title: z.string(),
    shortDescription: z.string(),
    description: z.string(),
    options: z.array(z.object({ id: z.number().int(), label: z.string() })),
});
export type ItemTranslation = z.infer<typeof TranslationSchema>;

type Source = Pick<GovernanceItem, 'title' | 'shortDescription' | 'description' | 'options'>;

const MODEL = 'claude-opus-5';
const LOCK_SECONDS = 300;

const SYSTEM = `You translate governance proposals of the Radix DLT community from English into the requested language.

Translate faithfully and completely; do not summarise, add, or omit anything. Keep the original meaning, tone and level of formality of a governance document.

Keep exactly as written: Markdown structure (headings, lists, tables, emphasis, block quotes, code), URLs and link targets, code spans and blocks, ledger addresses (account_…, component_…, resource_…), transaction ids, hashes and fingerprints, file paths, numbers, amounts, percentages, dates, section references such as §3A.1, proposal identifiers such as GP-PRE-1, and names of organisations, products and tokens (Radix, RadixDAO, Radix Foundation, XRD, Stokenet, Hyperlane, x402, CAIP). Translate link texts but never their targets.

Return every vote option with its original id.`;

const cacheKey = (lang: string, source: Source) =>
    `gov:tr:v1:${lang}:${createHash('sha256').update(JSON.stringify(source)).digest('hex')}`;

function sourceOf(item: GovernanceItem): Source {
    return { title: item.title, shortDescription: item.shortDescription, description: item.description, options: item.options };
}

function hasProvider(): boolean {
    return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/** A stored translation, or null. Cheap: one Redis read, no model call. */
export async function getCachedTranslation(item: GovernanceItem, lang: string): Promise<ItemTranslation | null> {
    const redis = getRedis();
    if (!redis || !isTranslatable(lang)) return null;
    try {
        const stored = await redis.get<ItemTranslation>(cacheKey(lang, sourceOf(item)));
        const parsed = TranslationSchema.safeParse(stored);
        return parsed.success ? parsed.data : null;
    } catch (err) {
        logger.warn({ err }, '[governance] translation cache read failed');
        return null;
    }
}

export type TranslationState =
    | { status: 'ready'; translation: ItemTranslation }
    | { status: 'pending' }
    | { status: 'unavailable' };

/**
 * Returns the translation when stored; otherwise claims the work and returns
 * `pending` with a `run` job for the caller to execute after responding (so
 * the request does not wait for the model). A second caller while the job
 * runs just sees `pending`.
 */
export async function requestTranslation(item: GovernanceItem, lang: string): Promise<{ state: TranslationState; run?: () => Promise<void> }> {
    if (!isTranslatable(lang)) return { state: { status: 'unavailable' } };
    const cached = await getCachedTranslation(item, lang);
    if (cached) return { state: { status: 'ready', translation: cached } };

    const redis = getRedis();
    if (!redis || !hasProvider()) return { state: { status: 'unavailable' } };

    const source = sourceOf(item);
    const key = cacheKey(lang, source);
    const claimed = await redis.set(`${key}:lock`, '1', { nx: true, ex: LOCK_SECONDS });
    if (!claimed) return { state: { status: 'pending' } };

    const run = async () => {
        try {
            const translation = await translateWithClaude(source, lang);
            if (translation) await redis.set(key, translation);
        } catch (err) {
            logger.error({ err }, '[governance] translation failed');
        } finally {
            await redis.del(`${key}:lock`).catch(() => {});
        }
    };
    return { state: { status: 'pending' }, run };
}

async function translateWithClaude(source: Source, lang: string): Promise<ItemTranslation | null> {
    const client = new Anthropic();
    const payload = {
        title: source.title ?? '',
        shortDescription: source.shortDescription ?? '',
        description: source.description ?? '',
        options: source.options,
    };

    // Long proposals produce long outputs: stream, then read the final message.
    // Fallbacks: if the model declines, the API re-runs the request on
    // Anthropic's recommended fallback model instead of returning a refusal.
    const stream = client.beta.messages.stream({
        model: MODEL,
        max_tokens: 64000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium', format: betaZodOutputFormat(TranslationSchema) },
        system: SYSTEM,
        messages: [{
            role: 'user',
            content: `Translate this proposal into ${LANGUAGE_NAMES[lang]}. Every field is Markdown or plain text as given.\n\n${JSON.stringify(payload)}`,
        }],
    });
    const message = await stream.finalMessage();

    if (message.stop_reason === 'refusal') {
        logger.warn({ category: message.stop_details?.category }, '[governance] translation declined');
        return null;
    }
    if (message.stop_reason === 'max_tokens') {
        logger.warn('[governance] translation truncated');
        return null;
    }
    const text = message.content.flatMap(block => (block.type === 'text' ? [block.text] : [])).join('');
    const parsed = TranslationSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return null;

    // Never trust the ids back blindly: keep only options the ballot has.
    const ids = new Set(source.options.map(o => o.id));
    return { ...parsed.data, options: parsed.data.options.filter(o => ids.has(o.id)) };
}
