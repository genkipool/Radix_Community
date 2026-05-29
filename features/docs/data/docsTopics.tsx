import { Book, Code, FileText, Server, Layers, Settings } from 'lucide-react';
import type { Topic } from '../types/data.types';

export const TOPICS: Topic[] = [
    {
        id: 'admin',
        topicKey: 'admin',
        icon: <Settings className="size-5" />,
        gradient: 'from-slate-500 to-slate-400',
        docs: [],
    },
    {
        id: 'developers',
        topicKey: 'developers',
        icon: <Code className="size-5" />,
        gradient: 'from-violet-600 to-fuchsia-500',
        docs: [
            { id: 'scrypto-basics', titleKey: 'scrypto_basics' },
            { id: 'asset-paradigm', titleKey: 'asset_paradigm' },
            { id: 'blueprints', titleKey: 'blueprints' },
            { id: 'frontend-sdk', titleKey: 'frontend_sdk' },
            { id: 'tx-manifests', titleKey: 'tx_manifests' },
        ],
    },
    {
        id: 'whitepapers',
        topicKey: 'whitepapers',
        icon: <Book className="size-5" />,
        gradient: 'from-blue-600 to-cyan-500',
        docs: [
            { id: 'ledger-architecture', titleKey: 'ledger_architecture' },
            { id: 'atomic-composability', titleKey: 'atomic_composability' },
            { id: 'cerberus', titleKey: 'cerberus' },
            { id: 'cerberus-braiding', titleKey: 'cerberus_braiding' },
        ],
    },
    {
        id: 'guides',
        topicKey: 'guides',
        icon: <FileText className="size-5" />,
        gradient: 'from-emerald-500 to-teal-400',
        docs: [
            { id: 'babylon-guide', titleKey: 'babylon_guide' },
            { id: 'epochs', titleKey: 'epochs' },
        ],
    },
    {
        id: 'node_operators',
        topicKey: 'node_operators',
        icon: <Server className="size-5" />,
        gradient: 'from-amber-500 to-orange-400',
        docs: [
            { id: 'babylon-guide', titleKey: 'babylon_guide' },
            { id: 'epochs', titleKey: 'epochs' },
        ],
    },
    {
        id: 'defi',
        topicKey: 'defi',
        icon: <Layers className="size-5" />,
        gradient: 'from-rose-500 to-pink-400',
        docs: [
            { id: 'defi-overview', titleKey: 'defi_overview' },
            { id: 'flash-loans', titleKey: 'flash_loans' },
            { id: 'atomic-composability', titleKey: 'atomic_composability' },
        ],
    },
];
