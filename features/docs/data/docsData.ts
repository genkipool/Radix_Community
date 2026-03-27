/**
 * docsData.ts — Single source of truth for document metadata.
 * All labelKeys resolve to t.docs.content.* in the i18n dictionaries.
 */
import type { DocData } from '../types/data.types';

export const DOCS_MAP: Record<string, DocData> = {
    'ledger-architecture': {
        id: 'ledger-architecture',
        titleKey: 'ledger_architecture',
        topicId: 'whitepapers',
        topicKey: 'whitepapers',
        toc: [
            { id: 'core-concepts',   titleKey: 'core_concepts_title',  bodyKey: 'core_concepts_body',  level: 2 },
            { id: 'native-assets',   titleKey: 'native_assets_title',  bodyKey: 'native_assets_body',  level: 3 },
            { id: 'resource-model',  titleKey: 'resource_model_title', bodyKey: 'resource_model_body', level: 4 },
            { id: 'atomic',          titleKey: 'atomic_title',         bodyKey: 'atomic_body',         level: 2 },
            { id: 'cross-shard',     titleKey: 'cross_shard_title',    bodyKey: 'cross_shard_body',    level: 3 },
            { id: 'cerberus',        titleKey: 'cerberus_title',       bodyKey: 'cerberus_body',       level: 2 },
            { id: 'braiding',        titleKey: 'braiding_title',       bodyKey: 'braiding_body',       level: 3 },
        ],
    },
    'atomic-composability': {
        id: 'atomic-composability',
        titleKey: 'atomic_composability',
        topicId: 'whitepapers',
        topicKey: 'whitepapers',
        toc: [
            { id: 'atomic',      titleKey: 'atomic_title',      bodyKey: 'atomic_body',      level: 2 },
            { id: 'cross-shard', titleKey: 'cross_shard_title', bodyKey: 'cross_shard_body', level: 3 },
            { id: 'cerberus',    titleKey: 'cerberus_title',    bodyKey: 'cerberus_body',    level: 2 },
            { id: 'braiding',    titleKey: 'braiding_title',    bodyKey: 'braiding_body',    level: 3 },
        ],
    },
    'cerberus': {
        id: 'cerberus',
        titleKey: 'cerberus',
        topicId: 'whitepapers',
        topicKey: 'whitepapers',
        toc: [
            { id: 'core-concepts', titleKey: 'core_concepts_title', bodyKey: 'core_concepts_body', level: 2 },
            { id: 'cerberus',      titleKey: 'cerberus_title',      bodyKey: 'cerberus_body',      level: 2 },
            { id: 'braiding',      titleKey: 'braiding_title',      bodyKey: 'braiding_body',      level: 3 },
            { id: 'cross-shard',   titleKey: 'cross_shard_title',   bodyKey: 'cross_shard_body',   level: 4 },
        ],
    },
    'cerberus-braiding': {
        id: 'cerberus-braiding',
        titleKey: 'cerberus_braiding',
        topicId: 'whitepapers',
        topicKey: 'whitepapers',
        toc: [
            { id: 'cerberus',    titleKey: 'cerberus_title',    bodyKey: 'cerberus_body',    level: 2 },
            { id: 'braiding',    titleKey: 'braiding_title',    bodyKey: 'braiding_body',    level: 2 },
            { id: 'cross-shard', titleKey: 'cross_shard_title', bodyKey: 'cross_shard_body', level: 3 },
            { id: 'atomic',      titleKey: 'atomic_title',      bodyKey: 'atomic_body',      level: 3 },
        ],
    },
    'scrypto-basics': {
        id: 'scrypto-basics',
        titleKey: 'scrypto_basics',
        topicId: 'developers',
        topicKey: 'developers',
        toc: [
            { id: 'core-concepts',  titleKey: 'core_concepts_title',  bodyKey: 'core_concepts_body',  level: 2 },
            { id: 'native-assets',  titleKey: 'native_assets_title',  bodyKey: 'native_assets_body',  level: 3 },
            { id: 'resource-model', titleKey: 'resource_model_title', bodyKey: 'resource_model_body', level: 4 },
            { id: 'atomic',         titleKey: 'atomic_title',         bodyKey: 'atomic_body',         level: 2 },
        ],
    },
    'asset-paradigm': {
        id: 'asset-paradigm',
        titleKey: 'asset_paradigm',
        topicId: 'developers',
        topicKey: 'developers',
        toc: [
            { id: 'native-assets',  titleKey: 'native_assets_title',  bodyKey: 'native_assets_body',  level: 2 },
            { id: 'resource-model', titleKey: 'resource_model_title', bodyKey: 'resource_model_body', level: 3 },
            { id: 'core-concepts',  titleKey: 'core_concepts_title',  bodyKey: 'core_concepts_body',  level: 2 },
        ],
    },
    'blueprints': {
        id: 'blueprints',
        titleKey: 'blueprints',
        topicId: 'developers',
        topicKey: 'developers',
        toc: [
            { id: 'core-concepts',  titleKey: 'core_concepts_title',  bodyKey: 'core_concepts_body',  level: 2 },
            { id: 'native-assets',  titleKey: 'native_assets_title',  bodyKey: 'native_assets_body',  level: 3 },
            { id: 'resource-model', titleKey: 'resource_model_title', bodyKey: 'resource_model_body', level: 4 },
        ],
    },
    'frontend-sdk': {
        id: 'frontend-sdk',
        titleKey: 'frontend_sdk',
        topicId: 'developers',
        topicKey: 'developers',
        toc: [
            { id: 'core-concepts', titleKey: 'core_concepts_title', bodyKey: 'core_concepts_body', level: 2 },
            { id: 'atomic',        titleKey: 'atomic_title',        bodyKey: 'atomic_body',        level: 3 },
        ],
    },
    'tx-manifests': {
        id: 'tx-manifests',
        titleKey: 'tx_manifests',
        topicId: 'developers',
        topicKey: 'developers',
        toc: [
            { id: 'core-concepts', titleKey: 'core_concepts_title', bodyKey: 'core_concepts_body', level: 2 },
            { id: 'atomic',        titleKey: 'atomic_title',        bodyKey: 'atomic_body',        level: 3 },
            { id: 'cross-shard',   titleKey: 'cross_shard_title',   bodyKey: 'cross_shard_body',   level: 4 },
        ],
    },
    'babylon-guide': {
        id: 'babylon-guide',
        titleKey: 'babylon_guide',
        topicId: 'guides',
        topicKey: 'guides',
        toc: [
            { id: 'core-concepts',   titleKey: 'core_concepts_title', bodyKey: 'core_concepts_body', level: 2 },
            { id: 'validator-nodes', titleKey: 'validator_title',     bodyKey: 'validator_body',     level: 2 },
            { id: 'cerberus',        titleKey: 'cerberus_title',      bodyKey: 'cerberus_body',      level: 3 },
        ],
    },
    'epochs': {
        id: 'epochs',
        titleKey: 'epochs',
        topicId: 'guides',
        topicKey: 'guides',
        toc: [
            { id: 'core-concepts',   titleKey: 'core_concepts_title', bodyKey: 'core_concepts_body', level: 2 },
            { id: 'validator-nodes', titleKey: 'validator_title',     bodyKey: 'validator_body',     level: 3 },
        ],
    },
    'defi-overview': {
        id: 'defi-overview',
        titleKey: 'defi_overview',
        topicId: 'defi',
        topicKey: 'defi',
        toc: [
            { id: 'atomic',      titleKey: 'atomic_title',      bodyKey: 'atomic_body',      level: 2 },
            { id: 'cross-shard', titleKey: 'cross_shard_title', bodyKey: 'cross_shard_body', level: 3 },
            { id: 'cerberus',    titleKey: 'cerberus_title',    bodyKey: 'cerberus_body',    level: 3 },
        ],
    },
    'flash-loans': {
        id: 'flash-loans',
        titleKey: 'flash_loans',
        topicId: 'defi',
        topicKey: 'defi',
        toc: [
            { id: 'atomic',      titleKey: 'atomic_title',      bodyKey: 'atomic_body',      level: 2 },
            { id: 'cross-shard', titleKey: 'cross_shard_title', bodyKey: 'cross_shard_body', level: 3 },
            { id: 'braiding',    titleKey: 'braiding_title',    bodyKey: 'braiding_body',    level: 4 },
        ],
    },
};
